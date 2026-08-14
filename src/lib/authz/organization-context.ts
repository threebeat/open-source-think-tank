import type { AuthzDecision, AuthzPrincipal, Capability } from "@/lib/authz/types";
import {
  ORGANIZATION_CAPABILITIES,
  type OrganizationAppointmentKind,
  type OrganizationCapability,
} from "@/lib/organizations/types";

export type OrganizationAuthzPrincipal = AuthzPrincipal;

const REQUIRED_APPOINTMENT_KINDS: Record<
  OrganizationCapability,
  readonly OrganizationAppointmentKind[]
> = {
  "organization.membership.read": ["organization_admin"],
  "organization.appointment.grant": ["organization_admin"],
  "organization.appointment.revoke": ["organization_admin"],
  "organization.config.publish": ["organization_admin"],
  "organization.governance.transition": [
    "moderator",
    "chamber_clerk",
    "chamber_member",
    "council_clerk",
    "council_member",
  ],
};

function sessionAllowed(principal: AuthzPrincipal): boolean {
  return (
    principal.lifecycleState === "invited" ||
    principal.lifecycleState === "pending_onboarding" ||
    principal.lifecycleState === "active"
  );
}

function deny(capability: OrganizationCapability): AuthzDecision {
  return {
    ok: false,
    status: 403,
    code: "AUTHZ_DENIED",
    error: `Denied capability ${capability}`,
  };
}

export function isOrganizationCapability(
  capability: string,
): capability is OrganizationCapability {
  return (ORGANIZATION_CAPABILITIES as readonly string[]).includes(capability);
}

/**
 * Organization-scoped authorization. Platform administrator, community
 * participant, and legacy council seats never satisfy these capabilities.
 */
export function authorizeOrganization(
  principal: AuthzPrincipal | null | undefined,
  organizationId: string,
  capability: OrganizationCapability,
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
  if (principal.lifecycleState !== "active") {
    return {
      ok: false,
      status: 403,
      code: "AUTHZ_ACTIVE_REQUIRED",
      error: `Capability ${capability} requires an active account`,
    };
  }
  if (!organizationId.trim()) {
    return deny(capability);
  }

  const required = REQUIRED_APPOINTMENT_KINDS[capability];
  const appointments = principal.organizationAppointments ?? [];
  const match = appointments.some(
    (appointment) =>
      appointment.organizationId === organizationId &&
      required.includes(appointment.kind),
  );
  if (!match) {
    return deny(capability);
  }
  return { ok: true, principal };
}

export function organizationCapabilitiesNeverGrantedByPlatform(): Capability[] {
  return [...ORGANIZATION_CAPABILITIES];
}
