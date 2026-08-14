import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  councilAppointments,
  persons,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { eq } from "drizzle-orm";
import { newEntityId } from "@/lib/auth/tokens";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  grantCouncilSeat,
  grantPlatformRole,
  revokeCouncilSeat,
  revokePlatformRole,
} from "@/lib/authz/role-changes";
import { classifyMultiAccountSynthetic } from "@/lib/authz/synthetic-classification";
import {
  CAPABILITIES,
  type AuthzPrincipal,
  type Capability,
} from "@/lib/authz/types";
import {
  L3_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";

async function insertAccount(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  input: {
    id: string;
    lifecycle: "pending_onboarding" | "active";
    synthetic?: boolean;
    roles?: Array<
      "participant" | "reviewer" | "moderator" | "administrator" | "auditor"
    >;
    councils?: Array<"deliberation_council" | "policy_council">;
  },
) {
  const personId = newEntityId("person");
  const synthetic = input.synthetic ?? true;
  await db.insert(persons).values({
    id: personId,
    synthetic,
    displayLabel: `${synthetic ? "ostt-synth" : "real"} ${input.id}`,
  });
  await db.insert(accounts).values({
    id: input.id,
    personId,
    contactChannel: `${input.id}@${synthetic ? "ostt.synth.test" : "example.test"}`,
    lifecycleState: input.lifecycle,
    synthetic,
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
      reason: "Capability matrix fixture.",
    });
  }
  for (const councilRole of input.councils ?? []) {
    await db.insert(councilAppointments).values({
      id: newEntityId("council"),
      accountId: input.id,
      councilRole,
      selectionPath: "Authz fixture path.",
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

    // Administrator without participant — must not inherit voting rights.
    await insertAccount(db, {
      id: "account-ostt-synth-admin",
      lifecycle: "active",
      roles: ["administrator"],
    });
    // Second admin for continuity / revoke tests.
    await insertAccount(db, {
      id: "account-ostt-synth-admin-b",
      lifecycle: "active",
      roles: ["administrator"],
    });
    // Role-change services enforce assurance (L3) in addition to roles.
    await seedApprovedAssertions(db, "account-ostt-synth-admin", L3_KINDS);
    await seedApprovedAssertions(db, "account-ostt-synth-admin-b", L3_KINDS);
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
      id: "account-ostt-synth-auditor-b",
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
    await insertAccount(db, {
      id: "account-real-admin",
      lifecycle: "active",
      synthetic: false,
      roles: ["administrator"],
    });
    await insertAccount(db, {
      id: "account-real-subject",
      lifecycle: "active",
      synthetic: false,
      roles: ["participant"],
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
      "pseudonym.privileged_lookup",
      "roles.grant_platform",
      "roles.revoke_platform",
      "roles.grant_council",
      "roles.revoke_council",
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

  it("does not grant institutional.vote from administrator alone", async () => {
    const admin = await principal("account-ostt-synth-admin");
    expect(admin.platformRoles).toEqual(["administrator"]);
    expect(authorize(admin, "institutional.vote").ok).toBe(false);
  });

  it("allows each role its positive capabilities and denies the others", async () => {
    const cases: Array<{
      accountId: string;
      allow: Capability[];
      deny: Capability[];
    }> = [
      {
        accountId: "account-ostt-synth-participant",
        allow: [
          "institutional.vote",
          "account.read_own",
          "account.export_own",
          "account.request_closure",
        ],
        deny: [
          "verification.review_case",
          "moderation.act",
          "audit.read_restricted",
          "pseudonym.privileged_lookup",
          "privacy.manage_legal_hold",
          "privacy.execute_closure",
          "roles.grant_platform",
          "roles.revoke_platform",
          "documents.publish",
          "onboarding.staff_read",
          "institutional.council_deliberation",
          "institutional.council_policy",
        ],
      },
      {
        accountId: "account-ostt-synth-reviewer",
        allow: ["verification.review_case", "onboarding.staff_read"],
        deny: [
          "moderation.act",
          "roles.grant_platform",
          "institutional.vote",
          "documents.publish",
          "pseudonym.privileged_lookup",
        ],
      },
      {
        accountId: "account-ostt-synth-moderator",
        allow: ["moderation.act"],
        deny: [
          "verification.review_case",
          "audit.read_restricted",
          "pseudonym.privileged_lookup",
          "privacy.manage_legal_hold",
          "documents.publish",
        ],
      },
      {
        accountId: "account-ostt-synth-auditor",
        allow: ["audit.read_restricted", "pseudonym.privileged_lookup"],
        deny: [
          "moderation.act",
          "roles.grant_council",
          "roles.revoke_council",
          "documents.publish",
          "privacy.execute_closure",
        ],
      },
      {
        accountId: "account-ostt-synth-admin",
        allow: [
          "roles.grant_platform",
          "roles.revoke_platform",
          "roles.grant_council",
          "roles.revoke_council",
          "verification.review_case",
          "onboarding.staff_read",
          "moderation.act",
          "audit.read_restricted",
          "pseudonym.privileged_lookup",
          "privacy.manage_legal_hold",
          "privacy.execute_closure",
          "privacy.dual_control_request",
          "privacy.dual_control_approve",
          "documents.publish",
          "account.export_own",
          "account.request_closure",
        ],
        deny: [
          "institutional.vote",
          "institutional.council_deliberation",
          "institutional.council_policy",
          "organization.membership.read",
          "organization.appointment.grant",
          "organization.appointment.revoke",
          "organization.config.publish",
          "organization.governance.transition",
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
    expect(bothPath.councilRoles).toEqual(
      expect.arrayContaining(["deliberation_council", "policy_council"]),
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

  it("revokes platform roles with continuity and concurrency safeguards", async () => {
    const selfRevoke = await revokePlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-admin",
      role: "administrator",
      reason: "Attempting to revoke own administrator role.",
    });
    expect(selfRevoke.ok).toBe(false);
    if (!selfRevoke.ok) {
      expect(selfRevoke.code).toBe("AUTHZ_SELF_CONTINUITY_FORBIDDEN");
    }

    const revoked = await revokePlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "reviewer",
      reason: "Revoke reviewer after synthetic matrix coverage.",
    });
    expect(revoked.ok).toBe(true);

    const [first, second] = await Promise.all([
      revokePlatformRole(db, {
        actorAccountId: "account-ostt-synth-admin",
        subjectAccountId: "account-ostt-synth-participant",
        role: "reviewer",
        reason: "Concurrent revoke should fail for the loser.",
      }),
      revokePlatformRole(db, {
        actorAccountId: "account-ostt-synth-admin-b",
        subjectAccountId: "account-ostt-synth-participant",
        role: "reviewer",
        reason: "Concurrent revoke should fail for the loser.",
      }),
    ]);
    expect([first, second].filter((result) => result.ok)).toHaveLength(0);
    expect(
      [first, second].every(
        (result) => !result.ok && result.code === "AUTHZ_ROLE_NOT_HELD",
      ),
    ).toBe(true);

    const after = await principal("account-ostt-synth-participant");
    expect(after.platformRoles).not.toContain("reviewer");
  });

  it("revokes council seats with actor≠subject and concurrent claim", async () => {
    const selfCouncilRevoke = await revokeCouncilSeat(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-admin",
      councilRole: "deliberation_council",
      reason: "Self council revoke must fail even without a seat.",
    });
    expect(selfCouncilRevoke.ok).toBe(false);
    if (!selfCouncilRevoke.ok) {
      expect(selfCouncilRevoke.code).toBe("AUTHZ_SELF_CONTINUITY_FORBIDDEN");
    }

    const revoked = await revokeCouncilSeat(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      councilRole: "deliberation_council",
      reason: "Revoke deliberation seat after synthetic coverage.",
    });
    expect(revoked.ok).toBe(true);

    const again = await revokeCouncilSeat(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      councilRole: "deliberation_council",
      reason: "Second revoke must fail — seat already claimed.",
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.code).toBe("AUTHZ_SEAT_NOT_HELD");
    }

    const participant = await principal("account-ostt-synth-participant");
    expect(participant.councilRoles).not.toContain("deliberation_council");
  });

  it("classifies mixed real/synthetic role-change audits as non-synthetic", async () => {
    expect(classifyMultiAccountSynthetic(true, true)).toBe(true);
    expect(classifyMultiAccountSynthetic(false, true)).toBe(false);
    expect(classifyMultiAccountSynthetic(true, false)).toBe(false);
    expect(classifyMultiAccountSynthetic(false, false)).toBe(false);

    await seedApprovedAssertions(db, "account-real-admin", L3_KINDS);

    const mixedGrant = await grantPlatformRole(db, {
      actorAccountId: "account-real-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "moderator",
      reason: "Real administrator granting role to synthetic subject.",
    });
    expect(mixedGrant.ok).toBe(true);

    const grantAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "authz.platform_role_granted"));
    const mixedGrantAudit = grantAudits.find(
      (row) =>
        row.actorAccountId === "account-real-admin" &&
        row.subjectId === "account-ostt-synth-participant",
    );
    expect(mixedGrantAudit?.synthetic).toBe(false);

    const mixedRevoke = await revokePlatformRole(db, {
      actorAccountId: "account-real-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "moderator",
      reason: "Real administrator revoking role on synthetic subject.",
    });
    expect(mixedRevoke.ok).toBe(true);

    const revokeAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "authz.platform_role_revoked"));
    const mixedRevokeAudit = revokeAudits.find(
      (row) =>
        row.actorAccountId === "account-real-admin" &&
        row.subjectId === "account-ostt-synth-participant",
    );
    expect(mixedRevokeAudit?.synthetic).toBe(false);

    const bothReal = await grantPlatformRole(db, {
      actorAccountId: "account-real-admin",
      subjectAccountId: "account-real-subject",
      role: "reviewer",
      reason: "Real administrator granting role to real subject.",
    });
    expect(bothReal.ok).toBe(true);
    const bothRealAudit = (
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "authz.platform_role_granted"))
    ).find(
      (row) =>
        row.actorAccountId === "account-real-admin" &&
        row.subjectId === "account-real-subject",
    );
    expect(bothRealAudit?.synthetic).toBe(false);

    const bothSynth = await grantPlatformRole(db, {
      actorAccountId: "account-ostt-synth-admin",
      subjectAccountId: "account-ostt-synth-participant",
      role: "moderator",
      reason: "Synthetic administrator granting role to synthetic subject.",
    });
    expect(bothSynth.ok).toBe(true);
    const bothSynthAudit = (
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "authz.platform_role_granted"))
    ).find(
      (row) =>
        row.actorAccountId === "account-ostt-synth-admin" &&
        row.subjectId === "account-ostt-synth-participant" &&
        (row.privatePayload as { role?: string } | null)?.role === "moderator",
    );
    expect(bothSynthAudit?.synthetic).toBe(true);
  });
});
