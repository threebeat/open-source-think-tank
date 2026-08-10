import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import {
  accounts,
  verificationArtifactHolds,
  verificationArtifactPayloads,
  verificationAssertions,
  verificationCases,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { classifyMultiAccountSynthetic } from "@/lib/authz/synthetic-classification";
import {
  formatHoldPointer,
  rejectClientEvidencePointer,
  revokeArtifactForHold,
  validateAssertionSummary,
} from "@/lib/verification/artifacts";
import { ASSERTION_MINIMUM_DATA } from "@/lib/verification/ladder";

const DEFAULT_HOLD_TTL_MS = 24 * 60 * 60 * 1000;

export async function openVerificationCase(
  db: FoundationDb,
  input: {
    accountId: string;
    kind: VerificationAssertionKind;
    assertionSummary: string;
    actorAccountId: string;
    /**
     * Optional short-lived artifact. Server mints `ostt:vhold:<id>` — callers
     * must not supply evidencePointer strings.
     */
    artifact?: {
      purpose: string;
      sensitivePayload: string;
      ttlMs?: number;
      retentionPolicy?: string;
    };
    /** @deprecated Rejected — use `artifact` retention path. */
    evidencePointer?: string | null;
    holdPurpose?: string;
  },
): Promise<
  AdapterResult<{ caseId: string; assertionId: string; evidencePointer: string | null }>
> {
  const summary = validateAssertionSummary(input.assertionSummary);
  if (!summary.ok) {
    return summary;
  }

  const pointerReject = rejectClientEvidencePointer(input.evidencePointer);
  if (!pointerReject.ok) {
    return pointerReject;
  }
  if (input.holdPurpose && !input.artifact) {
    return {
      ok: false,
      error:
        "Retention holds require an artifact payload. Pass artifact: { purpose, sensitivePayload }.",
      code: "VERIFY_ARTIFACT_REQUIRED",
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

  if (input.artifact) {
    if (!input.artifact.purpose.trim()) {
      return {
        ok: false,
        error: "Artifact purpose is required when retaining a payload.",
        code: "VERIFY_ARTIFACT_REQUIRED",
      };
    }
    if (!input.artifact.sensitivePayload) {
      return {
        ok: false,
        error: "Artifact sensitivePayload is required when retaining a payload.",
        code: "VERIFY_ARTIFACT_REQUIRED",
      };
    }
    if (input.artifact.sensitivePayload.length > 8_192) {
      return {
        ok: false,
        error: "Artifact payload exceeds retention size limit.",
        code: "VERIFY_ARTIFACT_TOO_LARGE",
      };
    }
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
  let evidencePointer: string | null = null;

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
        assertionSummary: summary.value,
        evidencePointer: null,
        assertedAt: now,
      });

      if (input.artifact) {
        const holdId = newEntityId("vhold");
        const ttl = input.artifact.ttlMs ?? DEFAULT_HOLD_TTL_MS;
        evidencePointer = formatHoldPointer(holdId);
        await tx.insert(verificationArtifactHolds).values({
          id: holdId,
          caseId,
          assertionId,
          purpose: input.artifact.purpose.trim(),
          retentionPolicy: input.artifact.retentionPolicy?.trim() || "ttl-24h",
          expiresAt: new Date(now.getTime() + ttl),
        });
        await tx.insert(verificationArtifactPayloads).values({
          holdId,
          payload: input.artifact.sensitivePayload,
        });
        await tx
          .update(verificationAssertions)
          .set({ evidencePointer })
          .where(eq(verificationAssertions.id, assertionId));
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
          hasEvidencePointer: Boolean(evidencePointer),
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

  return {
    ok: true,
    value: { caseId, assertionId, evidencePointer },
  };
}

/** First assignment only (reviewer_account_id IS NULL). */
export async function assignReviewer(
  db: FoundationDb,
  input: {
    caseId: string;
    reviewerAccountId: string;
    actorAccountId: string;
  },
): Promise<AdapterResult<true>> {
  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "verification.review_case",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  if (input.reviewerAccountId === input.actorAccountId) {
    // actor may assign self if not subject — still check self-review vs case account
  }

  const [existing] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.caseId))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "Case not found", code: "VERIFY_CASE_MISSING" };
  }
  if (existing.accountId === input.reviewerAccountId) {
    return {
      ok: false,
      error: "An account cannot review its own verification case.",
      code: "VERIFY_SELF_REVIEW",
    };
  }

  const reviewer = await loadPrincipal(db, input.reviewerAccountId);
  const reviewerAuth = await authorizeCapability(
    db,
    reviewer,
    "verification.review_case",
  );
  if (!reviewerAuth.ok) {
    return {
      ok: false,
      error: "Assignee lacks verification.review_case capability and assurance.",
      code: "VERIFY_REVIEWER_UNAUTHORIZED",
    };
  }

  const [subjectAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, existing.accountId))
    .limit(1);
  const [reviewerAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.reviewerAccountId))
    .limit(1);

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationCases)
        .set({
          reviewerAccountId: input.reviewerAccountId,
          assignedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(verificationCases.id, input.caseId),
            inArray(verificationCases.status, ["pending", "appealed"]),
            isNull(verificationCases.reviewerAccountId),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("VERIFY_ASSIGN_CONFLICT");
      }
      await appendAuthAudit(tx, {
        actorRole: "reviewer",
        actorAccountId: input.actorAccountId,
        action: "verification.reviewer_assigned",
        subjectType: "verification_case",
        subjectId: updated.id,
        summary: "Reviewer assigned to verification case.",
        privatePayload: {
          reviewerAccountId: input.reviewerAccountId,
          subjectAccountId: updated.accountId,
        },
        synthetic: classifyMultiAccountSynthetic(
          decision.principal.synthetic,
          Boolean(subjectAccount?.synthetic),
          Boolean(reviewerAccount?.synthetic),
        ),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_ASSIGN_CONFLICT") {
      return {
        ok: false,
        error:
          "Case is not assignable (wrong state, already assigned, or concurrent assign).",
        code: "VERIFY_ASSIGN_CONFLICT",
      };
    }
    throw error;
  }

  return { ok: true, value: true };
}

