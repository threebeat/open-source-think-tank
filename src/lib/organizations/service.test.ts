import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  organizationAppointments,
  organizations,
  persons,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { seedV2Organizations } from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { grantOrganizationAppointment } from "@/lib/organizations/appointments-service";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { listAppointmentsForOrganization } from "@/lib/organizations/appointment-repository";
import { getOrganization } from "@/lib/organizations/repository";
import { publishOrganizationConfig } from "@/lib/organizations/service";
import { SYNTHETIC_CONSTITUTIONAL_CONFIG } from "@/lib/organizations/constitutional-floor";
import {
  createGovernanceRecord,
  transitionGovernanceRecord,
} from "@/lib/governance/service";
import { characterizeLegacyCouncilAppointment } from "@/lib/governance/legacy-adapter";

const ALPHA = "org_ostt_synth_alpha_internal";
const BETA = "org_ostt_synth_beta_internal";

describe("organization services", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previous: Record<string, string | undefined>;

  beforeAll(async () => {
    previous = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      COMMONHALL_V2_KERNEL: process.env.COMMONHALL_V2_KERNEL,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth_org_unit";
    process.env.COMMONHALL_V2_KERNEL = "on";
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
    await seedV2Organizations(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("requires organizationId on repository reads", async () => {
    expect(() => requireOrganizationId("")).toThrow(/ORGANIZATION_ID_REQUIRED/);
    expect(() => requireOrganizationId(undefined)).toThrow(
      /ORGANIZATION_ID_REQUIRED/,
    );
    const missing = await getOrganization(db, ALPHA + "-missing");
    expect(missing).toBeNull();
    const alpha = await getOrganization(db, ALPHA);
    expect(alpha?.publicId).toBe("org-ostt-synth-alpha");
  });

  it("denies service admin organization mutations and self-grant", async () => {
    const admin = await loadPrincipal(db, "account-ostt-synth-staff-admin");
    expect(admin).not.toBeNull();
    if (!admin) return;
    expect(admin.platformRoles).toContain("administrator");
    expect(authorize(admin, "organization.appointment.grant").ok).toBe(false);

    const granted = await grantOrganizationAppointment(db, {
      principal: admin,
      organizationId: ALPHA,
      subjectAccountId: "account-ostt-synth-ada",
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(granted.ok).toBe(false);

    const issuerId = "account-ostt-synth-org-admin-a";
    const personId = newEntityId("person");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth org admin A",
    });
    await db.insert(accounts).values({
      id: issuerId,
      personId,
      contactChannel: "org-admin-a@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(organizationAppointments).values({
      id: newEntityId("orgappt"),
      organizationId: ALPHA,
      accountId: issuerId,
      appointmentKind: "organization_admin",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      issuedByAccountId: "account-ostt-synth-staff-admin",
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    });

    const orgAdmin = await loadPrincipal(db, issuerId);
    expect(orgAdmin?.organizationAppointments?.some((row) => row.kind === "organization_admin")).toBe(
      true,
    );
    if (!orgAdmin) return;

    const selfGrant = await grantOrganizationAppointment(db, {
      principal: orgAdmin,
      organizationId: ALPHA,
      subjectAccountId: issuerId,
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(selfGrant.ok).toBe(false);
    if (!selfGrant.ok) {
      expect(selfGrant.code).toBe("APPOINTMENT_SELF_GRANT_FORBIDDEN");
    }

    const cross = await grantOrganizationAppointment(db, {
      principal: orgAdmin,
      organizationId: BETA,
      subjectAccountId: "account-ostt-synth-ada",
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(cross.ok).toBe(false);

    const other = await grantOrganizationAppointment(db, {
      principal: orgAdmin,
      organizationId: ALPHA,
      subjectAccountId: "account-ostt-synth-ada",
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(other.ok).toBe(true);

    const betaAppointments = await listAppointmentsForOrganization(db, BETA);
    expect(
      betaAppointments.some((row) => row.accountId === "account-ostt-synth-ada"),
    ).toBe(false);
  });

  it("rejects hosted Pol.is config and kill-switch writes", async () => {
    const issuerId = "account-ostt-synth-org-admin-a";
    const orgAdmin = await loadPrincipal(db, issuerId);
    expect(orgAdmin).not.toBeNull();
    if (!orgAdmin) return;

    const hosted = await publishOrganizationConfig(db, {
      principal: orgAdmin,
      organizationId: ALPHA,
      config: { ...SYNTHETIC_CONSTITUTIONAL_CONFIG, hostedPolisEnabled: true },
      synthetic: true,
    });
    expect(hosted.ok).toBe(false);

    const previousKernel = process.env.COMMONHALL_V2_KERNEL;
    process.env.COMMONHALL_V2_KERNEL = "off";
    await expect(
      publishOrganizationConfig(db, {
        principal: orgAdmin,
        organizationId: ALPHA,
        config: SYNTHETIC_CONSTITUTIONAL_CONFIG,
        synthetic: true,
      }),
    ).rejects.toThrow(/V2_KERNEL_DISABLED/);
    process.env.COMMONHALL_V2_KERNEL = previousKernel;
  });

  it("prevents moderator self-qualification and platform-admin governance", async () => {
    const admin = await loadPrincipal(db, "account-ostt-synth-staff-admin");
    expect(admin).not.toBeNull();
    if (!admin) return;
    const authorId = "account-ostt-synth-author-mod";
    const personId = newEntityId("person");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth author-moderator",
    });
    await db.insert(accounts).values({
      id: authorId,
      personId,
      contactChannel: "author-mod@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const created = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: "gov-ostt-synth-self-review",
      configVersionId: "orgcfg_ostt_synth_alpha_v1",
      authorAccountId: authorId,
      synthetic: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const submitted = await transitionGovernanceRecord(db, {
      principal: admin,
      organizationId: ALPHA,
      recordId: created.value.recordId,
      action: "submit_for_formal_review",
      actor: "community_member",
      synthetic: true,
    });
    expect(submitted.ok).toBe(false);

    const author = await loadPrincipal(db, authorId);
    expect(author).not.toBeNull();
    if (!author) return;
    const qualifyWithoutSeat = await transitionGovernanceRecord(db, {
      principal: author,
      organizationId: ALPHA,
      recordId: created.value.recordId,
      action: "qualify",
      actor: "moderator",
      criteriaTrace: { criterion: "completeness", result: "met" },
      synthetic: true,
    });
    expect(qualifyWithoutSeat.ok).toBe(false);

    const orgAdmin = await loadPrincipal(db, "account-ostt-synth-org-admin-a");
    expect(orgAdmin).not.toBeNull();
    if (!orgAdmin) return;
    const moderatorSeat = await grantOrganizationAppointment(db, {
      principal: orgAdmin,
      organizationId: ALPHA,
      subjectAccountId: authorId,
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(moderatorSeat.ok).toBe(true);

    const authorModerator = await loadPrincipal(db, authorId);
    expect(authorModerator).not.toBeNull();
    if (!authorModerator) return;
    const selfQualify = await transitionGovernanceRecord(db, {
      principal: authorModerator,
      organizationId: ALPHA,
      recordId: created.value.recordId,
      action: "qualify",
      actor: "moderator",
      criteriaTrace: { criterion: "completeness", result: "met" },
      synthetic: true,
    });
    expect(selfQualify.ok).toBe(false);
    if (!selfQualify.ok) {
      expect(selfQualify.code).toBe("GOVERNANCE_SELF_REVIEW_FORBIDDEN");
    }
  });

  it("does not attach legacy council seats to v2 organizations", async () => {
    expect(
      characterizeLegacyCouncilAppointment("deliberation_council").v2Authority,
    ).toBe(false);
    const orgs = await db.select({ id: organizations.id }).from(organizations);
    expect(orgs.map((row) => row.id).sort()).toEqual([ALPHA, BETA].sort());
  });
});
