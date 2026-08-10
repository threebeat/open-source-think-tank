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
  "documents.publish",
  "institutional.vote",
  "institutional.council_deliberation",
  "institutional.council_policy",
  "institutional.publish_decision",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

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
