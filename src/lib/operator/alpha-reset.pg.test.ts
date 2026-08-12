/**
 * PostgreSQL concurrency / lock / success semantics for alpha reset.
 * Skips when Docker Postgres is unreachable unless OSTT_REQUIRE_POSTGRES=1.
 */
import path from "node:path";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { accounts, auditEvents, persons } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import type { FoundationDb } from "@/db/types";
import {
  ALPHA_RESET_ADVISORY_LOCK_KEY,
  RESET_LOCK_TABLES,
} from "@/lib/operator/alpha-reset-manifest";
import {
  acquireAlphaResetProtection,
  computeDatabaseFingerprint,
  executeAlphaReset,
  parseDatabaseName,
} from "@/lib/operator/alpha-reset";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const RESET_DB = "ostt_alpha_reset_concurrency";
const PG_URL =
  process.env.OSTT_PG_RESET_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${RESET_DB}`;
const RESET_SECRET = "ostt-synth-operator-reset-secret-32chars!!!!";
const REQUIRE_PG = process.env.OSTT_REQUIRE_POSTGRES === "1";

async function postgresReachable(): Promise<boolean> {
  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    try {
      await probe.unsafe(`CREATE DATABASE ${RESET_DB}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists|duplicate_database/i.test(message)) {
        throw error;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/connect|ECONNREFUSED|timeout|does not exist/i.test(message)) {
      await probe.end({ timeout: 1 }).catch(() => undefined);
      return false;
    }
    await probe.end({ timeout: 1 }).catch(() => undefined);
    return false;
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
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for alpha-reset.pg.test.ts",
  );
}

