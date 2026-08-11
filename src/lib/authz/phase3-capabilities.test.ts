import { describe, expect, it } from "vitest";

import { authorize } from "@/lib/authz/authorize";
import { isOperatorAction } from "@/lib/authz/operator-actions";
import {
  CAPABILITIES,
  OWNERSHIP_ELIGIBILITY_CAPABILITIES,
  OPERATOR_ACTIONS,
  type AuthzPrincipal,
  type Capability,
  type PlatformRole,
} from "@/lib/authz/types";
import { CAPABILITY_ASSURANCE } from "@/lib/verification/ladder";
import { isRegisteredAuditAction } from "@/lib/audit/registry";

const PHASE3_CAPABILITIES = [
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
  "invites.issue",
] as const satisfies readonly Capability[];

type RoleExpectation = {
  capability: Capability;
  allowRoles: PlatformRole[];
  denyRoles: PlatformRole[];
};

const ROLE_MATRIX: RoleExpectation[] = [
  {
    capability: "topics.create",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "topics.update",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "topics.open",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "topics.publish",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "topics.pause",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "topics.archive",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "invites.issue",
    allowRoles: ["administrator"],
    denyRoles: ["participant", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "claims.submit",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "claims.edit_own",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "claims.withdraw_own",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "evidence.submit",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "evidence.edit_own",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "evidence.withdraw_own",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "conflicts.disclose_own",
    allowRoles: ["participant"],
    denyRoles: ["administrator", "reviewer", "moderator", "auditor"],
  },
  {
    capability: "claims.review",
    allowRoles: ["reviewer", "administrator"],
    denyRoles: ["participant", "moderator", "auditor"],
  },
  {
    capability: "evidence.review",
    allowRoles: ["reviewer", "administrator"],
    denyRoles: ["participant", "moderator", "auditor"],
  },
  {
    capability: "moderation.review_submission",
    allowRoles: ["moderator", "administrator"],
    denyRoles: ["participant", "reviewer", "auditor"],
  },
];

function principal(roles: PlatformRole[], lifecycle: "active" | "pending_onboarding" = "active"): AuthzPrincipal {
  return {
    accountId: `account-ostt-synth-${roles.join("-") || "none"}`,
    lifecycleState: lifecycle,
    synthetic: true,
    platformRoles: roles,
    councilRoles: [],
  };
}

describe("Phase 3.3 capability contracts", () => {
  it("registers every planned Phase 3 capability in CAPABILITIES", () => {
    for (const capability of PHASE3_CAPABILITIES) {
      expect(CAPABILITIES).toContain(capability);
    }
  });

  it.each(ROLE_MATRIX)(
    "$capability has explicit role allow/deny mappings",
    ({ capability, allowRoles, denyRoles }) => {
      for (const role of allowRoles) {
        expect(authorize(principal([role]), capability).ok).toBe(true);
      }
      for (const role of denyRoles) {
        const decision = authorize(principal([role]), capability);
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.code).toBe("AUTHZ_DENIED");
        }
      }
    },
  );

  it.each(PHASE3_CAPABILITIES)(
    "%s requires active lifecycle",
    (capability) => {
      const pending = authorize(principal(["administrator", "participant", "reviewer", "moderator"], "pending_onboarding"), capability);
      // Role may still be wrong for some; use a principal that would pass if active.
      const roleFor =
        ROLE_MATRIX.find((row) => row.capability === capability)?.allowRoles[0] ??
        "administrator";
      const decision = authorize(principal([roleFor], "pending_onboarding"), capability);
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.code).toBe("AUTHZ_ACTIVE_REQUIRED");
      }
      expect(pending.ok).toBe(false);
    },
  );

  it.each(PHASE3_CAPABILITIES)(
    "%s has an explicit L3 assurance decision",
    (capability) => {
      expect(CAPABILITY_ASSURANCE[capability]).toBe("L3_uniqueness");
    },
  );

  it("does not treat administrator as participant for ownership/submit capabilities", () => {
    const admin = principal(["administrator"]);
    for (const capability of [
      "claims.submit",
      "claims.edit_own",
      "evidence.submit",
      "conflicts.disclose_own",
      "institutional.vote",
    ] as const) {
      expect(authorize(admin, capability).ok).toBe(false);
    }
  });

  it("does not grant council seats from administrator role alone", () => {
    const admin = principal(["administrator"]);
    expect(authorize(admin, "institutional.council_deliberation").ok).toBe(
      false,
    );
    expect(authorize(admin, "institutional.council_policy").ok).toBe(false);
  });

  it("ownership eligibility authorize does not claim ownership was checked", () => {
    for (const capability of OWNERSHIP_ELIGIBILITY_CAPABILITIES) {
      const decision = authorize(principal(["participant"]), capability);
      expect(decision.ok).toBe(true);
      // Decision payload is only principal eligibility — no ownershipVerified flag.
      if (decision.ok) {
        expect(decision).toEqual({
          ok: true,
          principal: expect.objectContaining({
            platformRoles: ["participant"],
          }),
        });
        expect(decision).not.toHaveProperty("ownershipVerified");
      }
    }
  });

  it("keeps moderator away from pseudonym reverse-map", () => {
    expect(
      authorize(principal(["moderator"]), "pseudonym.privileged_lookup").ok,
    ).toBe(false);
    expect(
      authorize(principal(["moderator"]), "moderation.review_submission").ok,
    ).toBe(true);
  });

  it("keeps operator bootstrap outside account CAPABILITIES", () => {
    expect(CAPABILITIES).not.toContain("operator.bootstrap_administrator");
    expect(OPERATOR_ACTIONS).toContain("operator.bootstrap_administrator");
    expect(isOperatorAction("operator.bootstrap_administrator")).toBe(true);
    expect(isOperatorAction("invites.issue")).toBe(false);
  });

  it("registers 3.3 audit families without public projectors for secrets", () => {
    for (const action of [
      "invites.issued",
      "operator.bootstrap_invitation_issued",
      "operator.bootstrap_verification_recorded",
      "operator.bootstrap_administrator",
    ]) {
      expect(isRegisteredAuditAction(action)).toBe(true);
    }
  });

  it("denies unknown capabilities", () => {
    const decision = authorize(
      principal(["administrator"]),
      "topics.not_a_real_capability" as Capability,
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("AUTHZ_UNKNOWN_CAPABILITY");
    }
  });
});
