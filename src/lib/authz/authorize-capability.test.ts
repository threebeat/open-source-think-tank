import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, persons, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { Capability } from "@/lib/authz/types";
import { CAPABILITY_ASSURANCE } from "@/lib/verification/ladder";
import {
  L2_KINDS,
  L3_KINDS,
  L4_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";
import { ASSURANCE_LEVELS } from "@/lib/verification/ladder";

async function insertActive(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  id: string,
  roles: Array<
    "participant" | "reviewer" | "moderator" | "administrator" | "auditor"
  >,
  councils?: Array<"deliberation_council" | "policy_council">,
) {
  const personId = newEntityId("person");
  await db.insert(persons).values({
    id: personId,
    synthetic: true,
    displayLabel: `ostt-synth ${id}`,
  });
  await db.insert(accounts).values({
    id,
    personId,
    contactChannel: `${id}@ostt.synth.test`,
    lifecycleState: "active",
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  for (const role of roles) {
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: id,
      role,
      grantedByLabel: "ostt-synth-assurance-test",
      reason: "Assurance gate fixture.",
    });
  }
  if (councils?.length) {
    const { councilAppointments } = await import("@/db/schema");
    for (const councilRole of councils) {
      await db.insert(councilAppointments).values({
        id: newEntityId("council"),
        accountId: id,
        councilRole,
        selectionPath: "Assurance fixture path.",
        termStartsOn: new Date("2026-08-01T00:00:00.000Z"),
      });
    }
  }
}

const MAPPED = Object.keys(CAPABILITY_ASSURANCE) as Capability[];

describe("authorizeCapability assurance gate", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    await insertActive(db, "account-ostt-synth-ac-participant", ["participant"]);
    await insertActive(db, "account-ostt-synth-ac-reviewer", ["reviewer"]);
    await insertActive(db, "account-ostt-synth-ac-moderator", ["moderator"]);
    await insertActive(db, "account-ostt-synth-ac-admin", ["administrator"]);
    await insertActive(db, "account-ostt-synth-ac-auditor", ["auditor"]);
    await insertActive(db, "account-ostt-synth-ac-delib", ["participant"], [
      "deliberation_council",
    ]);
    await insertActive(db, "account-ostt-synth-ac-policy", ["participant"], [
      "policy_council",
    ]);
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("covers every mapped capability in CAPABILITY_ASSURANCE", () => {
    expect(MAPPED.length).toBeGreaterThan(0);
    for (const capability of MAPPED) {
      expect(ASSURANCE_LEVELS[CAPABILITY_ASSURANCE[capability]!]).toBeTruthy();
    }
  });

  it("denies every mapped capability when assertions are missing", async () => {
    const roleFor: Partial<Record<Capability, string>> = {
      "institutional.vote": "account-ostt-synth-ac-participant",
      "institutional.council_deliberation": "account-ostt-synth-ac-delib",
      "institutional.council_policy": "account-ostt-synth-ac-policy",
      "institutional.publish_decision": "account-ostt-synth-ac-policy",
      "documents.publish": "account-ostt-synth-ac-admin",
      "roles.grant_platform": "account-ostt-synth-ac-admin",
      "roles.revoke_platform": "account-ostt-synth-ac-admin",
      "roles.grant_council": "account-ostt-synth-ac-admin",
      "roles.revoke_council": "account-ostt-synth-ac-admin",
      "verification.review_case": "account-ostt-synth-ac-reviewer",
      "onboarding.staff_read": "account-ostt-synth-ac-reviewer",
      "moderation.act": "account-ostt-synth-ac-moderator",
      "audit.read_restricted": "account-ostt-synth-ac-auditor",
      "pseudonym.privileged_lookup": "account-ostt-synth-ac-auditor",
      "privacy.manage_legal_hold": "account-ostt-synth-ac-admin",
      "privacy.execute_closure": "account-ostt-synth-ac-admin",
      "privacy.dual_control_request": "account-ostt-synth-ac-admin",
      "privacy.dual_control_approve": "account-ostt-synth-ac-admin",
      "topics.create": "account-ostt-synth-ac-admin",
      "topics.update": "account-ostt-synth-ac-admin",
      "topics.open": "account-ostt-synth-ac-admin",
      "topics.publish": "account-ostt-synth-ac-admin",
      "topics.pause": "account-ostt-synth-ac-admin",
      "topics.archive": "account-ostt-synth-ac-admin",
      "invites.issue": "account-ostt-synth-ac-admin",
      "claims.submit": "account-ostt-synth-ac-participant",
      "claims.edit_own": "account-ostt-synth-ac-participant",
      "claims.withdraw_own": "account-ostt-synth-ac-participant",
      "claims.review": "account-ostt-synth-ac-reviewer",
      "evidence.submit": "account-ostt-synth-ac-participant",
      "evidence.edit_own": "account-ostt-synth-ac-participant",
      "evidence.withdraw_own": "account-ostt-synth-ac-participant",
      "evidence.review": "account-ostt-synth-ac-reviewer",
      "conflicts.disclose_own": "account-ostt-synth-ac-participant",
      "moderation.review_submission": "account-ostt-synth-ac-moderator",
      "workspace.search": "account-ostt-synth-ac-participant",
      "topics.export_staff": "account-ostt-synth-ac-reviewer",
      "account.read_own": "account-ostt-synth-ac-participant",
      "account.sign_out": "account-ostt-synth-ac-participant",
      "account.revoke_all_sessions": "account-ostt-synth-ac-participant",
      "account.export_own": "account-ostt-synth-ac-participant",
      "account.request_closure": "account-ostt-synth-ac-participant",
    };

    for (const capability of MAPPED) {
      const accountId = roleFor[capability];
      expect(accountId, `role mapping for ${capability}`).toBeTruthy();
      const principal = await loadPrincipal(db, accountId!);
      const decision = await authorizeCapability(db, principal, capability);
      expect(decision.ok, capability).toBe(false);
      if (!decision.ok) {
        expect(decision.code).toBe("AUTHZ_ASSURANCE_REQUIRED");
        expect(decision.missingKinds?.length).toBeGreaterThan(0);
      }
    }
  });

  it("allows mapped capabilities when sufficient assertions are approved", async () => {
    await seedApprovedAssertions(
      db,
      "account-ostt-synth-ac-participant",
      L3_KINDS,
    );
    await seedApprovedAssertions(db, "account-ostt-synth-ac-reviewer", L3_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-ac-moderator", L3_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-ac-admin", L3_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-ac-auditor", L3_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-ac-delib", L4_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-ac-policy", L4_KINDS);

    const cases: Array<{ accountId: string; capability: Capability }> = [
      {
        accountId: "account-ostt-synth-ac-participant",
        capability: "institutional.vote",
      },
      {
        accountId: "account-ostt-synth-ac-reviewer",
        capability: "verification.review_case",
      },
      {
        accountId: "account-ostt-synth-ac-reviewer",
        capability: "onboarding.staff_read",
      },
      {
        accountId: "account-ostt-synth-ac-moderator",
        capability: "moderation.act",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "documents.publish",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "roles.grant_platform",
      },
      {
        accountId: "account-ostt-synth-ac-auditor",
        capability: "audit.read_restricted",
      },
      {
        accountId: "account-ostt-synth-ac-auditor",
        capability: "pseudonym.privileged_lookup",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "pseudonym.privileged_lookup",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "privacy.manage_legal_hold",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "privacy.dual_control_approve",
      },
      {
        accountId: "account-ostt-synth-ac-delib",
        capability: "institutional.council_deliberation",
      },
      {
        accountId: "account-ostt-synth-ac-policy",
        capability: "institutional.council_policy",
      },
      {
        accountId: "account-ostt-synth-ac-policy",
        capability: "institutional.publish_decision",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "invites.issue",
      },
      {
        accountId: "account-ostt-synth-ac-admin",
        capability: "topics.create",
      },
      {
        accountId: "account-ostt-synth-ac-participant",
        capability: "claims.submit",
      },
      {
        accountId: "account-ostt-synth-ac-reviewer",
        capability: "claims.review",
      },
      {
        accountId: "account-ostt-synth-ac-moderator",
        capability: "moderation.review_submission",
      },
      {
        accountId: "account-ostt-synth-ac-participant",
        capability: "workspace.search",
      },
      {
        accountId: "account-ostt-synth-ac-reviewer",
        capability: "topics.export_staff",
      },
    ];

    for (const entry of cases) {
      const principal = await loadPrincipal(db, entry.accountId);
      const decision = await authorizeCapability(
        db,
        principal,
        entry.capability,
      );
      expect(decision.ok, entry.capability).toBe(true);
    }
  });

  it("denies when a required assertion is expired", async () => {
    const id = "account-ostt-synth-ac-expired";
    await insertActive(db, id, ["participant"]);
    await seedApprovedAssertions(db, id, ["bot_resistance", "contact_continuity"]);
    await seedApprovedAssertions(db, id, ["uniqueness"], {
      expiresAt: new Date(Date.now() - 60_000),
      status: "approved",
    });
    const principal = await loadPrincipal(db, id);
    const decision = await authorizeCapability(
      db,
      principal,
      "institutional.vote",
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("AUTHZ_ASSURANCE_REQUIRED");
      expect(decision.missingKinds).toContain("uniqueness");
    }
  });

  it("denies when a required assertion is revoked", async () => {
    const id = "account-ostt-synth-ac-revoked";
    await insertActive(db, id, ["reviewer"]);
    await seedApprovedAssertions(db, id, ["bot_resistance"]);
    await seedApprovedAssertions(db, id, ["contact_continuity"], {
      status: "revoked",
    });
    const principal = await loadPrincipal(db, id);
    const decision = await authorizeCapability(
      db,
      principal,
      "verification.review_case",
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.missingKinds).toContain("contact_continuity");
    }
  });
});