describe.skipIf(!reachable)("alpha reset concurrency (PostgreSQL 16)", () => {
  let sqlClient: ReturnType<typeof postgres>;
  let db: FoundationDb;
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    expect(parseDatabaseName(PG_URL)).toBe(RESET_DB);
    expect(parseDatabaseName(PG_URL)).not.toBe("ostt_dev");

    previousEnv = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      OPERATOR_RESET_SECRET: process.env.OPERATOR_RESET_SECRET,
      OPERATOR_LABEL: process.env.OPERATOR_LABEL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      SOURCE_COMMIT_SHA: process.env.SOURCE_COMMIT_SHA,
      OSTT_ALLOW_DEV_RESET: process.env.OSTT_ALLOW_DEV_RESET,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL = PG_URL;
    process.env.OPERATOR_RESET_SECRET = RESET_SECRET;
    process.env.OPERATOR_LABEL = "ostt-synth-reset-pg";
    process.env.AUTH_SECRET = "ostt-synth-auth-secret-reset-pg";
    process.env.SOURCE_COMMIT_SHA = "pg-reset-test-sha";
    delete process.env.OSTT_ALLOW_DEV_RESET;

    sqlClient = postgres(PG_URL, { max: 8 });
    await sqlClient.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
    `);
    db = drizzle(sqlClient, { schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await seedSyntheticFoundation(db);
  }, 180_000);

  afterAll(async () => {
    await sqlClient?.end({ timeout: 5 });
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("concurrent reset attempts leave a clean database with one receipt", async () => {
    await seedSyntheticFoundation(db);
    const fingerprint = computeDatabaseFingerprint(PG_URL);
    const results = await Promise.all([
      executeAlphaReset(db, {
        reason: "pg concurrent reset attempt A",
        confirmFingerprint: fingerprint,
        syntheticReceipt: false,
      }),
      executeAlphaReset(db, {
        reason: "pg concurrent reset attempt B",
        confirmFingerprint: fingerprint,
        syntheticReceipt: false,
      }),
    ]);

    const ok = results.filter((row) => row.ok);
    const failed = results.filter((row) => !row.ok);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const row of failed) {
      if (!row.ok) {
        expect(["RESET_LOCK_UNAVAILABLE", "RESET_FAILED"]).toContain(row.code);
        expect(row.error).not.toMatch(/@|password|token=/i);
      }
    }

    const accountsAfter = await db.select().from(accounts);
    expect(accountsAfter).toHaveLength(0);
    const receipts = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "alpha.reset_executed"));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.synthetic).toBe(false);
  }, 120_000);

  it("ordinary write during protected window fails closed without partial wipe", async () => {
    await seedSyntheticFoundation(db);
    const beforeAccounts = await db.select().from(accounts);
    expect(beforeAccounts.length).toBeGreaterThan(0);

    const holder = postgres(PG_URL, { max: 1 });
    const holderDb = drizzle(holder, { schema });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holdPromise = holderDb.transaction(async (tx) => {
      const txDb = tx as unknown as FoundationDb;
      await acquireAlphaResetProtection(txDb);
      // Signal that locks are held, then wait until the tester releases.
      await new Promise<void>((resolve) => {
        release();
        // Keep the transaction open until outer test finishes the write attempt.
        setTimeout(resolve, 2_500);
      });
      // Roll back by throwing after the contention check.
      throw new Error("HOLD_RELEASE");
    });

    await held;

    const writer = postgres(PG_URL, { max: 1 });
    try {
      await writer.unsafe(`SET lock_timeout = '1s'`);
      let writeError: unknown;
      try {
        await writer`
          INSERT INTO persons (id, synthetic, display_label, notes, created_at, updated_at)
          VALUES (
            'person-ostt-reset-race',
            true,
            'race',
            'should not land during reset lock',
            now(),
            now()
          )
        `;
      } catch (error) {
        writeError = error;
      }
      expect(writeError).toBeTruthy();
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      expect(message).toMatch(/lock timeout|could not obtain lock|canceling statement/i);

      const midAccounts = await db.select().from(accounts);
      expect(midAccounts).toHaveLength(beforeAccounts.length);
    } finally {
      await writer.end({ timeout: 5 });
      await holdPromise.catch((error) => {
        if (!(error instanceof Error && error.message === "HOLD_RELEASE")) {
          throw error;
        }
      });
      await holder.end({ timeout: 5 });
    }
  }, 60_000);

  it("lock acquisition failure changes nothing", async () => {
    await seedSyntheticFoundation(db);
    const beforeAccounts = await db.select().from(accounts);
    const fingerprint = computeDatabaseFingerprint(PG_URL);

    const holder = postgres(PG_URL, { max: 1 });
    const holderDb = drizzle(holder, { schema });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holdPromise = holderDb.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ALPHA_RESET_ADVISORY_LOCK_KEY})`,
      );
      await new Promise<void>((resolve) => {
        release();
        setTimeout(resolve, 3_000);
      });
      throw new Error("HOLD_RELEASE");
    });
    await held;

    const failed = await executeAlphaReset(db, {
      reason: "pg lock unavailable no partial",
      confirmFingerprint: fingerprint,
      syntheticReceipt: false,
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("RESET_LOCK_UNAVAILABLE");
      expect(failed.error).toMatch(/protected quiesced window/i);
    }

    const afterAccounts = await db.select().from(accounts);
    expect(afterAccounts).toHaveLength(beforeAccounts.length);
    const receipts = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "alpha.reset_executed"));
    expect(receipts).toHaveLength(0);

    await holdPromise.catch((error) => {
      if (!(error instanceof Error && error.message === "HOLD_RELEASE")) {
        throw error;
      }
    });
    await holder.end({ timeout: 5 });
  }, 60_000);

  it("successful commit reports ok with authoritative counts (no unlock step)", async () => {
    await seedSyntheticFoundation(db);
    const fingerprint = computeDatabaseFingerprint(PG_URL);
    const executed = await executeAlphaReset(db, {
      reason: "pg success reporting after commit",
      confirmFingerprint: fingerprint,
      syntheticReceipt: false,
    });
    expect(executed.ok).toBe(true);
    if (!executed.ok) {
      return;
    }
    expect(executed.value.receiptProvenance).toBe("operational");
    expect(executed.value.counts.before.identity).toBeGreaterThan(0);
    expect(executed.value.counts.after.topics).toBe(0);
    expect(executed.value.counts.after.audit).toBe(1);
    expect(RESET_LOCK_TABLES.length).toBeGreaterThan(10);

    const personsAfter = await db.select().from(persons);
    expect(personsAfter).toHaveLength(0);
  }, 60_000);
});
