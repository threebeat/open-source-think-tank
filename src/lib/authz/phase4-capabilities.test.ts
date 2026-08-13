import { describe, expect, it } from "vitest";

import { authorize } from "@/lib/authz/authorize";
import {
  CAPABILITIES,
  type AuthzPrincipal,
  type Capability,
  type PlatformRole,
} from "@/lib/authz/types";
import { CAPABILITY_ASSURANCE } from "@/lib/verification/ladder";
import { isRegisteredAuditAction } from "@/lib/audit/registry";

/**
 * Phase 4.3 — Public Input conversation lifecycle capabilities.
 * Administrator-only; explicitly never granted via moderation.act alone.
 */
const PHASE4_CONSULTATION_CAPABILITIES = [
  "consultations.create",
  "consultations.transition",
  "consultations.manage_provider_mapping",
  "consultations.set_availability",
] as const satisfies readonly Capability[];

function principal(
  roles: PlatformRole[],
  lifecycle: "active" | "pending_onboarding" = "active",
): AuthzPrincipal {
  return {
    accountId: `account-ostt-synth-${roles.join("-") || "none"}`,
    lifecycleState: lifecycle,
    synthetic: true,
    platformRoles: roles,
    councilRoles: [],
  };
}

describe("Phase 4.3 Public Input capability contracts", () => {
  it("registers every consultations.* capability in CAPABILITIES", () => {
    for (const capability of PHASE4_CONSULTATION_CAPABILITIES) {
      expect(CAPABILITIES).toContain(capability);
    }
  });

  it.each(PHASE4_CONSULTATION_CAPABILITIES)(
    "%s is administrator-only",
    (capability) => {
      expect(authorize(principal(["administrator"]), capability).ok).toBe(
        true,
      );
      for (const role of [
        "participant",
        "reviewer",
        "moderator",
        "auditor",
      ] as const) {
        const decision = authorize(principal([role]), capability);
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.code).toBe("AUTHZ_DENIED");
        }
      }
    },
  );

  it("moderators never gain consultation capabilities merely from moderation.act", () => {
    const moderator = principal(["moderator"]);
    expect(authorize(moderator, "moderation.act").ok).toBe(true);
    for (const capability of PHASE4_CONSULTATION_CAPABILITIES) {
      expect(authorize(moderator, capability).ok).toBe(false);
    }
  });

  it.each(PHASE4_CONSULTATION_CAPABILITIES)(
    "%s requires an active lifecycle state",
    (capability) => {
      const pending = authorize(
        principal(["administrator"], "pending_onboarding"),
        capability,
      );
      expect(pending.ok).toBe(false);
      if (!pending.ok) {
        expect(pending.code).toBe("AUTHZ_ACTIVE_REQUIRED");
      }
    },
  );

  it.each(PHASE4_CONSULTATION_CAPABILITIES)(
    "%s has an explicit L3 assurance decision",
    (capability) => {
      expect(CAPABILITY_ASSURANCE[capability]).toBe("L3_uniqueness");
    },
  );

  it("registers 4.3 consultation lifecycle audit actions without public projectors", () => {
    for (const action of [
      "consultations.created",
      "consultations.marked_ready",
      "consultations.opened",
      "consultations.commenting_closed",
      "consultations.voting_closed",
      "consultations.closed",
      "consultations.archived",
      "consultations.provider_availability_changed",
      "consultations.recovery_transition",
      "consultations.mapping_attached",
      "consultations.mapping_rotated",
      "consultations.mapping_removed",
    ]) {
      expect(isRegisteredAuditAction(action)).toBe(true);
    }
  });

  it("does not grant consultation capabilities to an unauthenticated principal", () => {
    for (const capability of PHASE4_CONSULTATION_CAPABILITIES) {
      const decision = authorize(null, capability);
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.code).toBe("AUTH_REQUIRED");
      }
    }
  });
});
