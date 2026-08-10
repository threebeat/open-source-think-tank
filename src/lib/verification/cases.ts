import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";

import {
  accounts,
  verificationArtifactHolds,
  verificationAssertions,
  verificationCases,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { classifyMultiAccountSynthetic } from "@/lib/authz/synthetic-classification";
import { ASSERTION_MINIMUM_DATA } from "@/lib/verification/ladder";

const DEFAULT_HOLD_TTL_MS = 24 * 60 * 60 * 1000;

export async function openVerificationCase(
  db: FoundationDb,
  input: {
    accountId: string;
    kind: VerificationAssertionKind;
    assertionSummary: string;
    /** Opaque pointer only — never raw document bytes. */
    evidencePointer?: string | null;
    actorAccountId: string;
    holdPurpose?: string;
  },
): Promise<AdapterResult<{ caseId: string; assertionId: string }>> {
  if (!input.assertionSummary.trim()) {
    return {
      ok: false,
      error: "Assertion summary is required.",
      code: "VERIFY_SUMMARY_REQUIRED",
    };
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "VERIFY_ACCOUNT_MISSING" };
  }

  const min = ASSERTION_MINIMUM_DATA[input.kind];
  if (min.storesRawArtifact) {
    return {
      ok: false,
      error: "Raw artifact storage is not enabled for this assertion kind.",
      code: "VERIFY_RAW_FORBIDDEN",
    };
  }

  const conflicting = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.accountId, input.accountId),
        eq(verificationCases.kind, input.kind),
        inArray(verificationCases.status, ["pending", "approved", "appealed"]),
      ),
    )
    .limit(1);
  if (conflicting.length > 0) {
    return {
      ok: false,
      error:
        "A pending, approved, or appealed case already exists for this assertion kind.",
      code: "VERIFY_CONFLICTING_CASE",
    };
  }

  const caseId = newEntityId("vcase");
  const assertionId = newEntityId("vassert");
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(verificationCases).values({
        id: caseId,
        accountId: input.accountId,
        kind: input.kind,
        status: "pending",
        synthetic: account.synthetic,
      });
      await tx.insert(verificationAssertions).values({
        id: assertionId,
        caseId,
        kind: input.kind,
        assertionSummary: input.assertionSummary.trim(),
        evidencePointer: input.evidencePointer?.trim() || null,
        assertedAt: now,
      });
      if (input.holdPurpose?.trim()) {
        await tx.insert(verificationArtifactHolds).values({
          id: newEntityId("vhold"),
          caseId,
          purpose: input.holdPurpose.trim(),
          expiresAt: new Date(now.getTime() + DEFAULT_HOLD_TTL_MS),
        });
      }
      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.actorAccountId,
        action: "verification.case_opened",
        subjectType: "verification_case",
        subjectId: caseId,
        summary: `Verification case opened for ${input.kind}.`,
        privatePayload: {
          kind: input.kind,
          accountId: input.accountId,
          hasEvidencePointer: Boolean(input.evidencePointer),
        },
        synthetic: account.synthetic,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("verification_cases_one_open_per_account_kind")) {
      return {
        ok: false,
        error:
          "A pending, approved, or appealed case already exists for this assertion kind.",
        code: "VERIFY_CONFLICTING_CASE",
      };
    }
    throw error;
  }

  return { ok: true, value: { caseId, assertionId } };
}

export async function assignReviewer(
  db: FoundationDb,
  input: {
    caseId: string;
    reviewerAccountId: string;
    actorAccountId: string;
  },
): Promise<AdapterResult<true>> {
  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = authorize(actor, "verification.review_case");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [row] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.caseId))
    .limit(1);
  if (!row) {
    return { ok: false, error: "Case not found", code: "VERIFY_CASE_MISSING" };
  }
  if (row.accountId === input.reviewerAccountId) {
    return {
      ok: false,
      error: "An account cannot review its own verification case.",
      code: "VERIFY_SELF_REVIEW",
    };
  }
  if (row.status !== "pending" && row.status !== "appealed") {
    return {
      ok: false,
      error: "Only pending or appealed cases can be assigned.",
      code: "VERIFY_CASE_STATE",
    };
  }

  const reviewer = await loadPrincipal(db, input.reviewerAccountId);
  const reviewerAuth = authorize(reviewer, "verification.review_case");
  if (!reviewerAuth.ok) {
    return {
      ok: false,
      error: "Assignee lacks verification.review_case capability.",
      code: "VERIFY_REVIEWER_UNAUTHORIZED",
    };
  }

  const [subjectAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, row.accountId))
    .limit(1);
  const [reviewerAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.reviewerAccountId))
    .limit(1);

  const now = new Date();
  await db
    .update(verificationCases)
    .set({
      reviewerAccountId: input.reviewerAccountId,
      assignedAt: now,
      updatedAt: now,
    })
    .where(eq(verificationCases.id, row.id));

  await appendAuthAudit(db, {
    actorRole: "reviewer",
    actorAccountId: input.actorAccountId,
    action: "verification.reviewer_assigned",
    subjectType: "verification_case",
    subjectId: row.id,
    summary: "Reviewer assigned to verification case.",
    privatePayload: {
      reviewerAccountId: input.reviewerAccountId,
      subjectAccountId: row.accountId,
    },
    synthetic: classifyMultiAccountSynthetic(
      decision.principal.synthetic,
      Boolean(subjectAccount?.synthetic),
      Boolean(reviewerAccount?.synthetic),
    ),
  });

  return { ok: true, value: true };
}

