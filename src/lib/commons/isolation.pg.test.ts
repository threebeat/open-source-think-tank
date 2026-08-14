/**
 * PostgreSQL isolation and 0025 rollback proofs for Commons discussions.
 * Run: npm run db:up && npm run test:pg:commons
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
import { listDiscussionsForOrganization } from "@/lib/commons/repository";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const COMMONS_DB = "ostt_commons_isolation";
const ROLLBACK_DB = "ostt_commons_rollback";
const PG_URL =
  process.env.OSTT_PG_COMMONS_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${COMMONS_DB}`;
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
  if (parseDbName(PG_URL) !== COMMONS_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Commons isolation proof must target disposable DB "${COMMONS_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Commons isolation proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${COMMONS_DB}`);
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

const ROLLBACK_0025 = `
DROP TRIGGER IF EXISTS commons_discussion_revisions_immutable ON commons_discussion_revisions;
DROP TRIGGER IF EXISTS ostt_commons_revision_parent_match ON commons_discussion_revisions;
DROP TRIGGER IF EXISTS ostt_commons_parent_discussion_match ON commons_discussions;
DROP FUNCTION IF EXISTS ostt_commons_revision_parent_match();
DROP FUNCTION IF EXISTS ostt_commons_parent_discussion_match();
DROP TABLE IF EXISTS commons_discussion_revisions;
DROP TABLE IF EXISTS commons_discussions;
DROP TYPE IF EXISTS commons_discussion_visibility;
DROP TYPE IF EXISTS commons_discussion_category;
`;

const reachable = await postgresReachable();
if (REQUIRE_PG && !reachable) {
  throw new Error(
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for Commons isolation",
  );
}

describe.skipIf(!reachable)("commons isolation (Postgres)", () => {
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

  it("rejects a beta organization_id with an alpha parent discussion id", async () => {
    const alphaRows = await listDiscussionsForOrganization(
      db,
      SYNTHETIC_ORG_ALPHA_ID,
    );
    const parent = alphaRows[0];
    expect(parent).toBeTruthy();

    await expect(
      db.execute(sql`
        INSERT INTO commons_discussions (
          id, organization_id, public_id, category, formal, visibility,
          author_account_id, title, body, parent_discussion_id, synthetic
        ) VALUES (
          ${newEntityId("cdisc")},
          ${SYNTHETIC_ORG_BETA_ID},
          ${"cpub-ostt-synth-cross-org"},
          ${"general_discussion"},
          ${false},
          ${"listed"},
          ${"account-ostt-synth-ada"},
          ${"Cross-org attempt"},
          ${"Should fail the composite parent FK."},
          ${parent.id},
          ${true}
        )
      `),
    ).rejects.toThrow();

    const beta = await listDiscussionsForOrganization(db, SYNTHETIC_ORG_BETA_ID);
    expect(beta.every((row) => row.organizationId === SYNTHETIC_ORG_BETA_ID)).toBe(
      true,
    );
    expect(beta.some((row) => row.id === parent.id)).toBe(false);
  });

  it("rolls back migration 0025 on a disposable database", async () => {
    const admin = postgres(ADMIN_URL, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${ROLLBACK_DB}`);
      await admin.unsafe(`CREATE DATABASE ${ROLLBACK_DB}`);
    } finally {
      await admin.end({ timeout: 1 });
    }

    const rollbackUrl = PG_URL.replace(`/${COMMONS_DB}`, `/${ROLLBACK_DB}`);
    const rollbackClient = postgres(rollbackUrl, { max: 1 });
    const rollbackDb = drizzle(rollbackClient, { schema });
    try {
      await migrate(rollbackDb, { migrationsFolder });
      const before = await rollbackClient`
        SELECT to_regclass('public.commons_discussions') AS rel
      `;
      expect(before[0]?.rel).toBe("commons_discussions");
      await rollbackClient.unsafe(ROLLBACK_0025);
      const after = await rollbackClient`
        SELECT to_regclass('public.commons_discussions') AS rel
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
