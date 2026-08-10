import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  councilAppointments,
  persons,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  grantCouncilSeat,
  grantPlatformRole,
} from "@/lib/authz/role-changes";
import {
  CAPABILITIES,
  type AuthzPrincipal,
  type Capability,
} from "@/lib/authz/types";
import { newEntityId } from "@/lib/auth/tokens";

async function insertAccount(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  input: {
    id: string;
    lifecycle: "pending_onboarding" | "active";
    roles?: Array<"participant" | "reviewer" | "moderator" | "administrator" | "auditor">;
    councils?: Array<"deliberation_council" | "policy_council">;
  },
) {
  const personId = newEntityId("person");
  await db.insert(persons).values({
    id: personId,
    synthetic: true,
    displayLabel: `ostt-synth ${input.id}`,
  });
  await db.insert(accounts).values({
    id: input.id,
    personId,
    contactChannel: `${input.id}@ostt.synth.test`,
    lifecycleState: input.lifecycle,
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt:
      input.lifecycle === "active"
        ? new Date("2026-08-02T00:00:00.000Z")
        : null,
  });
  for (const role of input.roles ?? []) {
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: input.id,
      role,
      grantedByLabel: "ostt-synth-authz-test",
      reason: "Synthetic capability matrix fixture.",
    });
  }
  for (const councilRole of input.councils ?? []) {
    await db.insert(councilAppointments).values({
      id: newEntityId("council"),
      accountId: input.id,
      councilRole,
      selectionPath: "Synthetic authz fixture path.",
      termStartsOn: new Date("2026-08-01T00:00:00.000Z"),
    });
  }
}