async function decideCase(
  db: FoundationDb,
  input: {
    caseId: string;
    actorAccountId: string;
    status: "approved" | "denied" | "revoked";
    reason: string;
    expiresAt?: Date | null;
  },
): Promise<AdapterResult<true>> {
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Structured decision reason is required.",
      code: "VERIFY_REASON_REQUIRED",
    };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = authorize(actor, "verification.review_case");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [row] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.caseId))
    .limit(1);
  if (!row) {
    return { ok: false, error: "Case not found", code: "VERIFY_CASE_MISSING" };
  }
  if (row.accountId === input.actorAccountId) {
    return {
      ok: false,
      error: "An account cannot review its own verification case.",
      code: "VERIFY_SELF_REVIEW",
    };
  }

  if (input.status === "revoked") {
    if (row.status !== "approved") {
      return {
        ok: false,
        error: "Only approved cases can be revoked.",
        code: "VERIFY_CASE_STATE",
      };
    }
  } else if (row.status !== "pending" && row.status !== "appealed") {
    return {
      ok: false,
      error: "Only pending or appealed cases can be approved or denied.",
      code: "VERIFY_CASE_STATE",
    };
  }

  const [subjectAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, row.accountId))
    .limit(1);

  const now = new Date();
  await db
    .update(verificationCases)
    .set({
      status: input.status,
      decisionReason: input.reason.trim(),
      reviewerAccountId: input.actorAccountId,
      decidedAt: now,
      assignedAt: row.assignedAt ?? now,
      expiresAt:
        input.status === "approved"
          ? (input.expiresAt ?? row.expiresAt)
          : null,
      updatedAt: now,
    })
    .where(eq(verificationCases.id, row.id));

  await appendAuthAudit(db, {
    actorRole: "reviewer",
    actorAccountId: input.actorAccountId,
    action: `verification.case_${input.status}`,
    subjectType: "verification_case",
    subjectId: row.id,
    summary: `Verification case ${input.status}.`,
    reason: input.reason.trim(),
    privatePayload: { kind: row.kind, subjectAccountId: row.accountId },
    synthetic: classifyMultiAccountSynthetic(
      decision.principal.synthetic,
      Boolean(subjectAccount?.synthetic),
    ),
  });

  return { ok: true, value: true };
}

export function approveCase(
  db: FoundationDb,
  input: {
    caseId: string;
    actorAccountId: string;
    reason: string;
    expiresAt?: Date | null;
  },
) {
  return decideCase(db, { ...input, status: "approved" });
}

export function denyCase(
  db: FoundationDb,
  input: { caseId: string; actorAccountId: string; reason: string },
) {
  return decideCase(db, { ...input, status: "denied" });
}

export function revokeCase(
  db: FoundationDb,
  input: { caseId: string; actorAccountId: string; reason: string },
) {
  return decideCase(db, { ...input, status: "revoked" });
}

export async function appealCase(
  db: FoundationDb,
  input: { caseId: string; accountId: string; reason: string },
): Promise<AdapterResult<true>> {
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Appeal reason is required.",
      code: "VERIFY_REASON_REQUIRED",
    };
  }

  const [row] = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.id, input.caseId),
        eq(verificationCases.accountId, input.accountId),
      ),
    )
    .limit(1);
  if (!row) {
    return { ok: false, error: "Case not found", code: "VERIFY_CASE_MISSING" };
  }
  if (row.status !== "denied" && row.status !== "revoked") {
    return {
      ok: false,
      error: "Only denied or revoked cases can be appealed.",
      code: "VERIFY_CASE_STATE",
    };
  }

  const now = new Date();
  await db
    .update(verificationCases)
    .set({
      status: "appealed",
      decisionReason: input.reason.trim(),
      decidedAt: null,
      reviewerAccountId: null,
      assignedAt: null,
      updatedAt: now,
    })
    .where(eq(verificationCases.id, row.id));

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId: input.accountId,
    action: "verification.case_appealed",
    subjectType: "verification_case",
    subjectId: row.id,
    summary: "Verification case appealed.",
    reason: input.reason.trim(),
    privatePayload: { kind: row.kind },
    synthetic: row.synthetic,
  });

  return { ok: true, value: true };
}

/** Mark approved cases past expires_at as expired (structured reason). */
export async function expireDueCases(
  db: FoundationDb,
  now = new Date(),
): Promise<number> {
  const due = await db
    .select()
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.status, "approved"),
        lt(verificationCases.expiresAt, now),
      ),
    );

  for (const row of due) {
    await db
      .update(verificationCases)
      .set({
        status: "expired",
        decisionReason: `Expired at ${now.toISOString()} (prior expires_at).`,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(verificationCases.id, row.id));
    await appendAuthAudit(db, {
      actorRole: "system",
      actorAccountId: null,
      action: "verification.case_expired",
      subjectType: "verification_case",
      subjectId: row.id,
      summary: "Verification case expired.",
      privatePayload: { kind: row.kind, accountId: row.accountId },
      synthetic: row.synthetic,
    });
  }

  return due.length;
}

/** Purge expired artifact holds (metadata only — no bytes were stored). */
export async function purgeExpiredArtifactHolds(
  db: FoundationDb,
  now = new Date(),
): Promise<number> {
  const updated = await db
    .update(verificationArtifactHolds)
    .set({ purgedAt: now })
    .where(
      and(
        isNull(verificationArtifactHolds.purgedAt),
        or(
          lt(verificationArtifactHolds.expiresAt, now),
          eq(verificationArtifactHolds.expiresAt, now),
        ),
      ),
    )
    .returning();
  return updated.length;
}
