import type { AccountLifecycleState } from "@/lib/adapters/types";

export const PLATFORM_ROLES = [
  "participant",
  "reviewer",
  "moderator",
  "administrator",
  "auditor",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const COUNCIL_ROLES = [
  "deliberation_council",
  "policy_council",
] as const;

export type CouncilRole = (typeof COUNCIL_ROLES)[number];

export const CAPABILITIES = [
  "account.read_own",
  "account.sign_out",
  "account.revoke_all_sessions",
  "roles.grant_platform",
  "roles.revoke_platform",
  "roles.grant_council",
  "roles.revoke_council",
  "verification.review_case",
  "onboarding.staff_read",
  "moderation.act",
  "audit.read_restricted",
  "pseudonym.privileged_lookup",
  "account.export_own",
  "account.request_closure",
  "privacy.manage_legal_hold",
  "privacy.execute_closure",
  "privacy.dual_control_request",
  "privacy.dual_control_approve",
  "documents.publish",
  "institutional.vote",
  "institutional.council_deliberation",
  "institutional.council_policy",
  "institutional.publish_decision",
  // Phase 3.3 — topic / claim / evidence / invite (mutations land in later packages)
  "topics.create",
  "topics.update",
  "topics.open",
  "topics.publish",
  "topics.pause",
  "topics.archive",
  "claims.submit",
  "claims.edit_own",
  "claims.withdraw_own",
  "claims.review",
  "evidence.submit",
  "evidence.edit_own",
  "evidence.withdraw_own",
  "evidence.review",
  "conflicts.disclose_own",
  "moderation.review_submission",
  "workspace.search",
  "topics.export_staff",
  "invites.issue",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Environment-operator actions — not account capabilities.
 * Authenticated by OPERATOR_BOOTSTRAP_SECRET (+ label), never by authorizeCapability.
 */
export const OPERATOR_ACTIONS = [
  "operator.bootstrap_administrator",
] as const;

export type OperatorAction = (typeof OPERATOR_ACTIONS)[number];

/** Capabilities whose authorize() decision is role/lifecycle only; ownership is re-checked in the service transaction. */
export const OWNERSHIP_ELIGIBILITY_CAPABILITIES = [
  "claims.edit_own",
  "claims.withdraw_own",
  "evidence.edit_own",
  "evidence.withdraw_own",
  "conflicts.disclose_own",
] as const satisfies readonly Capability[];

export type AuthzPrincipal = {
  accountId: string;
  lifecycleState: AccountLifecycleState;
  synthetic: boolean;
  platformRoles: PlatformRole[];
  councilRoles: CouncilRole[];
};

export type AuthzDecision =
  | { ok: true; principal: AuthzPrincipal }
  | {
      ok: false;
      code: string;
      error: string;
      status: 401 | 403 | 404;
      /** Present when denial is due to missing/expired/revoked assurance. */
      missingKinds?: string[];
      requiredLevel?: string;
    };