describe("authorization capability matrix", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    await insertAccount(db, {
      id: "account-ostt-synth-admin",
      lifecycle: "active",
      roles: ["administrator", "participant"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-participant",
      lifecycle: "active",
      roles: ["participant"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-reviewer",
      lifecycle: "active",
      roles: ["reviewer"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-moderator",
      lifecycle: "active",
      roles: ["moderator"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-auditor",
      lifecycle: "active",
      roles: ["auditor"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-deliberation",
      lifecycle: "active",
      roles: ["participant"],
      councils: ["deliberation_council"],
    });
    await insertAccount(db, {
      id: "account-ostt-synth-policy",
      lifecycle: "active",
      roles: ["participant"],
      councils: ["policy_council"],
    });
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  async function principal(accountId: string): Promise<AuthzPrincipal> {
    const loaded = await loadPrincipal(db, accountId);
    if (!loaded) {
      throw new Error(`missing principal ${accountId}`);
    }
    return loaded;
  }

  it("denies by default when unauthenticated", () => {
    for (const capability of CAPABILITIES) {
      const decision = authorize(null, capability);
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.status).toBe(401);
      }
    }
  });

  it("denies active-only capabilities to pending_onboarding", async () => {
    const pending = await principal("account-ostt-synth-ada");
    expect(pending.lifecycleState).toBe("pending_onboarding");
    const activeOnly: Capability[] = [
      "institutional.vote",
      "institutional.council_deliberation",
      "institutional.council_policy",
      "institutional.publish_decision",
      "verification.review_case",
      "moderation.act",
      "audit.read_restricted",
      "roles.grant_platform",
      "roles.grant_council",
    ];
    for (const capability of activeOnly) {
      const decision = authorize(pending, capability);
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.code).toBe("AUTHZ_ACTIVE_REQUIRED");
      }
    }
    expect(authorize(pending, "account.read_own").ok).toBe(true);
  });

  it("allows each role its positive capabilities and denies the others", async () => {
    const cases: Array<{
      accountId: string;
      allow: Capability[];
      deny: Capability[];
    }> = [
      {
        accountId: "account-ostt-synth-participant",
        allow: ["institutional.vote", "account.read_own"],
        deny: [
          "verification.review_case",
          "moderation.act",
          "audit.read_restricted",
          "roles.grant_platform",
          "institutional.council_deliberation",
          "institutional.council_policy",
        ],
      },
      {
        accountId: "account-ostt-synth-reviewer",
        allow: ["verification.review_case"],
        deny: ["moderation.act", "roles.grant_platform", "institutional.vote"],
      },
      {
        accountId: "account-ostt-synth-moderator",
        allow: ["moderation.act"],
        deny: ["verification.review_case", "audit.read_restricted"],
      },
      {
        accountId: "account-ostt-synth-auditor",
        allow: ["audit.read_restricted"],
        deny: ["moderation.act", "roles.grant_council"],
      },
      {
        accountId: "account-ostt-synth-admin",
        allow: [
          "roles.grant_platform",
          "roles.grant_council",
          "verification.review_case",
          "moderation.act",
          "audit.read_restricted",
          "institutional.vote",
        ],
        deny: [
          "institutional.council_deliberation",
          "institutional.council_policy",
        ],
      },
      {
        accountId: "account-ostt-synth-deliberation",
        allow: ["institutional.council_deliberation"],
        deny: [
          "institutional.council_policy",
          "institutional.publish_decision",
        ],
      },
      {
        accountId: "account-ostt-synth-policy",
        allow: [
          "institutional.council_policy",
          "institutional.publish_decision",
        ],
        deny: ["institutional.council_deliberation"],
      },
    ];

    for (const entry of cases) {
      const p = await principal(entry.accountId);
      for (const capability of entry.allow) {
        expect(
          authorize(p, capability).ok,
          `${entry.accountId} should allow ${capability}`,
        ).toBe(true);
      }
      for (const capability of entry.deny) {
        expect(
          authorize(p, capability).ok,
          `${entry.accountId} should deny ${capability}`,
        ).toBe(false);
      }
    }
  });

  it("keeps deliberation and policy council authority independent", async () => {
    const bothPath = await principal("account-ostt-synth-ada");
    // Seed gives ada both seats but pending_onboarding → still denied.
    expect(bothPath.councilRoles).toEqual(
      expect.arrayContaining([
        "deliberation_council",
        "policy_council",
      ]),
    );
    expect(authorize(bothPath, "institutional.council_deliberation").ok).toBe(
      false,
    );

    const deliberation = await principal("account-ostt-synth-deliberation");
    const policy = await principal("account-ostt-synth-policy");
    expect(authorize(deliberation, "institutional.council_policy").ok).toBe(
      false,
    );
    expect(authorize(policy, "institutional.council_deliberation").ok).toBe(
      false,
    );
  });

  it("requires reason and blocks silent self-elevation", async () => {
    const shortReason = await grantPlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "reviewer",
      reason: "short",
    });
    expect(shortReason.ok).toBe(false);

    const selfAdmin = await grantPlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-admin",
      role: "administrator",
      reason: "Attempting silent self-grant of administrator.",
    });
    expect(selfAdmin.ok).toBe(false);
    if (!selfAdmin.ok) {
      expect(selfAdmin.code).toBe("AUTHZ_SELF_ELEVATION_FORBIDDEN");
    }

    const selfCouncil = await grantCouncilSeat(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-admin",
      councilRole: "policy_council",
      reason: "Attempting silent self-grant of policy council.",
      selectionPath: "Should fail.",
    });
    expect(selfCouncil.ok).toBe(false);
    if (!selfCouncil.ok) {
      expect(selfCouncil.code).toBe("AUTHZ_SELF_ELEVATION_FORBIDDEN");
    }

    const granted = await grantPlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "reviewer",
      reason: "Grant reviewer for synthetic matrix coverage.",
    });
    expect(granted.ok).toBe(true);

    const councilGranted = await grantCouncilSeat(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      councilRole: "deliberation_council",
      reason: "Grant deliberation seat for synthetic matrix coverage.",
      selectionPath: "Synthetic selection path for authz tests.",
    });
    expect(councilGranted.ok).toBe(true);

    const participant = await principal("account-ostt-synth-participant");
    expect(participant.platformRoles).toContain("reviewer");
    expect(participant.councilRoles).toContain("deliberation_council");
    expect(authorize(participant, "verification.review_case").ok).toBe(true);
    expect(authorize(participant, "institutional.council_deliberation").ok).toBe(
      true,
    );
    expect(authorize(participant, "institutional.council_policy").ok).toBe(
      false,
    );
  });
});
