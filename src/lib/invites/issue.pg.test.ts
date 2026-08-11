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
  "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev";
const PG_URL =
  process.env.OSTT_PG_INVITE_TEST_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/ostt_invite_concurrency";

async function postgresReachable(): Promise<boolean> {
  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ostt_invite_concurrency`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message) && !/duplicate_database/i.test(message)) {
      // Connection failed or unexpected error — skip suite.
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
