import { z } from "zod";

/**
 * Discriminated auditable-event registry (WP 2.9 hardening).
 * Unregistered actions are rejected. Public summaries come only from templates.
 */

const looseObject = z.record(z.string(), z.unknown());

export type PublicProjector = (payload: Record<string, unknown>) => string;

export type AuditActionDefinition = {
  action: string;
  description: string;
  highImpact: boolean;
  /** Zod schema for privatePayload (required object; may be empty). */
  payloadSchema: z.ZodType<Record<string, unknown>>;
  /** When set, a registry-owned public summary is emitted (never caller summary). */
  publicProject?: PublicProjector;
  requireActorAccount?: boolean;
  requireReason?: boolean;
};

function def(
  action: string,
  description: string,
  options: {
    highImpact?: boolean;
    payloadSchema?: z.ZodType<Record<string, unknown>>;
    publicProject?: PublicProjector;
    requireActorAccount?: boolean;
    requireReason?: boolean;
  } = {},
): AuditActionDefinition {
  return {
    action,
    description,
    highImpact: options.highImpact ?? true,
    payloadSchema: options.payloadSchema ?? looseObject,
    publicProject: options.publicProject,
    requireActorAccount: options.requireActorAccount,
    requireReason: options.requireReason,
  };
}

const kindPayload = z
  .object({ kind: z.string().optional() })
  .passthrough() as z.ZodType<Record<string, unknown>>;

