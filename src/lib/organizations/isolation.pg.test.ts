/**
 * PostgreSQL isolation and 0023 rollback proofs for the organization kernel.
 * Run: npm run db:up && npm run test:pg:organizations
 */
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { listMembershipsForOrganization } from "@/lib/organizations/membership-repository";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const ORG_DB = "ostt_org_isolation";
const ROLLBACK_DB = "ostt_org_rollback";
const PG_URL =
  process.env.OSTT_PG_ORG_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${ORG_DB}`;
const REQUIRE_PG = process.env.OSTT_REQUIRE_POSTGRES === "1";

function parseDbName(url: string): string {
  try {
    return decodeURIComponent(
      new URL(url).pathname.replace(/^\//, "").split("/")[0] ?? "",
    );
  } catch {
    return "";
  }
}

async function postgresReachable(): Promise<boolean> {
  if (parseDbName(PG_URL) !== ORG_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Organization isolation proof must target disposable DB "${ORG_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Organization isolation proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${ORG_DB}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message) && !/duplicate_database/i.test(message)) {
      if (/connect|ECONNREFUSED|timeout|does not exist/i.test(message)) {
        await probe.end({ timeout: 1 }).catch(() => undefined);
        return false;
      }
    }
  } finally {
    await probe.end({ timeout: 1 }).catch(() => undefined);
  }

  const check = postgres(PG_URL, { max: 1, connect_timeout: 2 });
  try {
    await check`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await check.end({ timeout: 1 }).catch(() => undefined);
  }
}

const ROLLBACK_0023 = `
DROP TRIGGER IF EXISTS topic_governance_events_immutable ON topic_governance_events;
DROP TRIGGER IF EXISTS organization_membership_events_immutable ON organization_membership_events;
DROP TRIGGER IF EXISTS ostt_membership_event_parent_match ON organization_membership_events;
DROP TRIGGER IF EXISTS ostt_appointment_conflict_parent_match ON appointment_conflicts_and_recusals;
DROP TRIGGER IF EXISTS ostt_governance_event_parent_match ON topic_governance_events;
DROP FUNCTION IF EXISTS ostt_membership_event_parent_match();
DROP FUNCTION IF EXISTS ostt_appointment_conflict_parent_match();
DROP FUNCTION IF EXISTS ostt_governance_event_parent_match();
ALTER TABLE audit_events DROP COLUMN IF EXISTS projection_class;
ALTER TABLE audit_events DROP COLUMN IF EXISTS capability;
ALTER TABLE audit_events DROP COLUMN IF EXISTS actor_principal_kind;
ALTER TABLE audit_events DROP COLUMN IF EXISTS organization_id;
DROP TABLE IF EXISTS appointment_conflicts_and_recusals;
DROP TABLE IF EXISTS topic_governance_events;
DROP TABLE IF EXISTS topic_governance_records;
DROP TABLE IF EXISTS organization_appointments;
DROP TABLE IF EXISTS organization_membership_events;
DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS organization_config_versions;
DROP TABLE IF EXISTS organization_service_areas;
DROP TABLE IF EXISTS organizations;
DROP TYPE IF EXISTS topic_governance_action;
DROP TYPE IF EXISTS topic_governance_state;
DROP TYPE IF EXISTS audit_projection_class;
DROP TYPE IF EXISTS actor_principal_kind;
DROP TYPE IF EXISTS appointment_conflict_kind;
DROP TYPE IF EXISTS organization_appointment_kind;
DROP TYPE IF EXISTS organization_membership_event_kind;
DROP TYPE IF EXISTS organization_membership_status;
DROP TYPE IF EXISTS organization_config_status;
DROP TYPE IF EXISTS organization_service_status;
`;

const reachable = await postgresReachable();
if (REQUIRE_PG && !reachable) {
  throw new Error(
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for organization isolation",
  );
}

describe.skipIf(!reachable)("organization isolation (Postgres)", () => {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const client = postgres(PG_URL, { max: 4 });
  const db = drizzle(client, { schema });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.end({ timeout: 2 });
  });

  it("rejects cross-tenant membership event SQL", async () => {
    const membershipId = newEntityId("orgmem");
    await db.execute(sql`
      INSERT INTO organization_memberships (
        id, organization_id, account_id, status, is_primary, assigned_at, synthetic
      ) VALUES (
        ${membershipId},
        ${SYNTHETIC_ORG_ALPHA_ID},
        ${"account-ostt-synth-ada"},
        ${"assigned"},
        ${false},
        ${"2026-08-01T00:00:00.000Z"},
        ${true}
      )
    `);

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

    const beta = await listMembershipsForOrganization(db, SYNTHETIC_ORG_BETA_ID);
    expect(beta.every((row) => row.organizationId === SYNTHETIC_ORG_BETA_ID)).toBe(
      true,
    );
  });

  it("rolls back migration 0023 on a disposable database", async () => {
    const admin = postgres(ADMIN_URL, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${ROLLBACK_DB}`);
      await admin.unsafe(`CREATE DATABASE ${ROLLBACK_DB}`);
    } finally {
      await admin.end({ timeout: 1 });
    }

    const rollbackUrl = PG_URL.replace(`/${ORG_DB}`, `/${ROLLBACK_DB}`);
    const rollbackClient = postgres(rollbackUrl, { max: 1 });
    const rollbackDb = drizzle(rollbackClient, { schema });
    try {
      await migrate(rollbackDb, { migrationsFolder });
      const before = await rollbackClient`
        SELECT to_regclass('public.organizations') AS rel
      `;
      expect(before[0]?.rel).toBe("organizations");
      await rollbackClient.unsafe(ROLLBACK_0023);
      const after = await rollbackClient`
        SELECT to_regclass('public.organizations') AS rel
      `;
      expect(after[0]?.rel).toBeNull();
    } finally {
      await rollbackClient.end({ timeout: 2 });
      const cleanup = postgres(ADMIN_URL, { max: 1 });
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS ${ROLLBACK_DB}`);
      } finally {
        await cleanup.end({ timeout: 1 });
      }
    }
  });
});