/** Explicit reassignment — does not run as a side effect of decisions. */
export async function reassignReviewer(
  db: FoundationDb,
  input: {
    caseId: string;
    reviewerAccountId: string;
    actorAccountId: string;
    reason: string;
  },
): Promise<AdapterResult<true>> {
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Reassignment reason is required.",
      code: "VERIFY_REASON_REQUIRED",
    };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "verification.review_case",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [existing] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.caseId))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "Case not found", code: "VERIFY_CASE_MISSING" };
  }
  if (existing.accountId === input.reviewerAccountId) {
    return {
      ok: false,
      error: "An account cannot review its own verification case.",
      code: "VERIFY_SELF_REVIEW",
    };
  }
  if (!existing.reviewerAccountId) {
    return {
      ok: false,
      error: "Case has no reviewer to reassign; use assignReviewer.",
      code: "VERIFY_CASE_STATE",
    };
  }

  const reviewer = await loadPrincipal(db, input.reviewerAccountId);
  const reviewerAuth = await authorizeCapability(
    db,
    reviewer,
    "verification.review_case",
  );
  if (!reviewerAuth.ok) {
    return {
      ok: false,
      error: "Assignee lacks verification.review_case capability and assurance.",
      code: "VERIFY_REVIEWER_UNAUTHORIZED",
    };
  }

  const [subjectAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, existing.accountId))
    .limit(1);

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationCases)
        .set({
          reviewerAccountId: input.reviewerAccountId,
          assignedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(verificationCases.id, input.caseId),
            inArray(verificationCases.status, ["pending", "appealed"]),
            sql`${verificationCases.reviewerAccountId} IS NOT NULL`,
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("VERIFY_REASSIGN_CONFLICT");
      }
      await appendAuthAudit(tx, {
        actorRole: "reviewer",
        actorAccountId: input.actorAccountId,
        action: "verification.reviewer_reassigned",
        subjectType: "verification_case",
        subjectId: updated.id,
        summary: "Reviewer reassigned on verification case.",
        reason: input.reason.trim(),
        privatePayload: {
          priorReviewerAccountId: existing.reviewerAccountId,
          reviewerAccountId: input.reviewerAccountId,
          subjectAccountId: updated.accountId,
        },
        synthetic: classifyMultiAccountSynthetic(
          decision.principal.synthetic,
          Boolean(subjectAccount?.synthetic),
        ),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_REASSIGN_CONFLICT") {
      return {
        ok: false,
        error: "Case could not be reassigned (state conflict).",
        code: "VERIFY_REASSIGN_CONFLICT",
      };
    }
    throw error;
  }

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
  const decision = await authorizeCapability(
    db,
    actor,
    "verification.review_case",
  );
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

  const [subjectAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, row.accountId))
    .limit(1);

  const now = new Date();
  const statusFilter =
    input.status === "revoked"
      ? eq(verificationCases.status, "approved")
      : inArray(verificationCases.status, ["pending", "appealed"]);

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationCases)
        .set({
          status: input.status,
          decisionReason: input.reason.trim(),
          decidedAt: now,
          expiresAt:
            input.status === "approved"
              ? (input.expiresAt ?? row.expiresAt)
              : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(verificationCases.id, input.caseId),
            statusFilter,
            eq(verificationCases.reviewerAccountId, input.actorAccountId),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("VERIFY_DECISION_CONFLICT");
      }
      await appendAuthAudit(tx, {
        actorRole: "reviewer",
        actorAccountId: input.actorAccountId,
        action: `verification.case_${input.status}`,
        subjectType: "verification_case",
        subjectId: updated.id,
        summary: `Verification case ${input.status}.`,
        reason: input.reason.trim(),
        privatePayload: { kind: updated.kind, subjectAccountId: updated.accountId },
        synthetic: classifyMultiAccountSynthetic(
          decision.principal.synthetic,
          Boolean(subjectAccount?.synthetic),
        ),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_DECISION_CONFLICT") {
      return {
        ok: false,
        error:
          "Decision rejected (not the assigned reviewer, wrong state, or concurrent decision).",
        code: "VERIFY_DECISION_CONFLICT",
      };
    }
    throw error;
  }

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

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationCases)
        .set({
          status: "appealed",
          decisionReason: input.reason.trim(),
          decidedAt: null,
          reviewerAccountId: null,
          assignedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(verificationCases.id, input.caseId),
            eq(verificationCases.accountId, input.accountId),
            inArray(verificationCases.status, ["denied", "revoked"]),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("VERIFY_APPEAL_CONFLICT");
      }
      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.accountId,
        action: "verification.case_appealed",
        subjectType: "verification_case",
        subjectId: updated.id,
        summary: "Verification case appealed.",
        reason: input.reason.trim(),
        privatePayload: { kind: updated.kind },
        synthetic: updated.synthetic,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_APPEAL_CONFLICT") {
      return {
        ok: false,
        error: "Only denied or revoked cases can be appealed.",
        code: "VERIFY_CASE_STATE",
      };
    }
    throw error;
  }

  return { ok: true, value: true };
}

