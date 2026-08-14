/**
 * PostgreSQL isolation and 0027 rollback proofs for Chamber/Council tables.
 * Run: npm run db:up && npm run test:pg:chamber
 */
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { SYNTHETIC_JOURNEY_RECORD_ID } from "@/db/seeds/v2-chamber-council";
import {
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { listChamber } from "@/lib/bodies/service";
import { ROLLBACK_0027 } from "@/lib/db/migration-rollback-sql";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const CHAMBER_DB = "ostt_chamber_isolation";
const ROLLBACK_DB = "ostt_chamber_rollback";
const PG_URL =
  process.env.OSTT_PG_CHAMBER_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${CHAMBER_DB}`;
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
  if (parseDbName(PG_URL) !== CHAMBER_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Chamber isolation proof must target disposable DB "${CHAMBER_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Chamber isolation proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${CHAMBER_DB}`);
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


const reachable = await postgresReachable();
if (REQUIRE_PG && !reachable) {
  throw new Error(
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for Chamber isolation",
  );
}

describe.skipIf(!reachable)("chamber/council isolation (Postgres)", () => {
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

  it("rejects a beta organization_id with an alpha Chamber session topic", async () => {
    const listed = await listChamber(db, {
      principal: null,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
    });
    expect(listed.ok).toBe(true);

    await expect(
      db.execute(sql`
        INSERT INTO chamber_sessions (
          id, organization_id, public_id, topic_governance_record_id,
          status, timezone, scheduled_opens_at, scheduled_closes_at, synthetic
        ) VALUES (
          ${newEntityId("chsess")},
          ${SYNTHETIC_ORG_BETA_ID},
          ${"chsess-cross-tenant"},
          ${SYNTHETIC_JOURNEY_RECORD_ID},
          ${"scheduled"},
          ${"America/Chicago"},
          ${"2026-08-14T17:00:00.000Z"},
          ${"2026-08-14T19:00:00.000Z"},
          ${true}
        )
      `),
    ).rejects.toThrow();
  });

  it("rolls back migration 0027 on a disposable database", async () => {
    const admin = postgres(ADMIN_URL, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${ROLLBACK_DB}`);
      await admin.unsafe(`CREATE DATABASE ${ROLLBACK_DB}`);
    } finally {
      await admin.end({ timeout: 1 });
    }

    const rollbackUrl = PG_URL.replace(`/${CHAMBER_DB}`, `/${ROLLBACK_DB}`);
    const rollbackClient = postgres(rollbackUrl, { max: 1 });
    const rollbackDb = drizzle(rollbackClient, { schema });
    try {
      await migrate(rollbackDb, { migrationsFolder });
      const before = await rollbackClient`
        SELECT to_regclass('public.chamber_sessions') AS rel
      `;
      expect(before[0]?.rel).toBe("chamber_sessions");
      await rollbackClient.unsafe(ROLLBACK_0027);
      const after = await rollbackClient`
        SELECT to_regclass('public.chamber_sessions') AS rel
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
