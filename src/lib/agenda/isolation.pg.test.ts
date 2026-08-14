/**
 * PostgreSQL isolation and 0026 rollback proofs for member positions.
 * Run: npm run db:up && npm run test:pg:agenda
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
  SYNTHETIC_AGENDA_OPEN_RECORD_ID,
} from "@/db/seeds/v2-agenda";
import {
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { listPublicAgendaRecords } from "@/lib/governance/repository";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const AGENDA_DB = "ostt_agenda_isolation";
const ROLLBACK_DB = "ostt_agenda_rollback";
const PG_URL =
  process.env.OSTT_PG_AGENDA_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${AGENDA_DB}`;
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
  if (parseDbName(PG_URL) !== AGENDA_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Agenda isolation proof must target disposable DB "${AGENDA_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Agenda isolation proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${AGENDA_DB}`);
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

const ROLLBACK_0026 = `
DROP TRIGGER IF EXISTS ostt_member_position_parent_match ON member_statement_positions;
DROP FUNCTION IF EXISTS ostt_member_position_parent_match();
DROP TABLE IF EXISTS member_statement_positions;
DROP TYPE IF EXISTS member_statement_position;
DROP INDEX IF EXISTS topic_governance_records_org_slug_uidx;
DROP INDEX IF EXISTS topic_governance_records_org_provider_entity_uidx;
ALTER TABLE topic_governance_records
  DROP CONSTRAINT IF EXISTS topic_governance_records_fixture_conversation_fk,
  DROP CONSTRAINT IF EXISTS topic_governance_records_slug_nonblank,
  DROP CONSTRAINT IF EXISTS topic_governance_records_title_nonblank,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS question,
  DROP COLUMN IF EXISTS overview,
  DROP COLUMN IF EXISTS synthetic_evidence,
  DROP COLUMN IF EXISTS synthetic_statements,
  DROP COLUMN IF EXISTS fixture_conversation_id,
  DROP COLUMN IF EXISTS current_provider_entity_id;
`;

const reachable = await postgresReachable();
if (REQUIRE_PG && !reachable) {
  throw new Error(
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for Agenda isolation",
  );
}

describe.skipIf(!reachable)("agenda isolation (Postgres)", () => {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const client = postgres(PG_URL, { max: 4 });
  const db = drizzle(client, { schema });

  beforeAll(async () => {
    process.env.APP_MODE = "gated";
    process.env.COMMONHALL_V2_KERNEL = "on";
    process.env.DATABASE_URL = PG_URL;
    await migrate(db, { migrationsFolder });
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.end({ timeout: 2 });
  });

  it("rejects a beta organization_id with an alpha governance record id", async () => {
    const alphaRows = await listPublicAgendaRecords(db, SYNTHETIC_ORG_ALPHA_ID);
    expect(alphaRows.some((row) => row.id === SYNTHETIC_AGENDA_OPEN_RECORD_ID)).toBe(
      true,
    );

    await expect(
      db.execute(sql`
        INSERT INTO member_statement_positions (
          id, organization_id, topic_governance_record_id, account_id,
          statement_public_id, position, synthetic
        ) VALUES (
          ${newEntityId("mpos")},
          ${SYNTHETIC_ORG_BETA_ID},
          ${SYNTHETIC_AGENDA_OPEN_RECORD_ID},
          ${"account-ostt-synth-ada"},
          ${"stmt-ostt-synth-transit-frequency"},
          ${"agree"},
          ${true}
        )
      `),
    ).rejects.toThrow();

    const beta = await listPublicAgendaRecords(db, SYNTHETIC_ORG_BETA_ID);
    expect(beta).toEqual([]);
  });

  it("rolls back migration 0026 on a disposable database", async () => {
    const admin = postgres(ADMIN_URL, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${ROLLBACK_DB}`);
      await admin.unsafe(`CREATE DATABASE ${ROLLBACK_DB}`);
    } finally {
      await admin.end({ timeout: 1 });
    }

    const rollbackUrl = PG_URL.replace(`/${AGENDA_DB}`, `/${ROLLBACK_DB}`);
    const rollbackClient = postgres(rollbackUrl, { max: 1 });
    const rollbackDb = drizzle(rollbackClient, { schema });
    try {
      await migrate(rollbackDb, { migrationsFolder });
      const before = await rollbackClient`
        SELECT to_regclass('public.member_statement_positions') AS rel
      `;
      expect(before[0]?.rel).toBe("member_statement_positions");
      await rollbackClient.unsafe(ROLLBACK_0026);
      const after = await rollbackClient`
        SELECT to_regclass('public.member_statement_positions') AS rel
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
