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
  "claims.resubmitted": def("claims.resubmitted", "Claim resubmitted", {
    requireActorAccount: true,
    payloadSchema: z
      .object({
        claimId: z.string(),
        topicId: z.string(),
        evidenceSubmissionId: z.string(),
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
        evidenceSubmissionId: z.string(),
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
        claimId: z.string(),
        capability: z.literal("evidence.edit_own"),
        previousWorkflowState: z.string(),
        nextWorkflowState: z.string(),
        actorAccountId: z.string(),
        sourceUrlHost: z.string(),
      })
      .strict() as z.ZodType<Record<string, unknown>>,
  }),
  "evidence.resubmitted": def(
    "evidence.resubmitted",
    "Evidence resubmitted",
    {
      requireActorAccount: true,
      payloadSchema: z
        .object({
          evidenceSubmissionId: z.string(),
          topicId: z.string(),
          claimId: z.string(),
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
        claimId: z.string(),
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
          claimId: z.string(),
          topicId: z.string(),
          capability: z.literal("conflicts.disclose_own"),
          actorAccountId: z.string(),
          disclosureChoice: z.enum(["none", "disclose"]),
          attachedTo: z.literal("claim"),
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
