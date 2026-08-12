/**
 * PostgreSQL 16 concurrency proof for pending-participant invitation uniqueness.
 * Skips when Docker Postgres is unreachable so unit CI without Docker still passes.
 * Run with: npm run db:up && npx vitest run src/lib/invites/issue.pg.test.ts
 */
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invitations } from "@/db/schema";
import * as schema from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import type { FoundationDb } from "@/db/types";
import { issueParticipantInvitation } from "@/lib/invites/issue";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const INVITE_DB = "ostt_invite_concurrency";
const PG_URL =
  process.env.OSTT_PG_INVITE_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${INVITE_DB}`;
const REQUIRE_PG = process.env.OSTT_REQUIRE_POSTGRES === "1";

function parseDbName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, "").split("/")[0] ?? "");
  } catch {
    return "";
  }
}

async function postgresReachable(): Promise<boolean> {
  if (parseDbName(PG_URL) !== INVITE_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Invitation concurrency proof must target disposable DB "${INVITE_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Invitation concurrency proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${INVITE_DB}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message) && !/duplicate_database/i.test(message)) {
      // Connection failed or unexpected error — skip suite unless required.
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
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for invitation concurrency proof",
  );
}

describe.skipIf(!reachable)(
  "invitation issuance concurrency (PostgreSQL 16)",
  () => {
    let sqlClient: ReturnType<typeof postgres>;
    let db: FoundationDb;
    let previousEnv: Record<string, string | undefined>;

    beforeAll(async () => {
      previousEnv = {
        APP_MODE: process.env.APP_MODE,
        DATABASE_URL: process.env.DATABASE_URL,
      };
      process.env.APP_MODE = "gated";
      process.env.DATABASE_URL = PG_URL;

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

    it("allows only one pending participant invite per contact under concurrency", async () => {
      const contact = "pg-concurrent@example.test";
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          issueParticipantInvitation(db, {
            actorAccountId: "account-ostt-synth-staff-admin",
            intendedContactChannel: contact,
          }),
        ),
      );

      const pending = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.kind, "participant"),
            eq(invitations.status, "pending"),
            sql`lower(${invitations.intendedContactChannel}) = ${contact}`,
          ),
        );
      expect(pending).toHaveLength(1);

      const okCount = results.filter((row) => row.ok).length;
      expect(okCount).toBeGreaterThanOrEqual(1);
      for (const row of results) {
        if (!row.ok) {
          expect(row.error).not.toContain(contact);
          expect(JSON.stringify(row)).not.toMatch(/rawToken|acceptanceLink/);
        }
      }
    }, 60_000);
  },
);
