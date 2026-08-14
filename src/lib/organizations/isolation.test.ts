import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  organizationAppointments,
  organizationMemberships,
  organizations,
  persons,
  accounts,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { listAppointmentsForOrganization } from "@/lib/organizations/appointment-repository";
import { listMembershipsForOrganization } from "@/lib/organizations/membership-repository";
import { getOrganization } from "@/lib/organizations/repository";
import {
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";

describe("organization isolation (PGlite)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("rejects unscoped repository access", async () => {
    expect(() => requireOrganizationId("")).toThrow(/ORGANIZATION_ID_REQUIRED/);
    expect(() => requireOrganizationId(null)).toThrow(/ORGANIZATION_ID_REQUIRED/);
    await expect(listAppointmentsForOrganization(db, "")).rejects.toThrow(
      /ORGANIZATION_ID_REQUIRED/,
    );
    await expect(listMembershipsForOrganization(db, "   ")).rejects.toThrow(
      /ORGANIZATION_ID_REQUIRED/,
    );
  });

  it("rejects self-grant appointments at the database CHECK", async () => {
    await expect(
      db.insert(organizationAppointments).values({
        id: newEntityId("orgappt"),
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        accountId: "account-ostt-synth-staff-admin",
        appointmentKind: "organization_admin",
        termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
        issuedByAccountId: "account-ostt-synth-staff-admin",
        issuedByPrincipalKind: "organization_officer",
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-organization membership parent mismatch", async () => {
    const membershipId = newEntityId("orgmem");
    await db.insert(organizationMemberships).values({
      id: membershipId,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: "account-ostt-synth-ada",
      status: "assigned",
      isPrimary: false,
      assignedAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });

    await expect(
      db.execute(sql`
        INSERT INTO organization_membership_events (
          id, organization_id, membership_id, account_id, event_kind,
          actor_principal_kind, rule_version, at, synthetic
        ) VALUES (
          ${newEntityId("orgevt")},
          ${SYNTHETIC_ORG_BETA_ID},
          ${membershipId},
          ${"account-ostt-synth-ada"},
          ${"assignment"},
          ${"system"},
          ${"commonhall-governance@2.0.0"},
          ${"2026-08-01T00:00:00.000Z"},
          ${true}
        )
      `),
    ).rejects.toThrow();
  });

  it("keeps adversarial public ids from crossing tenants", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-adversary";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth adversary",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "adversary@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const guessId = SYNTHETIC_ORG_ALPHA_ID;
    await db.insert(organizations).values({
      id: "org_ostt_synth_gamma_internal",
      publicId: guessId,
      slug: "ostt-synth-gamma",
      displayName: "Synthetic Gamma Hall",
      serviceStatus: "seeded_synthetic",
      synthetic: true,
    });

    const alpha = await getOrganization(db, SYNTHETIC_ORG_ALPHA_ID);
    const gamma = await getOrganization(db, "org_ostt_synth_gamma_internal");
    expect(alpha?.id).toBe(SYNTHETIC_ORG_ALPHA_ID);
    expect(gamma?.publicId).toBe(guessId);
    expect(gamma?.id).not.toBe(alpha?.id);

    const alphaMemberships = await listMembershipsForOrganization(
      db,
      SYNTHETIC_ORG_ALPHA_ID,
    );
    expect(
      alphaMemberships.every((row) => row.organizationId === SYNTHETIC_ORG_ALPHA_ID),
    ).toBe(true);
    const betaMemberships = await listMembershipsForOrganization(
      db,
      SYNTHETIC_ORG_BETA_ID,
    );
    expect(betaMemberships).toEqual([]);
  });
});
