import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { getClaimById } from "@/lib/claims/repository";
import {
  claimDisclosureUpsertSchema,
  evidenceDisclosureUpsertSchema,
  normalizeExpectedUpdatedAt,
  resolveDisclosurePrivateDetail,
  resolveDisclosurePublicSummary,
} from "@/lib/conflicts/schemas";
import {
  getConflictDisclosureForClaim,
  getConflictDisclosureForEvidence,
  insertConflictDisclosure,
  updateConflictDisclosure,
  type ConflictDisclosureRecord,
} from "@/lib/conflicts/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { getEvidenceSubmissionById } from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conflict disclosures unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_DISCLOSURE",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<
    Awaited<ReturnType<typeof authorizeCapability>>,
    { ok: true }
  >,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function mapThrownAuthz(error: unknown): AdapterResult<never> | null {
  if (
    typeof error === "object" &&
    error &&
    "decision" in error &&
    (error as { decision: { ok: false } }).decision
  ) {
    return authzFail(
      (
        error as {
          decision: Exclude<
            Awaited<ReturnType<typeof authorizeCapability>>,
            { ok: true }
          >;
        }
      ).decision,
    );
  }
  return null;
}

function sameDisclosureContent(
  current: ConflictDisclosureRecord,
  next: { publicSummary: string; privateDetail: string | null },
): boolean {
  return (
    current.publicSummary === next.publicSummary &&
    (current.privateDetail ?? null) === next.privateDetail
  );
}

function mapServiceError(message: string): AdapterResult<never> {
  switch (message) {
    case "CLAIM_NOT_FOUND":
      return { ok: false, error: "Claim not found", code: "CLAIM_NOT_FOUND" };
    case "EVIDENCE_NOT_FOUND":
      return {
        ok: false,
        error: "Evidence submission not found",
        code: "EVIDENCE_NOT_FOUND",
      };
    case "TOPIC_NOT_FOUND":
      return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
    case "DISCLOSURE_NOT_OWNED":
      return {
        ok: false,
        error: "Not found",
        code: "DISCLOSURE_NOT_OWNED",
      };
    case "DISCLOSURE_STATE_CONFLICT":
      return {
        ok: false,
        error: "Disclosure changed; reload and retry",
        code: "DISCLOSURE_STATE_CONFLICT",
      };
    case "DISCLOSURE_EXPECTED_UPDATED_AT_REQUIRED":
      return {
        ok: false,
        error: "Expected updated timestamp is required to update a disclosure",
        code: "DISCLOSURE_EXPECTED_UPDATED_AT_REQUIRED",
      };
    default:
      return {
        ok: false,
        error: "Conflict disclosure update failed",
        code: "DISCLOSURE_UPSERT_FAILED",
      };
  }
}

/**
 * Create or update the current conflict disclosure for an owned claim.
 * True no-ops write nothing. "No known conflict" clears private detail.
 */
