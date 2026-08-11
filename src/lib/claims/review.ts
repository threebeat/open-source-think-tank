import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import {
  appendClaimReview,
  getClaimById,
  type ClaimRecord,
  type ClaimReviewDecision,
  type ClaimReviewRecord,
  updateClaimWorkflow,
} from "@/lib/claims/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

const MIN_RATIONALE = 8;
const MAX_RATIONALE = 4000;
const MAX_PRIVATE_NOTES = 4000;

const reviewInputSchema = z.object({
  claimId: z.string().min(1),
  decision: z.enum(["changes_requested", "accepted", "rejected"]),
  publicRationale: z.string().trim().min(MIN_RATIONALE).max(MAX_RATIONALE),
  privateNotes: z
    .string()
    .trim()
    .max(MAX_PRIVATE_NOTES)
    .optional()
    .nullable(),
  expectedWorkflowState: z.literal("submitted"),
});

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Claim review unavailable in public-demo mode",
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

function auditActionFor(
  decision: ClaimReviewDecision,
): "claims.changes_requested" | "claims.accepted" | "claims.rejected" {
  switch (decision) {
    case "changes_requested":
      return "claims.changes_requested";
    case "accepted":
      return "claims.accepted";
    case "rejected":
      return "claims.rejected";
  }
}

/**
 * Initial claim workflow review: submitted → changes_requested | accepted | rejected.
 * Appends an immutable review row, updates only claim workflow, and audits atomically.
 * Does not alter evidence, topic workflow/publication, or moderation visibility.
 */
export async function reviewClaim(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    decision: ClaimReviewDecision;
    publicRationale: string;
    privateNotes?: string | null;
    expectedWorkflowState: "submitted";
  },
): Promise<
  AdapterResult<{ claim: ClaimRecord; review: ClaimReviewRecord }>
> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid claim review input",
      code: "CLAIM_REVIEW_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "claims.review",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const claim = await getClaimById(tx, parsed.data.claimId);
      if (!claim.ok || !claim.value) {
        throw new Error("CLAIM_NOT_FOUND");
      }
      if (claim.value.workflowState !== "submitted") {
        throw new Error("CLAIM_REVIEW_SOURCE_STATE");
      }

      const topic = await getTopicById(tx, claim.value.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const review = await appendClaimReview(tx, {
        claimId: claim.value.id,
        reviewerAccountId: decision.principal.accountId,
        decision: parsed.data.decision,
        publicRationale: parsed.data.publicRationale,
        privateNotes: parsed.data.privateNotes?.trim()
          ? parsed.data.privateNotes.trim()
          : null,
        synthetic: decision.principal.synthetic,
      });
      if (!review.ok) {
        throw new Error(review.code);
      }

      const updated = await updateClaimWorkflow(tx, {
        claimId: claim.value.id,
        expectedWorkflowState: "submitted",
        nextWorkflowState: parsed.data.decision,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("CLAIM_STATE_CONFLICT");
      }

      const action = auditActionFor(parsed.data.decision);
      await appendAuthAudit(tx, {
        actorRole: reviewActorRole(decision.principal),
        actorAccountId: decision.principal.accountId,
        action,
        subjectType: "claim",
        subjectId: claim.value.id,
        summary: `Claim review recorded (${parsed.data.decision}).`,
        privatePayload: {
          claimId: claim.value.id,
          topicId: claim.value.topicId,
          reviewId: review.value.id,
          capability: "claims.review",
          previousWorkflowState: "submitted",
          nextWorkflowState: parsed.data.decision,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: { claim: updated.value, review: review.value },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "CLAIM_NOT_FOUND") {
      return {
        ok: false,
        error: "Claim not found",
        code: "CLAIM_NOT_FOUND",
      };
    }
    if (message === "TOPIC_NOT_FOUND") {
      return {
        ok: false,
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
      };
    }
    if (message === "CLAIM_REVIEW_SOURCE_STATE") {
      return {
        ok: false,
        error: "Only submitted claims can receive an initial review decision",
        code: "CLAIM_REVIEW_SOURCE_STATE",
      };
    }
    if (message === "CLAIM_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Claim changed; reload and retry",
        code: "CLAIM_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Claim review failed",
      code: "CLAIM_REVIEW_FAILED",
    };
  }
}
