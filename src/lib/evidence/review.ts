import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import type { SubmissionWorkflowState } from "@/lib/claims/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  appendEvidenceReview,
  getEvidenceSubmissionById,
  type EvidenceQualityStatus,
  type EvidenceReviewRecord,
  type EvidenceSubmissionRecord,
  updateEvidenceQuality,
  updateEvidenceWorkflow,
} from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

const MIN_RATIONALE = 8;
const MAX_RATIONALE = 4000;
const MAX_PRIVATE_NOTES = 4000;

const workflowDecisionSchema = z.enum([
  "changes_requested",
  "accepted",
  "rejected",
]);

const qualityDecisionSchema = z.enum([
  "accepted",
  "limited",
  "disputed",
  "rejected",
]);

const workflowInputSchema = z.object({
  evidenceSubmissionId: z.string().min(1),
  decision: workflowDecisionSchema,
  publicRationale: z.string().trim().min(MIN_RATIONALE).max(MAX_RATIONALE),
  privateNotes: z
    .string()
    .trim()
    .max(MAX_PRIVATE_NOTES)
    .optional()
    .nullable(),
  expectedWorkflowState: z.literal("submitted"),
});

const qualityInputSchema = z.object({
  evidenceSubmissionId: z.string().min(1),
  qualityStatus: qualityDecisionSchema,
  publicRationale: z.string().trim().min(MIN_RATIONALE).max(MAX_RATIONALE),
  privateNotes: z
    .string()
    .trim()
    .max(MAX_PRIVATE_NOTES)
    .optional()
    .nullable(),
  expectedQualityStatus: z.enum([
    "pending",
    "accepted",
    "limited",
    "disputed",
    "rejected",
  ]),
});

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Evidence review unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_REVIEW",
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

function reviewActorRole(principal: AuthzPrincipal): string {
  if (principal.platformRoles.includes("administrator")) {
    return "administrator";
  }
  return "reviewer";
}

function workflowAuditAction(
  decision: "changes_requested" | "accepted" | "rejected",
):
  | "evidence.changes_requested"
  | "evidence.accepted"
  | "evidence.rejected" {
  switch (decision) {
    case "changes_requested":
      return "evidence.changes_requested";
    case "accepted":
      return "evidence.accepted";
    case "rejected":
      return "evidence.rejected";
  }
}

/**
 * Evidence workflow review: submitted → changes_requested | accepted | rejected.
 * Does not change quality_status.
 */
export async function reviewEvidenceWorkflow(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    decision: "changes_requested" | "accepted" | "rejected";
    publicRationale: string;
    privateNotes?: string | null;
    expectedWorkflowState: "submitted";
  },
): Promise<
  AdapterResult<{
    evidence: EvidenceSubmissionRecord;
    review: EvidenceReviewRecord;
  }>
> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = workflowInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid evidence workflow review input",
      code: "EVIDENCE_REVIEW_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "evidence.review",
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
      if (evidence.value.workflowState !== "submitted") {
        throw new Error("EVIDENCE_REVIEW_SOURCE_STATE");
      }

      const topic = await getTopicById(tx, evidence.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const priorQuality = evidence.value.qualityStatus;
      const workflowDecision = parsed.data
        .decision as SubmissionWorkflowState;

      const review = await appendEvidenceReview(tx, {
        evidenceSubmissionId: evidence.value.id,
        reviewerAccountId: decision.principal.accountId,
        decision: parsed.data.decision,
        publicRationale: parsed.data.publicRationale,
        qualityStatus: null,
        workflowDecision,
        privateNotes: parsed.data.privateNotes?.trim()
          ? parsed.data.privateNotes.trim()
          : null,
        synthetic: decision.principal.synthetic,
      });
      if (!review.ok) {
        throw new Error(review.code);
      }

      const updated = await updateEvidenceWorkflow(tx, {
        evidenceSubmissionId: evidence.value.id,
        expectedWorkflowState: "submitted",
        nextWorkflowState: parsed.data.decision,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("EVIDENCE_STATE_CONFLICT");
      }
      if (updated.value.qualityStatus !== priorQuality) {
        throw new Error("EVIDENCE_QUALITY_SIDE_EFFECT");
      }

      await appendAuthAudit(tx, {
        actorRole: reviewActorRole(decision.principal),
        actorAccountId: decision.principal.accountId,
        action: workflowAuditAction(parsed.data.decision),
        subjectType: "evidence_submission",
        subjectId: evidence.value.id,
        summary: `Evidence workflow review recorded (${parsed.data.decision}).`,
        privatePayload: {
          evidenceSubmissionId: evidence.value.id,
          topicId: evidence.value.topicId,
          reviewId: review.value.id,
          capability: "evidence.review",
          previousWorkflowState: "submitted",
          nextWorkflowState: parsed.data.decision,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { evidence: updated.value, review: review.value },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "EVIDENCE_NOT_FOUND") {
      return {
        ok: false,
        error: "Evidence submission not found",
        code: "EVIDENCE_NOT_FOUND",
      };
    }
    if (message === "TOPIC_NOT_FOUND") {
      return {
        ok: false,
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
      };
    }
    if (message === "EVIDENCE_REVIEW_SOURCE_STATE") {
      return {
        ok: false,
        error:
          "Only submitted evidence can receive an initial workflow review decision",
        code: "EVIDENCE_REVIEW_SOURCE_STATE",
      };
    }
    if (message === "EVIDENCE_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Evidence changed; reload and retry",
        code: "EVIDENCE_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Evidence workflow review failed",
      code: "EVIDENCE_REVIEW_FAILED",
    };
  }
}

/**
 * Independent evidence quality decision. Does not change workflow_state.
 * `pending` is not a reviewer choice for completing review.
 */
export async function decideEvidenceQuality(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    qualityStatus: Exclude<EvidenceQualityStatus, "pending">;
    publicRationale: string;
    privateNotes?: string | null;
    expectedQualityStatus: EvidenceQualityStatus;
  },
): Promise<
  AdapterResult<{
    evidence: EvidenceSubmissionRecord;
    review: EvidenceReviewRecord;
  }>
> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = qualityInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid evidence quality decision input",
      code: "EVIDENCE_QUALITY_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "evidence.review",
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
      if (evidence.value.qualityStatus !== parsed.data.expectedQualityStatus) {
        throw new Error("EVIDENCE_QUALITY_CONFLICT");
      }

      const topic = await getTopicById(tx, evidence.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const priorWorkflow = evidence.value.workflowState;

      const review = await appendEvidenceReview(tx, {
        evidenceSubmissionId: evidence.value.id,
        reviewerAccountId: decision.principal.accountId,
        decision: "quality_decided",
        publicRationale: parsed.data.publicRationale,
        qualityStatus: parsed.data.qualityStatus,
        workflowDecision: null,
        privateNotes: parsed.data.privateNotes?.trim()
          ? parsed.data.privateNotes.trim()
          : null,
        synthetic: decision.principal.synthetic,
      });
      if (!review.ok) {
        throw new Error(review.code);
      }

      const updated = await updateEvidenceQuality(tx, {
        evidenceSubmissionId: evidence.value.id,
        expectedQualityStatus: parsed.data.expectedQualityStatus,
        nextQualityStatus: parsed.data.qualityStatus,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("EVIDENCE_QUALITY_CONFLICT");
      }
      if (updated.value.workflowState !== priorWorkflow) {
        throw new Error("EVIDENCE_WORKFLOW_SIDE_EFFECT");
      }

      await appendAuthAudit(tx, {
        actorRole: reviewActorRole(decision.principal),
        actorAccountId: decision.principal.accountId,
        action: "evidence.quality_decided",
        subjectType: "evidence_submission",
        subjectId: evidence.value.id,
        summary: `Evidence quality decided (${parsed.data.qualityStatus}).`,
        privatePayload: {
          evidenceSubmissionId: evidence.value.id,
          topicId: evidence.value.topicId,
          reviewId: review.value.id,
          capability: "evidence.review",
          previousQualityStatus: parsed.data.expectedQualityStatus,
          nextQualityStatus: parsed.data.qualityStatus,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { evidence: updated.value, review: review.value },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "EVIDENCE_NOT_FOUND") {
      return {
        ok: false,
        error: "Evidence submission not found",
        code: "EVIDENCE_NOT_FOUND",
      };
    }
    if (message === "TOPIC_NOT_FOUND") {
      return {
        ok: false,
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
      };
    }
    if (message === "EVIDENCE_QUALITY_CONFLICT") {
      return {
        ok: false,
        error: "Evidence quality changed; reload and retry",
        code: "EVIDENCE_QUALITY_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Evidence quality decision failed",
      code: "EVIDENCE_QUALITY_FAILED",
    };
  }
}