export const AUDIT_EVENT_REGISTRY: Record<string, AuditActionDefinition> = {
  // Auth
  "auth.invite_accepted": def(
    "auth.invite_accepted",
    "Invitation accepted",
    { requireActorAccount: true },
  ),
  "auth.invite_accept_rejected": def(
    "auth.invite_accept_rejected",
    "Invitation accept rejected",
  ),
  "auth.sign_in_requested": def(
    "auth.sign_in_requested",
    "Sign-in requested",
  ),
  "auth.session_established": def(
    "auth.session_established",
    "Session established",
    { requireActorAccount: true },
  ),
  "auth.sign_out": def("auth.sign_out", "Sign-out", {
    requireActorAccount: true,
  }),
  "auth.revoke_all_sessions": def(
    "auth.revoke_all_sessions",
    "All sessions revoked",
    { requireActorAccount: true },
  ),
  "auth.challenge_issued": def(
    "auth.challenge_issued",
    "Auth challenge issued",
  ),
  "auth.challenge_rejected": def(
    "auth.challenge_rejected",
    "Auth challenge rejected",
  ),
  "auth.challenge_email_sent": def(
    "auth.challenge_email_sent",
    "Challenge email sent",
  ),
  "auth.challenge_email_failed": def(
    "auth.challenge_email_failed",
    "Challenge email failed",
  ),
  "auth.enrolled": def("auth.enrolled", "Open enrollment completed", {
    requireActorAccount: true,
  }),
  "auth.password_sign_in_rejected": def(
    "auth.password_sign_in_rejected",
    "Password sign-in rejected",
  ),
  "auth.test_synthetic_marker": def(
    "auth.test_synthetic_marker",
    "Test-only synthetic marker",
    { highImpact: false },
  ),

  // Authz
  "authz.platform_role_granted": def(
    "authz.platform_role_granted",
    "Platform role granted",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({ role: z.string() })
        .passthrough() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `A platform role (${String(p.role ?? "role")}) was granted.`,
    },
  ),
  "authz.platform_role_revoked": def(
    "authz.platform_role_revoked",
    "Platform role revoked",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({ role: z.string() })
        .passthrough() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `A platform role (${String(p.role ?? "role")}) was revoked.`,
    },
  ),
  "authz.council_seat_granted": def(
    "authz.council_seat_granted",
    "Council seat granted",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({ councilRole: z.string() })
        .passthrough() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `A council seat (${String(p.councilRole ?? "seat")}) was granted.`,
    },
  ),
  "authz.council_seat_revoked": def(
    "authz.council_seat_revoked",
    "Council seat revoked",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({ councilRole: z.string() })
        .passthrough() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `A council seat (${String(p.councilRole ?? "seat")}) was revoked.`,
    },
  ),

  // Phase 3.3 invitations / operator bootstrap (no public projectors — staff-restricted)
  "invites.issued": def("invites.issued", "Invitation issued", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        invitationId: z.string(),
        kind: z.string(),
        expiresAt: z.string(),
        issuerAccountId: z.string().optional(),
      })
      .passthrough() as z.ZodType<Record<string, unknown>>,
  }),
  "operator.bootstrap_invitation_issued": def(
    "operator.bootstrap_invitation_issued",
    "First-administrator bootstrap invitation issued",
    {
      requireReason: true,
      payloadSchema: z
        .object({
          invitationId: z.string(),
          operatorLabel: z.string(),
          expiresAt: z.string(),
        })
        .passthrough() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "operator.bootstrap_verification_recorded": def(
    "operator.bootstrap_verification_recorded",
    "Operator bootstrap verification decision recorded",
    {
      requireReason: true,
      payloadSchema: z
        .object({
          operatorLabel: z.string(),
          decisionSource: z.literal("operator_bootstrap"),
          kind: z.string(),
          accountId: z.string(),
        })
        .passthrough() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "operator.bootstrap_administrator": def(
    "operator.bootstrap_administrator",
    "First administrator bootstrap completed",
    {
      requireReason: true,
      payloadSchema: z
        .object({
          operatorLabel: z.string(),
          accountId: z.string(),
          invitationId: z.string(),
        })
        .passthrough() as z.ZodType<Record<string, unknown>>,
    },
  ),

  // Assent / documents
  "assent.document_draft_created": def(
    "assent.document_draft_created",
    "Document draft created",
    {
      requireActorAccount: true,
      payloadSchema: kindPayload,
      publicProject: (p) =>
        `A draft document was created for kind ${String(p.kind ?? "document")}.`,
    },
  ),
  "assent.document_counsel_reviewed": def(
    "assent.document_counsel_reviewed",
    "Document marked counsel_reviewed",
    { requireActorAccount: true },
  ),
  "assent.document_published": def(
    "assent.document_published",
    "Document published",
    {
      requireActorAccount: true,
      payloadSchema: kindPayload,
      publicProject: (p) =>
        `A document version was published for kind ${String(p.kind ?? "document")}.`,
    },
  ),
  "assent.document_presented": def(
    "assent.document_presented",
    "Document presented for assent",
    { requireActorAccount: true },
  ),
  "assent.recorded": def("assent.recorded", "Assent recorded", {
    requireActorAccount: true,
  }),
  "assent.declined": def("assent.declined", "Document declined", {
    requireActorAccount: true,
  }),
  "assent.withdrawn": def("assent.withdrawn", "Assent withdrawn", {
    requireActorAccount: true,
  }),

  // Verification
  "verification.case_opened": def(
    "verification.case_opened",
    "Verification case opened",
    { requireActorAccount: true, payloadSchema: kindPayload },
  ),
  "verification.reviewer_assigned": def(
    "verification.reviewer_assigned",
    "Verification reviewer assigned",
    { requireActorAccount: true },
  ),
  "verification.reviewer_reassigned": def(
    "verification.reviewer_reassigned",
    "Verification reviewer reassigned",
    { requireActorAccount: true, requireReason: true },
  ),
  "verification.case_approved": def(
    "verification.case_approved",
    "Verification case approved",
    { requireActorAccount: true, requireReason: true, payloadSchema: kindPayload },
  ),
  "verification.case_denied": def(
    "verification.case_denied",
    "Verification case denied",
    { requireActorAccount: true, requireReason: true, payloadSchema: kindPayload },
  ),
  "verification.case_revoked": def(
    "verification.case_revoked",
    "Verification case revoked",
    { requireActorAccount: true, requireReason: true, payloadSchema: kindPayload },
  ),
  "verification.case_appealed": def(
    "verification.case_appealed",
    "Verification case appealed",
    { requireActorAccount: true, requireReason: true },
  ),
  "verification.case_expired": def(
    "verification.case_expired",
    "Verification case expired",
    { highImpact: false, payloadSchema: kindPayload },
  ),
  "verification.artifact_purged": def(
    "verification.artifact_purged",
    "Verification artifact purged",
    { highImpact: false },
  ),

  // Onboarding
  "onboarding.activated": def(
    "onboarding.activated",
    "Account activated after onboarding gates",
    { requireActorAccount: true },
  ),

  // Pseudonyms (2.10)
  "pseudonym.issued": def("pseudonym.issued", "Conversation pseudonym issued", {
    requireActorAccount: true,
    publicProject: () =>
      "A conversation-scoped consultation pseudonym was issued.",
  }),
  "pseudonym.privileged_lookup": def(
    "pseudonym.privileged_lookup",
    "Privileged pseudonym mapping lookup",
    { requireActorAccount: true, requireReason: true },
  ),
  "pseudonym.rotated": def("pseudonym.rotated", "Conversation pseudonym rotated", {
    requireActorAccount: true,
    requireReason: true,
  }),
  "pseudonym.deleted": def("pseudonym.deleted", "Conversation pseudonym deleted", {
    requireActorAccount: true,
    requireReason: true,
  }),

  // Privacy / ops (2.11)
  "privacy.export_generated": def(
    "privacy.export_generated",
    "Account holder data export generated",
    { requireActorAccount: true, highImpact: false },
  ),
  "privacy.closure_requested": def(
    "privacy.closure_requested",
    "Account closure/deletion requested",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.account_closed": def(
    "privacy.account_closed",
    "Account moved to closed without destroying audit/assent",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.legal_hold_placed": def(
    "privacy.legal_hold_placed",
    "Legal hold placed",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.legal_hold_released": def(
    "privacy.legal_hold_released",
    "Legal hold released",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.dual_control_requested": def(
    "privacy.dual_control_requested",
    "Dual-control approval requested",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.dual_control_resolved": def(
    "privacy.dual_control_resolved",
    "Dual-control approval resolved",
    { requireActorAccount: true, requireReason: true },
  ),
  "privacy.retention_job_ran": def(
    "privacy.retention_job_ran",
    "Configurable retention/expiration job ran",
    { highImpact: false },
  ),

  // Foundation
  "foundation.seeded": def("foundation.seeded", "Synthetic foundation seed", {
    highImpact: false,
    publicProject: () => "Synthetic foundation seed applied.",
  }),

  // Topics (3.4 authoring — no public projector for draft/staff actions)
  "topics.created": def("topics.created", "Topic draft created", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.create"),
        previousWorkflowState: z.null(),
        nextWorkflowState: z.literal("draft"),
        actorAccountId: z.string(),
        slug: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "topics.updated": def("topics.updated", "Topic draft metadata updated", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.update"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        changedFields: z.array(z.string()),
        actorAccountId: z.string(),
        expectedUpdatedAt: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "topics.opened": def("topics.opened", "Topic opened for submissions", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.open"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
        expectedWorkflowState: z.string(),
        publicationStatusUnchanged: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "topics.review_started": def(
    "topics.review_started",
    "Topic moved under review",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          topicId: z.string(),
          capability: z.literal("topics.update"),
          previousWorkflowState: z.string(),
          nextWorkflowState: z.string(),
          actorAccountId: z.string(),
          expectedWorkflowState: z.string(),
          publicationStatusUnchanged: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "topics.reopened": def(
    "topics.reopened",
    "Topic reopened for submissions",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          topicId: z.string(),
          capability: z.literal("topics.open"),
          previousWorkflowState: z.string(),
          nextWorkflowState: z.string(),
          actorAccountId: z.string(),
          expectedWorkflowState: z.string(),
          publicationStatusUnchanged: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "topics.paused": def("topics.paused", "Topic paused", {
    requireActorAccount: true,
    requireReason: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.pause"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
        expectedWorkflowState: z.string(),
        publicationStatusUnchanged: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "topics.archived": def("topics.archived", "Topic archived", {
    requireActorAccount: true,
    requireReason: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.archive"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
        expectedWorkflowState: z.string(),
        publicationStatusUnchanged: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),

  // Participant submissions (3.5) — no public projectors for drafts/private disclosure
  "claims.submitted": def("claims.submitted", "Claim submitted", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        evidenceSubmissionId: z.string(),
        capability: z.literal("claims.submit"),
        previousWorkflowState: z.null(),
        nextWorkflowState: z.literal("submitted"),
        actorAccountId: z.string(),
        relationship: z.enum(["supporting", "counterevidence"]),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "claims.updated": def("claims.updated", "Own claim content updated", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        capability: z.literal("claims.edit_own"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "claims.revision_recorded": def(
    "claims.revision_recorded",
    "Claim content revision recorded",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          claimId: z.string(),
          topicId: z.string(),
          revisionNumber: z.number().int().positive(),
          changedFields: z.array(z.string()).min(1),
          capability: z.literal("claims.edit_own"),
          previousWorkflowState: z.string(),
          nextWorkflowState: z.string(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "claims.resubmitted": def("claims.resubmitted", "Claim resubmitted", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        capability: z.literal("claims.submit"),
        previousWorkflowState: z.literal("changes_requested"),
        nextWorkflowState: z.literal("submitted"),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "claims.withdrawn": def("claims.withdrawn", "Claim withdrawn", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        capability: z.literal("claims.withdraw_own"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.literal("withdrawn"),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "evidence.submitted": def(
    "evidence.submitted",
    "Evidence source URL submitted",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          claimId: z.string(),
          capability: z.literal("evidence.submit"),
          previousWorkflowState: z.null(),
          nextWorkflowState: z.literal("submitted"),
          actorAccountId: z.string(),
          sourceUrlHost: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.updated": def("evidence.updated", "Own evidence content updated", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        evidenceSubmissionId: z.string(),
        topicId: z.string(),
        capability: z.literal("evidence.edit_own"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
        sourceUrlHost: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "evidence.revision_recorded": def(
    "evidence.revision_recorded",
    "Evidence content revision recorded",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          revisionNumber: z.number().int().positive(),
          changedFields: z.array(z.string()).min(1),
          capability: z.literal("evidence.edit_own"),
          previousWorkflowState: z.string(),
          nextWorkflowState: z.string(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.resubmitted": def(
    "evidence.resubmitted",
    "Evidence resubmitted",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          capability: z.literal("evidence.submit"),
          previousWorkflowState: z.literal("changes_requested"),
          nextWorkflowState: z.literal("submitted"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.withdrawn": def("evidence.withdrawn", "Evidence withdrawn", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        evidenceSubmissionId: z.string(),
        topicId: z.string(),
        capability: z.literal("evidence.withdraw_own"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.literal("withdrawn"),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "conflicts.disclosed": def(
    "conflicts.disclosed",
    "Conflict disclosure recorded",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          disclosureId: z.string(),
          claimId: z.string().optional(),
          evidenceSubmissionId: z.string().optional(),
          topicId: z.string(),
          capability: z.literal("conflicts.disclose_own"),
          actorAccountId: z.string(),
          disclosureChoice: z.enum(["none", "disclose"]),
          attachedTo: z.enum(["claim", "evidence"]),
        })
        .strict()
        .superRefine((value, ctx) => {
          const hasClaim = Boolean(value.claimId);
          const hasEvidence = Boolean(value.evidenceSubmissionId);
          if (value.attachedTo === "claim" && (!hasClaim || hasEvidence)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Claim disclosure audit requires claimId only",
            });
          }
          if (value.attachedTo === "evidence" && (!hasEvidence || hasClaim)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Evidence disclosure audit requires evidenceSubmissionId only",
            });
          }
        }) as z.ZodType<Record<string, unknown>>,
    },
  ),
  "conflicts.updated": def(
    "conflicts.updated",
    "Conflict disclosure updated",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          disclosureId: z.string(),
          claimId: z.string().optional(),
          evidenceSubmissionId: z.string().optional(),
          topicId: z.string(),
          capability: z.literal("conflicts.disclose_own"),
          actorAccountId: z.string(),
          attachedTo: z.enum(["claim", "evidence"]),
          disclosureChoice: z.enum(["none", "disclose"]),
          changedFieldLabels: z.array(z.string()).min(1),
        })
        .strict()
        .superRefine((value, ctx) => {
          const hasClaim = Boolean(value.claimId);
          const hasEvidence = Boolean(value.evidenceSubmissionId);
          if (value.attachedTo === "claim" && (!hasClaim || hasEvidence)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Claim disclosure audit requires claimId only",
            });
          }
          if (value.attachedTo === "evidence" && (!hasEvidence || hasClaim)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Evidence disclosure audit requires evidenceSubmissionId only",
            });
          }
        }) as z.ZodType<Record<string, unknown>>,
    },
  ),
  "moderation.submission_held": def(
    "moderation.submission_held",
    "Submission held from public visibility",
    {
      requireActorAccount: true,
      highImpact: true,
      payloadSchema: z
        .object({
          moderationActionId: z.string(),
          claimId: z.string().optional(),
          evidenceSubmissionId: z.string().optional(),
          topicId: z.string(),
          capability: z.literal("moderation.review_submission"),
          actorAccountId: z.string(),
          attachedTo: z.enum(["claim", "evidence"]),
          fromVisibility: z.literal("visible"),
          toVisibility: z.literal("held"),
          hasPublicRationale: z.literal(true),
          hasPrivateNotes: z.boolean(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "moderation.submission_hidden": def(
    "moderation.submission_hidden",
    "Submission hidden from public visibility",
    {
      requireActorAccount: true,
      highImpact: true,
      payloadSchema: z
        .object({
          moderationActionId: z.string(),
          claimId: z.string().optional(),
          evidenceSubmissionId: z.string().optional(),
          topicId: z.string(),
          capability: z.literal("moderation.review_submission"),
          actorAccountId: z.string(),
          attachedTo: z.enum(["claim", "evidence"]),
          fromVisibility: z.enum(["visible", "held"]),
          toVisibility: z.literal("hidden"),
          hasPublicRationale: z.literal(true),
          hasPrivateNotes: z.boolean(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "moderation.submission_restored": def(
    "moderation.submission_restored",
    "Submission restored to visible",
    {
      requireActorAccount: true,
      highImpact: true,
      payloadSchema: z
        .object({
          moderationActionId: z.string(),
          claimId: z.string().optional(),
          evidenceSubmissionId: z.string().optional(),
          topicId: z.string(),
          capability: z.literal("moderation.review_submission"),
          actorAccountId: z.string(),
          attachedTo: z.enum(["claim", "evidence"]),
          fromVisibility: z.enum(["held", "hidden"]),
          toVisibility: z.literal("visible"),
          hasPublicRationale: z.literal(true),
          hasPrivateNotes: z.boolean(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),

  // Staff review + publish (3.6) — no public projectors; no body/private notes
  "claims.changes_requested": def(
    "claims.changes_requested",
    "Claim changes requested by reviewer",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          claimId: z.string(),
          topicId: z.string(),
          reviewId: z.string(),
          capability: z.literal("claims.review"),
          previousWorkflowState: z.literal("submitted"),
          nextWorkflowState: z.literal("changes_requested"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "claims.accepted": def("claims.accepted", "Claim accepted by reviewer", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        reviewId: z.string(),
        capability: z.literal("claims.review"),
        previousWorkflowState: z.literal("submitted"),
        nextWorkflowState: z.literal("accepted"),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "claims.rejected": def("claims.rejected", "Claim rejected by reviewer", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        reviewId: z.string(),
        capability: z.literal("claims.review"),
        previousWorkflowState: z.literal("submitted"),
        nextWorkflowState: z.literal("rejected"),
        actorAccountId: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "evidence.changes_requested": def(
    "evidence.changes_requested",
    "Evidence changes requested by reviewer",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          reviewId: z.string(),
          capability: z.literal("evidence.review"),
          previousWorkflowState: z.literal("submitted"),
          nextWorkflowState: z.literal("changes_requested"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.accepted": def(
    "evidence.accepted",
    "Evidence workflow accepted by reviewer",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          reviewId: z.string(),
          capability: z.literal("evidence.review"),
          previousWorkflowState: z.literal("submitted"),
          nextWorkflowState: z.literal("accepted"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.rejected": def(
    "evidence.rejected",
    "Evidence workflow rejected by reviewer",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          reviewId: z.string(),
          capability: z.literal("evidence.review"),
          previousWorkflowState: z.literal("submitted"),
          nextWorkflowState: z.literal("rejected"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "evidence.quality_decided": def(
    "evidence.quality_decided",
    "Evidence quality decided by reviewer",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          reviewId: z.string(),
          capability: z.literal("evidence.review"),
          previousQualityStatus: z.string(),
          nextQualityStatus: z.enum([
            "accepted",
            "limited",
            "disputed",
            "rejected",
          ]),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "topics.published": def("topics.published", "Topic published", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        topicId: z.string(),
        capability: z.literal("topics.publish"),
        previousPublicationStatus: z.literal("unpublished"),
        nextPublicationStatus: z.literal("published"),
        unchangedWorkflowState: z.string(),
        actorAccountId: z.string(),
        readinessSummary: z
          .object({
            acceptedVisibleClaimCount: z.number().int().nonnegative(),
            linkedAcceptedVisibleEvidenceCount: z.number().int().nonnegative(),
            includedClaimIds: z.array(z.string()),
            includedEvidenceIds: z.array(z.string()),
          })
          .strict(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "topics.staff_export_generated": def(
    "topics.staff_export_generated",
    "Staff topic package export generated",
    {
      requireActorAccount: true,
      highImpact: false,
      payloadSchema: z
        .object({
          topicId: z.string(),
          capability: z.literal("topics.export_staff"),
          actorAccountId: z.string(),
          counts: z
            .object({
              claims: z.number().int().nonnegative(),
              evidence: z.number().int().nonnegative(),
              links: z.number().int().nonnegative(),
              revisions: z.number().int().nonnegative(),
            })
            .strict(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),

  // Phase 4.3 — Public Input conversation lifecycle (institutional metadata
  // only: workflow states, capability, account ids, counters. NEVER
  // providerConversationRef, embed URLs, participant ids, votes, or
  // comments — see src/lib/public-input/lifecycle/sanitize-log.ts and
  // docs/phase-4-plan.md §7. No public projectors: consultation lifecycle
  // audit is staff/administrator-only.
  "consultations.created": def(
    "consultations.created",
    "Public Input conversation draft created",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.create"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.marked_ready": def(
    "consultations.marked_ready",
    "Public Input conversation marked ready",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.literal("draft"),
          nextWorkflowState: z.literal("ready"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.opened": def(
    "consultations.opened",
    "Public Input conversation opened",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.literal("ready"),
          nextWorkflowState: z.literal("open"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.commenting_closed": def(
    "consultations.commenting_closed",
    "Public Input conversation commenting closed",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.literal("open"),
          nextWorkflowState: z.literal("commenting_closed"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.voting_closed": def(
    "consultations.voting_closed",
    "Public Input conversation voting closed",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.literal("commenting_closed"),
          nextWorkflowState: z.literal("voting_closed"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.closed": def(
    "consultations.closed",
    "Public Input conversation closed",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.literal("voting_closed"),
          nextWorkflowState: z.literal("closed"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.archived": def(
    "consultations.archived",
    "Public Input conversation archived",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.enum([
            "draft",
            "ready",
            "open",
            "commenting_closed",
            "voting_closed",
            "closed",
          ]),
          nextWorkflowState: z.literal("archived"),
          actorAccountId: z.string(),
          isRecovery: z.literal(false),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.recovery_transition": def(
    "consultations.recovery_transition",
    "Public Input conversation recovery transition (out-of-pipeline correction)",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.transition"),
          previousWorkflowState: z.enum([
            "draft",
            "ready",
            "open",
            "commenting_closed",
            "voting_closed",
            "closed",
            "archived",
          ]),
          nextWorkflowState: z.enum([
            "draft",
            "ready",
            "open",
            "commenting_closed",
            "voting_closed",
            "closed",
            "archived",
          ]),
          actorAccountId: z.string(),
          isRecovery: z.literal(true),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.provider_availability_changed": def(
    "consultations.provider_availability_changed",
    "Public Input provider availability changed",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.set_availability"),
          previousAvailability: z.enum([
            "not_configured",
            "available",
            "degraded",
            "unavailable",
          ]),
          nextAvailability: z.enum([
            "not_configured",
            "available",
            "degraded",
            "unavailable",
          ]),
          unchangedWorkflowState: z.string(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.mapping_attached": def(
    "consultations.mapping_attached",
    "Public Input provider mapping attached (ref never audited)",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.manage_provider_mapping"),
          providerKind: z.enum([
            "none",
            "fixture",
            "polis_hosted",
            "polis_self_hosted",
          ]),
          hasProviderMapping: z.boolean(),
          configurationVersion: z.number().int().positive(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.mapping_rotated": def(
    "consultations.mapping_rotated",
    "Public Input provider mapping rotated (ref never audited)",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.manage_provider_mapping"),
          providerKind: z.enum([
            "none",
            "fixture",
            "polis_hosted",
            "polis_self_hosted",
          ]),
          hasProviderMapping: z.boolean(),
          configurationVersion: z.number().int().positive(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.mapping_removed": def(
    "consultations.mapping_removed",
    "Public Input provider mapping removed",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          capability: z.literal("consultations.manage_provider_mapping"),
          providerKind: z.enum([
            "none",
            "fixture",
            "polis_hosted",
            "polis_self_hosted",
          ]),
          hasProviderMapping: z.boolean(),
          configurationVersion: z.number().int().positive(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),

  // Phase 4.4 — aggregate-only report ingestion + Public Input moderation
  // (institutional metadata only: workflow states, capability, account ids,
  // counts, hashes/policy versions. NEVER raw import bodies, participant
  // rows, vote matrices, xid, tokens, raw URLs, or secrets — see
  // src/lib/public-input/reports/service.ts. No public projectors: report
  // ingest/review/publish and moderation audit is staff/administrator-only.
  "consultations.reports.imported": def(
    "consultations.reports.imported",
    "Public Input aggregate report import validated and stored",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          importId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.import"),
          sourceKind: z.enum(["fixture", "manual_aggregate"]),
          schemaVersion: z.string(),
          canonicalHash: z.string(),
          reportVersion: z.number().int().positive(),
          isIdempotentReplay: z.boolean(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.validated": def(
    "consultations.reports.validated",
    "Public Input aggregate report import passed canonical validation",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          importId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.import"),
          previousWorkflowState: z.literal("imported"),
          nextWorkflowState: z.literal("validated"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.review_started": def(
    "consultations.reports.review_started",
    "Public Input aggregate report moved under review",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.review"),
          previousWorkflowState: z.literal("validated"),
          nextWorkflowState: z.literal("under_review"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.published": def(
    "consultations.reports.published",
    "Public Input aggregate report published",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.publish"),
          previousWorkflowState: z.literal("under_review"),
          nextWorkflowState: z.literal("published"),
          reportVersion: z.number().int().positive(),
          supersededReportId: z.string().nullable(),
          suppressedCellCount: z.number().int().nonnegative(),
          smallCellPolicyVersion: z.string(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.rejected": def(
    "consultations.reports.rejected",
    "Public Input aggregate report rejected",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.review"),
          previousWorkflowState: z.enum(["validated", "under_review"]),
          nextWorkflowState: z.literal("rejected"),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.superseded": def(
    "consultations.reports.superseded",
    "Public Input aggregate report superseded by a newer published version",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          capability: z.literal("consultations.reports.publish"),
          previousWorkflowState: z.literal("published"),
          nextWorkflowState: z.literal("superseded"),
          supersededByReportId: z.string(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.moderation.provider_recorded": def(
    "consultations.moderation.provider_recorded",
    "Provider-side Public Input moderation record recorded (observational only; opaque ref never audited)",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          moderationRecordId: z.string(),
          capability: z.literal("consultations.moderation.record"),
          previousStatus: z.enum(["pending", "accepted", "rejected"]).nullable(),
          nextStatus: z.enum(["pending", "accepted", "rejected"]),
          reasonCode: z.string(),
          hasPrivateNote: z.boolean(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.finding_withheld": def(
    "consultations.reports.finding_withheld",
    "Public Input report finding withheld from public projection",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          findingId: z.string(),
          moderationActionId: z.string(),
          capability: z.literal("consultations.reports.review"),
          previousPublicationStatus: z.enum(["included", "withheld", "superseded"]),
          nextPublicationStatus: z.literal("withheld"),
          hasPublicRationale: z.literal(true),
          hasPrivateNote: z.boolean(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  // Mirrors finding_withheld's payload shape with nextPublicationStatus
  // pinned to "superseded" (4.5A.1) — a newer finding replaced this one,
  // which is distinct from "failed institutional review" (finding_withheld).
  "consultations.reports.finding_superseded": def(
    "consultations.reports.finding_superseded",
    "Public Input report finding superseded in public projection",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          findingId: z.string(),
          moderationActionId: z.string(),
          capability: z.literal("consultations.reports.review"),
          previousPublicationStatus: z.enum(["included", "withheld", "superseded"]),
          nextPublicationStatus: z.literal("superseded"),
          hasPublicRationale: z.literal(true),
          hasPrivateNote: z.boolean(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
  "consultations.reports.finding_included": def(
    "consultations.reports.finding_included",
    "Public Input report finding (re)included in public projection",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          conversationId: z.string(),
          topicId: z.string(),
          reportId: z.string(),
          findingId: z.string(),
          moderationActionId: z.string(),
          capability: z.literal("consultations.reports.review"),
          previousPublicationStatus: z.enum(["included", "withheld", "superseded"]),
          nextPublicationStatus: z.literal("included"),
          hasPrivateNote: z.boolean(),
          actorAccountId: z.string(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),

  "organization.config.published": def(
    "organization.config.published",
    "Organization configuration version published",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          organizationPublicId: z.string(),
          configVersionId: z.string(),
          version: z.number().int().positive(),
          capability: z.literal("organization.config.publish"),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
      publicProject: () =>
        "An organization published a configuration version.",
    },
  ),
  "organization.appointment.granted": def(
    "organization.appointment.granted",
    "Organization appointment granted",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          organizationPublicId: z.string(),
          appointmentKind: z.string(),
          capability: z.literal("organization.appointment.grant"),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `An organization appointment (${String(p.appointmentKind ?? "appointment")}) was granted.`,
    },
  ),
  "organization.appointment.revoked": def(
    "organization.appointment.revoked",
    "Organization appointment revoked",
    {
      requireActorAccount: true,
      requireReason: true,
      payloadSchema: z
        .object({
          organizationPublicId: z.string(),
          capability: z.literal("organization.appointment.revoke"),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
      publicProject: () => "An organization appointment was revoked.",
    },
  ),
  "organization.governance.transitioned": def(
    "organization.governance.transitioned",
    "Topic governance record transitioned",
    {
      requireReason: true,
      payloadSchema: z
        .object({
          organizationPublicId: z.string(),
          fromState: z.string(),
          toState: z.string(),
          governanceAction: z.string(),
          capability: z.literal("organization.governance.transition"),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
      publicProject: (p) =>
        `A topic moved from ${String(p.fromState ?? "state")} to ${String(p.toState ?? "state")}.`,
    },
  ),

  // Phase 3.12 operator alpha reset (CLI-only; no public projector)
  "alpha.reset_executed": def(
    "alpha.reset_executed",
    "Operator alpha datastore reset executed",
    {
      requireReason: true,
      highImpact: true,
      payloadSchema: z
        .object({
          operatorLabel: z.string().min(2),
          databaseFingerprint: z.string().min(8),
          schemaVersion: z.string().min(1),
          sourceCommitSha: z.string().min(1),
          manifestVersion: z.string().min(1),
          manifestHash: z.string().min(16),
          /** Explicit ceremony provenance — never inferred from environment heuristics. */
          receiptProvenance: z.enum(["operational", "synthetic_smoke"]),
          counts: z
            .object({
              before: z.record(z.string(), z.number().int().nonnegative()),
              after: z.record(z.string(), z.number().int().nonnegative()),
            })
            .strict(),
        })
        .strict() as z.ZodType<Record<string, unknown>>,
    },
  ),
};

export type RegisteredAuditAction = keyof typeof AUDIT_EVENT_REGISTRY;

export function getAuditActionDefinition(
  action: string,
): AuditActionDefinition | null {
  return AUDIT_EVENT_REGISTRY[action] ?? null;
}

export function isHighImpactAction(action: string): boolean {
  return getAuditActionDefinition(action)?.highImpact ?? true;
}

export function isRegisteredAuditAction(action: string): boolean {
  return Boolean(AUDIT_EVENT_REGISTRY[action]);
}

export type ValidatedAuditAppend = {
  definition: AuditActionDefinition;
  privatePayload: Record<string, unknown>;
};

export function validateAuditAppend(input: {
  action: string;
  actorAccountId?: string | null;
  reason?: string | null;
  privatePayload?: Record<string, unknown> | null;
}): ValidatedAuditAppend {
  const definition = getAuditActionDefinition(input.action);
  if (!definition) {
    throw new Error(`AUDIT_UNREGISTERED_ACTION:${input.action}`);
  }
  if (definition.requireActorAccount && !input.actorAccountId) {
    throw new Error(`AUDIT_ACTOR_REQUIRED:${input.action}`);
  }
  if (definition.requireReason && !input.reason?.trim()) {
    throw new Error(`AUDIT_REASON_REQUIRED:${input.action}`);
  }
  const parsed = definition.payloadSchema.safeParse(input.privatePayload ?? {});
  if (!parsed.success) {
    throw new Error(
      `AUDIT_PAYLOAD_INVALID:${input.action}:${parsed.error.message}`,
    );
  }
  return { definition, privatePayload: parsed.data };
}