/** Mark approved cases past expires_at as expired (structured reason). */
export async function expireDueCases(
  db: FoundationDb,
  now = new Date(),
): Promise<number> {
  let count = 0;
  const due = await db
    .select({ id: verificationCases.id })
    .from(verificationCases)
    .where(
      and(
        eq(verificationCases.status, "approved"),
        lt(verificationCases.expiresAt, now),
      ),
    );

  for (const row of due) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationCases)
        .set({
          status: "expired",
          decisionReason: `Expired at ${now.toISOString()} (prior expires_at).`,
          decidedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(verificationCases.id, row.id),
            eq(verificationCases.status, "approved"),
            lt(verificationCases.expiresAt, now),
          ),
        )
        .returning();
      if (!updated) {
        return;
      }
      count += 1;
      await appendAuthAudit(tx, {
        actorRole: "system",
        actorAccountId: null,
        action: "verification.case_expired",
        subjectType: "verification_case",
        subjectId: updated.id,
        summary: "Verification case expired.",
        privatePayload: { kind: updated.kind, accountId: updated.accountId },
        synthetic: updated.synthetic,
      });
    });
  }

  return count;
}

/**
 * Purge expired holds: delete payload, tombstone assertion pointer, mark purged.
 */
export async function purgeExpiredArtifactHolds(
  db: FoundationDb,
  now = new Date(),
): Promise<number> {
  const due = await db
    .select()
    .from(verificationArtifactHolds)
    .where(
      and(
        isNull(verificationArtifactHolds.purgedAt),
        or(
          lt(verificationArtifactHolds.expiresAt, now),
          eq(verificationArtifactHolds.expiresAt, now),
        ),
      ),
    );

  for (const hold of due) {
    await db.transaction(async (tx) => {
      await revokeArtifactForHold(tx, hold.id, now);
      await appendAuthAudit(tx, {
        actorRole: "system",
        actorAccountId: null,
        action: "verification.artifact_purged",
        subjectType: "verification_artifact_hold",
        subjectId: hold.id,
        summary: "Verification artifact hold purged; pointer tombstoned.",
        privatePayload: { caseId: hold.caseId },
        synthetic: true,
      });
    });
  }

  return due.length;
}
