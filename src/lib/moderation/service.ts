import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import {
  getClaimById,
  updateClaimModerationVisibility,
  type ClaimRecord,
} from "@/lib/claims/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  getEvidenceSubmissionById,
  updateEvidenceModerationVisibility,
  type EvidenceSubmissionRecord,
} from "@/lib/evidence/repository";
import {
  appendModerationAction,
  type ModerationActionRecord,
} from "@/lib/moderation/repository";
import {
  auditActionFor,
  claimModerationInputSchema,
  evidenceModerationInputSchema,
  normalizeExpectedUpdatedAt,
  resolveModerationTransition,
  type ModerationActionKind,
  type ModerationVisibility,
} from "@/lib/moderation/schemas";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Moderation unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_MODERATION",
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

function moderationActorRole(principal: AuthzPrincipal): string {
  if (principal.platformRoles.includes("administrator")) {
    return "administrator";
  }
  return "moderator";
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
    case "MODERATION_TRANSITION_INVALID":
      return {
        ok: false,
        error: "That moderation action is not allowed from the current visibility",
        code: "MODERATION_TRANSITION_INVALID",
      };
    case "MODERATION_STATE_CONFLICT":
      return {
        ok: false,
        error: "Submission visibility changed; reload and retry",
        code: "MODERATION_STATE_CONFLICT",
      };
    default:
      return {
        ok: false,
        error: "Moderation action failed",
        code: "MODERATION_ACTION_FAILED",
      };
  }
}

/**
 * Hold, hide, or restore a claim. Does not mutate evidence, workflow, quality,
 * disclosures, revisions, or topic publication.
 */
export async function moderateClaim(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    action: ModerationActionKind;
    publicRationale: string;
    privateNotes?: string | null;
    expectedVisibility: ModerationVisibility;
    expectedUpdatedAt: Date | string;
  },
): Promise<
  AdapterResult<{ claim: ClaimRecord; action: ModerationActionRecord }>
> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = claimModerationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid claim moderation input",
      code: "MODERATION_INPUT_INVALID",
    };
  }

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(
    parsed.data.expectedUpdatedAt,
  );

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "moderation.review_submission",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const claim = await getClaimById(tx, parsed.data.claimId);
      if (!claim.ok || !claim.value) {
        throw new Error("CLAIM_NOT_FOUND");
      }

      if (
        claim.value.moderationVisibility !== parsed.data.expectedVisibility ||
        claim.value.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new Error("MODERATION_STATE_CONFLICT");
      }

      const toVisibility = resolveModerationTransition(
        parsed.data.action,
        claim.value.moderationVisibility,
      );
      if (!toVisibility) {
        throw new Error("MODERATION_TRANSITION_INVALID");
      }

      const topic = await getTopicById(tx, claim.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const updated = await updateClaimModerationVisibility(tx, {
        claimId: claim.value.id,
        expectedVisibility: claim.value.moderationVisibility,
        expectedUpdatedAt: claim.value.updatedAt,
        nextVisibility: toVisibility,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("MODERATION_STATE_CONFLICT");
      }

      const privateNotes = parsed.data.privateNotes?.trim()
        ? parsed.data.privateNotes.trim()
        : null;

      const actionRow = await appendModerationAction(tx, {
        topicId: claim.value.topicId,
        claimId: claim.value.id,
        evidenceSubmissionId: null,
        actorAccountId: decision.principal.accountId,
        action: parsed.data.action,
        fromVisibility: claim.value.moderationVisibility,
        toVisibility,
        publicRationale: parsed.data.publicRationale,
        privateNotes,
        synthetic: decision.principal.synthetic,
      });
      if (!actionRow.ok) {
        throw new Error(actionRow.code);
      }

      const auditAction = auditActionFor(parsed.data.action);
      await appendAuthAudit(tx, {
        actorRole: moderationActorRole(decision.principal),
        actorAccountId: decision.principal.accountId,
        action: auditAction,
        subjectType: "claim",
        subjectId: claim.value.id,
        summary: `Claim moderation recorded (${parsed.data.action}).`,
        privatePayload: {
          moderationActionId: actionRow.value.id,
          claimId: claim.value.id,
          topicId: claim.value.topicId,
          capability: "moderation.review_submission",
          actorAccountId: decision.principal.accountId,
          attachedTo: "claim",
          fromVisibility: claim.value.moderationVisibility,
          toVisibility,
          hasPublicRationale: true as const,
          hasPrivateNotes: Boolean(privateNotes),
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { claim: updated.value, action: actionRow.value },
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
 * Hold, hide, or restore an evidence submission. Does not mutate claims or
 * independent workflow/quality/disclosure/revision axes.
 */
export async function moderateEvidence(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    action: ModerationActionKind;
    publicRationale: string;
    privateNotes?: string | null;
    expectedVisibility: ModerationVisibility;
    expectedUpdatedAt: Date | string;
  },
): Promise<
  AdapterResult<{
    evidence: EvidenceSubmissionRecord;
    action: ModerationActionRecord;
  }>
> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = evidenceModerationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid evidence moderation input",
      code: "MODERATION_INPUT_INVALID",
    };
  }

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(
    parsed.data.expectedUpdatedAt,
  );

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "moderation.review_submission",
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
        evidence.value.moderationVisibility !==
          parsed.data.expectedVisibility ||
        evidence.value.updatedAt.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new Error("MODERATION_STATE_CONFLICT");
      }

      const toVisibility = resolveModerationTransition(
        parsed.data.action,
        evidence.value.moderationVisibility,
      );
      if (!toVisibility) {
        throw new Error("MODERATION_TRANSITION_INVALID");
      }

      const topic = await getTopicById(tx, evidence.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const updated = await updateEvidenceModerationVisibility(tx, {
        evidenceSubmissionId: evidence.value.id,
        expectedVisibility: evidence.value.moderationVisibility,
        expectedUpdatedAt: evidence.value.updatedAt,
        nextVisibility: toVisibility,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("MODERATION_STATE_CONFLICT");
      }

      const privateNotes = parsed.data.privateNotes?.trim()
        ? parsed.data.privateNotes.trim()
        : null;

      const actionRow = await appendModerationAction(tx, {
        topicId: evidence.value.topicId,
        claimId: null,
        evidenceSubmissionId: evidence.value.id,
        actorAccountId: decision.principal.accountId,
        action: parsed.data.action,
        fromVisibility: evidence.value.moderationVisibility,
        toVisibility,
        publicRationale: parsed.data.publicRationale,
        privateNotes,
        synthetic: decision.principal.synthetic,
      });
      if (!actionRow.ok) {
        throw new Error(actionRow.code);
      }

      const auditAction = auditActionFor(parsed.data.action);
      await appendAuthAudit(tx, {
        actorRole: moderationActorRole(decision.principal),
        actorAccountId: decision.principal.accountId,
        action: auditAction,
        subjectType: "evidence_submission",
        subjectId: evidence.value.id,
        summary: `Evidence moderation recorded (${parsed.data.action}).`,
        privatePayload: {
          moderationActionId: actionRow.value.id,
          evidenceSubmissionId: evidence.value.id,
          topicId: evidence.value.topicId,
          capability: "moderation.review_submission",
          actorAccountId: decision.principal.accountId,
          attachedTo: "evidence",
          fromVisibility: evidence.value.moderationVisibility,
          toVisibility,
          hasPublicRationale: true as const,
          hasPrivateNotes: Boolean(privateNotes),
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { evidence: updated.value, action: actionRow.value },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    return mapServiceError(message);
  }
}
