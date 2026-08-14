import { describe, expect, it } from "vitest";

import { authorize } from "@/lib/authz/authorize";
import { authorizeOrganization } from "@/lib/authz/organization-context";
import type { AuthzPrincipal } from "@/lib/authz/types";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organizations/types";

function principal(
  overrides: Partial<AuthzPrincipal> = {},
): AuthzPrincipal {
  return {
    accountId: "account-ostt-synth-org-authz",
    lifecycleState: "active",
    synthetic: true,
    platformRoles: [],
    councilRoles: [],
    organizationMemberships: [],
    organizationAppointments: [],
    ...overrides,
  };
}

describe("organization authority matrix", () => {
  it("never grants organization capabilities from platform authorize()", () => {
    const admin = principal({ platformRoles: ["administrator"] });
    const participant = principal({ platformRoles: ["participant"] });
    const deliberation = principal({
      platformRoles: ["participant"],
      councilRoles: ["deliberation_council"],
    });
    for (const capability of ORGANIZATION_CAPABILITIES) {
      expect(authorize(admin, capability).ok).toBe(false);
      expect(authorize(participant, capability).ok).toBe(false);
      expect(authorize(deliberation, capability).ok).toBe(false);
    }
  });

  it("requires a matching organization appointment, not a platform admin", () => {
    const orgA = "org_ostt_synth_alpha_internal";
    const orgB = "org_ostt_synth_beta_internal";
    const admin = principal({ platformRoles: ["administrator"] });
    expect(
      authorizeOrganization(admin, orgA, "organization.appointment.grant").ok,
    ).toBe(false);
    expect(
      authorizeOrganization(admin, orgA, "organization.governance.transition")
        .ok,
    ).toBe(false);

    const orgAdminA = principal({
      organizationAppointments: [
        {
          organizationId: orgA,
          kind: "organization_admin",
          appointmentId: "appt-a",
        },
      ],
    });
    expect(
      authorizeOrganization(orgAdminA, orgA, "organization.appointment.grant")
        .ok,
    ).toBe(true);
    expect(
      authorizeOrganization(orgAdminA, orgB, "organization.appointment.grant")
        .ok,
    ).toBe(false);
    expect(
      authorizeOrganization(
        orgAdminA,
        orgA,
        "organization.governance.transition",
      ).ok,
    ).toBe(false);
  });

  it("does not treat a legacy deliberation_council seat as v2 governance authority", () => {
    const seated = principal({
      platformRoles: ["participant"],
      councilRoles: ["deliberation_council"],
    });
    expect(authorize(seated, "institutional.council_deliberation").ok).toBe(
      true,
    );
    expect(
      authorizeOrganization(
        seated,
        "org_ostt_synth_alpha_internal",
        "organization.governance.transition",
      ).ok,
    ).toBe(false);
  });

  it("allows a moderator appointment to request governance transitions in that org only", () => {
    const orgA = "org_ostt_synth_alpha_internal";
    const moderator = principal({
      organizationAppointments: [
        {
          organizationId: orgA,
          kind: "moderator",
          appointmentId: "appt-mod",
        },
      ],
    });
    expect(
      authorizeOrganization(
        moderator,
        orgA,
        "organization.governance.transition",
      ).ok,
    ).toBe(true);
    expect(
      authorizeOrganization(moderator, orgA, "organization.appointment.grant")
        .ok,
    ).toBe(false);
  });
});