export async function upsertOwnClaimDisclosure(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    disclosureChoice: "none" | "disclose";
    publicSummary?: string;
    privateDetail?: string | null;
    expectedUpdatedAt?: Date | string;
  },
): Promise<AdapterResult<{ disclosure: ConflictDisclosureRecord; created: boolean }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = claimDisclosureUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid claim disclosure input",
      code: "DISCLOSURE_INPUT_INVALID",
    };
  }

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(
    parsed.data.expectedUpdatedAt,
  );
  const publicSummary = resolveDisclosurePublicSummary(parsed.data);
  const privateDetail = resolveDisclosurePrivateDetail(parsed.data);

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "conflicts.disclose_own",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const claim = await getClaimById(tx, parsed.data.claimId);
      if (!claim.ok || !claim.value) {
        throw new Error("CLAIM_NOT_FOUND");
      }
      if (claim.value.authorAccountId !== decision.principal.accountId) {
        throw new Error("DISCLOSURE_NOT_OWNED");
      }

      const topic = await getTopicById(tx, claim.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const existing = await getConflictDisclosureForClaim(
        tx,
        claim.value.id,
      );
      if (!existing.ok) {
        throw new Error(existing.code);
      }

      if (!existing.value) {
        const created = await insertConflictDisclosure(tx, {
          disclosingAccountId: decision.principal.accountId,
          claimId: claim.value.id,
          evidenceSubmissionId: null,
          publicSummary,
          privateDetail,
          synthetic: decision.principal.synthetic,
        });
        if (!created.ok) {
          throw new Error(created.code);
        }

        await appendAuthAudit(tx, {
          actorRole: "account_holder",
          actorAccountId: decision.principal.accountId,
          action: "conflicts.disclosed",
          subjectType: "conflict_disclosure",
          subjectId: created.value.id,
          summary: "Conflict disclosure recorded for claim.",
          privatePayload: {
            disclosureId: created.value.id,
            claimId: claim.value.id,
            topicId: claim.value.topicId,
            capability: "conflicts.disclose_own",
            actorAccountId: decision.principal.accountId,
            disclosureChoice: parsed.data.disclosureChoice,
            attachedTo: "claim",
          },
          synthetic: decision.principal.synthetic,
        });

        return {
          ok: true as const,
          value: { disclosure: created.value, created: true },
        };
      }

      if (sameDisclosureContent(existing.value, { publicSummary, privateDetail })) {
        return {
          ok: true as const,
          value: { disclosure: existing.value, created: false },
        };
      }

      if (!expectedUpdatedAt) {
        throw new Error("DISCLOSURE_EXPECTED_UPDATED_AT_REQUIRED");
      }

      const changedFieldLabels: string[] = [];
      if (existing.value.publicSummary !== publicSummary) {
        changedFieldLabels.push("publicSummary");
      }
      if ((existing.value.privateDetail ?? null) !== privateDetail) {
        changedFieldLabels.push("privateDetail");
      }

      const updated = await updateConflictDisclosure(tx, {
        disclosureId: existing.value.id,
        expectedUpdatedAt,
        publicSummary,
        privateDetail,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("DISCLOSURE_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: decision.principal.accountId,
        action: "conflicts.updated",
        subjectType: "conflict_disclosure",
        subjectId: updated.value.id,
        summary: "Conflict disclosure updated for claim.",
        privatePayload: {
          disclosureId: updated.value.id,
          claimId: claim.value.id,
          topicId: claim.value.topicId,
          capability: "conflicts.disclose_own",
          actorAccountId: decision.principal.accountId,
          attachedTo: "claim",
          disclosureChoice: parsed.data.disclosureChoice,
          changedFieldLabels,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { disclosure: updated.value, created: false },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    return mapServiceError(message);
  }
}

/**
 * Create or update the current conflict disclosure for owned evidence.
 */
export async function upsertOwnEvidenceDisclosure(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    disclosureChoice: "none" | "disclose";
    publicSummary?: string;
    privateDetail?: string | null;
    expectedUpdatedAt?: Date | string;
  },
): Promise<AdapterResult<{ disclosure: ConflictDisclosureRecord; created: boolean }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = evidenceDisclosureUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid evidence disclosure input",
      code: "DISCLOSURE_INPUT_INVALID",
    };
  }

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(
    parsed.data.expectedUpdatedAt,
  );
  const publicSummary = resolveDisclosurePublicSummary(parsed.data);
  const privateDetail = resolveDisclosurePrivateDetail(parsed.data);

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "conflicts.disclose_own",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const evidence = await getEvidenceSubmissionById(
        tx,
        parsed.data.evidenceSubmissionId,
      );
      if (!evidence.ok || !evidence.value) {
        throw new Error("EVIDENCE_NOT_FOUND");
      }
      if (
        evidence.value.submitterAccountId !== decision.principal.accountId
      ) {
        throw new Error("DISCLOSURE_NOT_OWNED");
      }

      const topic = await getTopicById(tx, evidence.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const existing = await getConflictDisclosureForEvidence(
        tx,
        evidence.value.id,
      );
      if (!existing.ok) {
        throw new Error(existing.code);
      }

      if (!existing.value) {
        const created = await insertConflictDisclosure(tx, {
          disclosingAccountId: decision.principal.accountId,
          claimId: null,
          evidenceSubmissionId: evidence.value.id,
          publicSummary,
          privateDetail,
          synthetic: decision.principal.synthetic,
        });
        if (!created.ok) {
          throw new Error(created.code);
        }

        await appendAuthAudit(tx, {
          actorRole: "account_holder",
          actorAccountId: decision.principal.accountId,
          action: "conflicts.disclosed",
          subjectType: "conflict_disclosure",
          subjectId: created.value.id,
          summary: "Conflict disclosure recorded for evidence.",
          privatePayload: {
            disclosureId: created.value.id,
            evidenceSubmissionId: evidence.value.id,
            topicId: evidence.value.topicId,
            capability: "conflicts.disclose_own",
            actorAccountId: decision.principal.accountId,
            disclosureChoice: parsed.data.disclosureChoice,
            attachedTo: "evidence",
          },
          synthetic: decision.principal.synthetic,
        });

        return {
          ok: true as const,
          value: { disclosure: created.value, created: true },
        };
      }

      if (sameDisclosureContent(existing.value, { publicSummary, privateDetail })) {
        return {
          ok: true as const,
          value: { disclosure: existing.value, created: false },
        };
      }

      if (!expectedUpdatedAt) {
        throw new Error("DISCLOSURE_EXPECTED_UPDATED_AT_REQUIRED");
      }

      const changedFieldLabels: string[] = [];
      if (existing.value.publicSummary !== publicSummary) {
        changedFieldLabels.push("publicSummary");
      }
      if ((existing.value.privateDetail ?? null) !== privateDetail) {
        changedFieldLabels.push("privateDetail");
      }

      const updated = await updateConflictDisclosure(tx, {
        disclosureId: existing.value.id,
        expectedUpdatedAt,
        publicSummary,
        privateDetail,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("DISCLOSURE_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: decision.principal.accountId,
        action: "conflicts.updated",
        subjectType: "conflict_disclosure",
        subjectId: updated.value.id,
        summary: "Conflict disclosure updated for evidence.",
        privatePayload: {
          disclosureId: updated.value.id,
          evidenceSubmissionId: evidence.value.id,
          topicId: evidence.value.topicId,
          capability: "conflicts.disclose_own",
          actorAccountId: decision.principal.accountId,
          attachedTo: "evidence",
          disclosureChoice: parsed.data.disclosureChoice,
          changedFieldLabels,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { disclosure: updated.value, created: false },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    return mapServiceError(message);
  }
}
