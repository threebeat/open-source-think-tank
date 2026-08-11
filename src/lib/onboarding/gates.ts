import { and, eq, gt, isNull, or } from "drizzle-orm";

import {
  accounts,
  assentOutcomes,
  assentRecords,
  documentVersions,
  invitations,
  verificationCases,
} from "@/db/schema";
import type { AuthAuditDb } from "@/lib/auth/audit-log";
import {
  activationCounselAllowsRealAccounts,
  blockingActivationCounselGates,
} from "@/lib/counsel/dispositions";
import { hasCurrentAssentForDocument } from "@/lib/assent/status";
import { L2_KINDS, L3_KINDS } from "@/lib/verification/seed-assurance";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";

export type ActivationGateSnapshot = {
  accountId: string;
  lifecycleState: string;
  synthetic: boolean;
  contactVerified: boolean;
  inviteAccepted: boolean;
  documentsComplete: boolean;
  missingDocumentTitles: string[];
  approvedKinds: VerificationAssertionKind[];
  hasL2: boolean;
  hasL3: boolean;
  hasEligibility: boolean;
  counselBlocksReal: boolean;
  blockingCounselGateIds: string[];
  engineeringReady: boolean;
  canActivate: boolean;
  blockingReasons: string[];
  evaluatedAt: string;
};

async function loadTimelineForAccount(db: AuthAuditDb, accountId: string) {
  const assents = await db
    .select({
      assent: assentRecords,
      document: documentVersions,
    })
    .from(assentRecords)
    .innerJoin(
      documentVersions,
      eq(assentRecords.documentVersionId, documentVersions.id),
    )
    .where(eq(assentRecords.accountId, accountId));

  const outcomes = await db
    .select({
      outcome: assentOutcomes,
      document: documentVersions,
    })
    .from(assentOutcomes)
    .innerJoin(
      documentVersions,
      eq(assentOutcomes.documentVersionId, documentVersions.id),
    )
    .where(eq(assentOutcomes.accountId, accountId));

  const timeline = [
    ...assents.map((row) => ({
      kind: "assent" as const,
      at: row.assent.assentedAt,
      assentId: row.assent.id,
      documentVersionId: row.document.id,
      contentHash: row.assent.contentHash,
      method: row.assent.method,
      noticesAcknowledged: row.assent.noticesAcknowledged,
      title: row.document.title,
      documentKind: row.document.kind,
      versionLabel: row.document.versionLabel,
      documentState: row.document.state,
    })),
    ...outcomes.map((row) => ({
      kind: "outcome" as const,
      at: row.outcome.decidedAt,
      outcomeId: row.outcome.id,
      outcome: row.outcome.outcome,
      documentVersionId: row.document.id,
      contentHash: row.outcome.contentHash,
      priorAssentId: row.outcome.priorAssentId,
      reason: row.outcome.reason,
      title: row.document.title,
      documentKind: row.document.kind,
      versionLabel: row.document.versionLabel,
      documentState: row.document.state,
    })),
  ];
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());
  return timeline;
}

async function approvedKindsAt(
  db: AuthAuditDb,
  accountId: string,
  now: Date,
): Promise<Set<VerificationAssertionKind>> {
  const rows = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.accountId, accountId),
        eq(verificationCases.status, "approved"),
        or(
          isNull(verificationCases.expiresAt),
          gt(verificationCases.expiresAt, now),
        ),
      ),
    );
  return new Set(rows.map((row) => row.kind));
}

/**
 * Evaluate activation predicates against a single DB executor and timestamp.
 * During activation, call after locking the account row with `forUpdate: true`
 * so published document rows are locked against supersession races.
 */
export async function evaluateActivationGates(
  db: AuthAuditDb,
  accountId: string,
  now: Date,
  options?: { forUpdate?: boolean },
): Promise<ActivationGateSnapshot | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) {
    return null;
  }

  const [invite] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.acceptedAccountId, accountId),
        eq(invitations.status, "accepted"),
      ),
    )
    .limit(1);

  const publishedQuery = db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.state, "published"));
  const published = options?.forUpdate
    ? await publishedQuery.for("update")
    : await publishedQuery;

  const timeline = await loadTimelineForAccount(db, accountId);
  const missing = published.filter((doc) => {
    const status = hasCurrentAssentForDocument(timeline, doc.id, doc.contentHash);
    return !status.current;
  });

  const approved = await approvedKindsAt(db, accountId, now);
  const hasL2 = L2_KINDS.every((kind) => approved.has(kind));
  const hasL3 = L3_KINDS.every((kind) => approved.has(kind));
  const hasEligibility = approved.has("eligibility");
  const documentsComplete = published.length > 0 && missing.length === 0;

  const counselBlocksReal =
    !account.synthetic && !activationCounselAllowsRealAccounts();
  const blockingCounsel = counselBlocksReal
    ? blockingActivationCounselGates()
    : [];

  const blockingReasons: string[] = [];
  if (account.lifecycleState === "active") {
    // no blockers for already-active display
  } else if (account.lifecycleState !== "pending_onboarding") {
    blockingReasons.push("Account must complete contact verification first.");
  } else {
    if (!documentsComplete) {
      if (published.length === 0) {
        blockingReasons.push("No published assent documents are available yet.");
      } else {
        blockingReasons.push(
          `Assent required for: ${missing.map((d) => d.title).join(", ")}.`,
        );
      }
    }
    if (!hasL3) {
      blockingReasons.push(
        `Verification required (approved): ${L3_KINDS.filter((k) => !approved.has(k)).join(", ")}.`,
      );
    }
    if (!hasEligibility) {
      blockingReasons.push(
        "Eligibility assertion must be approved before activation (engineering gate; alpha-test counsel: no geographical eligibility requirements).",
      );
    }
    if (counselBlocksReal) {
      blockingReasons.push(
        `Counsel gates still blocking for real accounts: ${blockingCounsel.map((g) => g.id).join(", ")}. Synthetic fixtures may activate for engineering only.`,
      );
    }
  }

  const engineeringReady =
    account.lifecycleState === "pending_onboarding" &&
    documentsComplete &&
    hasL3 &&
    hasEligibility;

  const canActivate =
    engineeringReady && !counselBlocksReal && blockingReasons.length === 0;

  return {
    accountId,
    lifecycleState: account.lifecycleState,
    synthetic: account.synthetic,
    contactVerified: Boolean(account.contactVerifiedAt),
    inviteAccepted: Boolean(invite) || account.lifecycleState !== "invited",
    documentsComplete,
    missingDocumentTitles: missing.map((d) => d.title),
    approvedKinds: [...approved],
    hasL2,
    hasL3,
    hasEligibility,
    counselBlocksReal,
    blockingCounselGateIds: blockingCounsel.map((g) => g.id),
    engineeringReady,
    canActivate,
    blockingReasons,
    evaluatedAt: now.toISOString(),
  };
}

/** Lock account row for activation (transaction-scoped). */
export async function lockAccountForActivation(
  db: AuthAuditDb,
  accountId: string,
) {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .for("update")
    .limit(1);
  return rows[0] ?? null;
}
