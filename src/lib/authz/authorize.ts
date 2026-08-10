import type { AuthzDecision, AuthzPrincipal, Capability } from "@/lib/authz/types";

const ACTIVE_ONLY = new Set<Capability>([
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
]);

function hasPlatform(
  principal: AuthzPrincipal,
  roles: AuthzPrincipal["platformRoles"],
): boolean {
  return roles.some((role) => principal.platformRoles.includes(role));
}

function hasCouncil(
  principal: AuthzPrincipal,
  role: AuthzPrincipal["councilRoles"][number],
): boolean {
  return principal.councilRoles.includes(role);
}

function sessionAllowed(principal: AuthzPrincipal): boolean {
  return (
    principal.lifecycleState === "invited" ||
    principal.lifecycleState === "pending_onboarding" ||
    principal.lifecycleState === "active"
  );
}

/**
 * Deny-by-default capability check (docs/capability-matrix.md).
 * Hiding a UI control is never sufficient — call this on the server.
 */
export function authorize(
  principal: AuthzPrincipal | null | undefined,
  capability: Capability,
): AuthzDecision {
  if (!principal) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      error: "Authentication required",
    };
  }

  if (!sessionAllowed(principal)) {
    return {
      ok: false,
      status: 403,
      code: "AUTHZ_ACCOUNT_DISABLED",
      error: "Account cannot exercise capabilities in its current state",
    };
  }

  if (
    ACTIVE_ONLY.has(capability) &&
    principal.lifecycleState !== "active"
  ) {
    return {
      ok: false,
      status: 403,
      code: "AUTHZ_ACTIVE_REQUIRED",
      error: `Capability ${capability} requires an active account`,
    };
  }

  switch (capability) {
    case "account.read_own":
    case "account.sign_out":
    case "account.revoke_all_sessions":
      return { ok: true, principal };

    case "roles.grant_platform":
    case "roles.revoke_platform":
    case "roles.grant_council":
    case "roles.revoke_council":
      if (!hasPlatform(principal, ["administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "verification.review_case":
      if (!hasPlatform(principal, ["reviewer", "administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "onboarding.staff_read":
      if (!hasPlatform(principal, ["reviewer", "administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "moderation.act":
      if (!hasPlatform(principal, ["moderator", "administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "audit.read_restricted":
      if (!hasPlatform(principal, ["auditor", "administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "documents.publish":
      if (!hasPlatform(principal, ["administrator"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "institutional.vote":
      // Administrator never implies participant / voting rights.
      if (!hasPlatform(principal, ["participant"])) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "institutional.council_deliberation":
      if (!hasCouncil(principal, "deliberation_council")) {
        return deny(capability);
      }
      return { ok: true, principal };

    case "institutional.council_policy":
    case "institutional.publish_decision":
      if (!hasCouncil(principal, "policy_council")) {
        return deny(capability);
      }
      return { ok: true, principal };

    default: {
      const _exhaustive: never = capability;
      return {
        ok: false,
        status: 403,
        code: "AUTHZ_UNKNOWN_CAPABILITY",
        error: `Unknown capability ${_exhaustive}`,
      };
    }
  }
}

function deny(capability: Capability): AuthzDecision {
  return {
    ok: false,
    status: 403,
    code: "AUTHZ_DENIED",
    error: `Denied capability ${capability}`,
  };
}
