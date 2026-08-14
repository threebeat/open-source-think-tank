/**
 * PostgreSQL uniqueness/concurrency proof for open enrollment.
 * Run: npm run db:up && npm run test:pg:enrollment
 */
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { enrollOpenAccount, ENROLLMENT_MIN_FILL_MS } from "@/lib/auth/enrollment";
import { resetRateLimits } from "@/lib/auth/rate-limit";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const ENROLL_DB = "ostt_enrollment_concurrency";
const PG_URL =
  process.env.OSTT_PG_ENROLL_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${ENROLL_DB}`;
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
  if (parseDbName(PG_URL) !== ENROLL_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Enrollment concurrency proof must target disposable DB "${ENROLL_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Enrollment concurrency proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${ENROLL_DB}`);
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
    "OSTT_REQUIRE_POSTGRES=1 but enrollment concurrency Postgres is unreachable",
  );
}

describe.skipIf(!reachable)("open enrollment concurrency (postgres)", () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL = PG_URL;
    process.env.AUTH_SECRET = "ostt-synth-auth-secret-enrollment-pg";
    delete process.env.COMMONHALL_V2_OPEN_ENROLLMENT;
    sql = postgres(PG_URL, { max: 4 });
    db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await seedSyntheticFoundation(db);
    resetRateLimits();
  }, 120_000);

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("allows only one concurrent enroll for the same identifier", async () => {
    const input = {
      identifier: "concurrent@ostt.synth.test",
      password: "a-sufficiently-long-pass",
      honeypot: "",
      formOpenedAt: Date.now() - ENROLLMENT_MIN_FILL_MS - 100,
      communityStandardsAssent: true,
      clientIp: "203.0.113.80",
    };
    const [a, b] = await Promise.all([
      enrollOpenAccount(db, input),
      enrollOpenAccount(db, { ...input, clientIp: "203.0.113.81" }),
    ]);
    const oks = [a, b].filter((row) => row.ok);
    const dups = [a, b].filter(
      (row) => !row.ok && row.code === "ENROLLMENT_DUPLICATE",
    );
    expect(oks).toHaveLength(1);
    expect(dups.length + oks.length).toBe(2);
  });
});
