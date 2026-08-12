import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, topics } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  assertManifestComplete,
  hashManifest,
  RESET_MANIFEST_VERSION,
  tablesByClass,
} from "@/lib/operator/alpha-reset-manifest";
import {
  computeDatabaseFingerprint,
  dryRunAlphaReset,
  executeAlphaReset,
  listSchemaTableNames,
  parseDatabaseName,
} from "@/lib/operator/alpha-reset";
import { requireOperatorResetEnv } from "@/lib/operator/secrets";

const RESET_SECRET = "ostt-synth-operator-reset-secret-32chars!!!!";

describe("alpha reset (3.12)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    previousEnv = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      OPERATOR_RESET_SECRET: process.env.OPERATOR_RESET_SECRET,
      OPERATOR_LABEL: process.env.OPERATOR_LABEL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      OSTT_ALLOW_DEV_RESET: process.env.OSTT_ALLOW_DEV_RESET,
      SOURCE_COMMIT_SHA: process.env.SOURCE_COMMIT_SHA,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_alpha_reset_unit";
    process.env.OPERATOR_RESET_SECRET = RESET_SECRET;
    process.env.OPERATOR_LABEL = "ostt-synth-reset-operator";
    process.env.AUTH_SECRET = "ostt-synth-auth-secret-for-reset-tests";
    process.env.SOURCE_COMMIT_SHA = "unit-test-sha";
    delete process.env.OSTT_ALLOW_DEV_RESET;

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("manifest covers every schema table", () => {
    expect(() => assertManifestComplete(listSchemaTableNames())).not.toThrow();
    expect(tablesByClass("deferred")).toEqual([]);
    expect(tablesByClass("retained")).toEqual(["schema_meta"]);
    expect(hashManifest()).toHaveLength(64);
    expect(RESET_MANIFEST_VERSION).toBe("3.12.0");
  });

  it("fingerprints host+port+dbname only", () => {
    const a = computeDatabaseFingerprint(
      "postgres://user:s3cret@127.0.0.1:54329/ostt_alpha_reset",
    );
    const b = computeDatabaseFingerprint(
      "postgres://other:different@127.0.0.1:54329/ostt_alpha_reset",
    );
    const c = computeDatabaseFingerprint(
      "postgres://user:s3cret@127.0.0.1:54329/ostt_dev",
    );
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toMatch(/s3cret|password/i);
    expect(parseDatabaseName("postgres://ostt:ostt@127.0.0.1:54329/ostt_dev")).toBe(
      "ostt_dev",
    );
  });

  it("fails closed in public-demo / missing secret", () => {
    const demo = requireOperatorResetEnv({
      APP_MODE: "public-demo",
      OPERATOR_RESET_SECRET: RESET_SECRET,
      OPERATOR_LABEL: "x",
    });
    expect(demo.ok).toBe(false);

    const missing = requireOperatorResetEnv({
      APP_MODE: "gated",
      DATABASE_URL: "postgres://ostt:ostt@127.0.0.1:54329/ostt_alpha_reset",
      OPERATOR_LABEL: "ops",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("OPERATOR_SECRET_MISSING");
    }
  });

  it("refuses ostt_dev without OSTT_ALLOW_DEV_RESET", async () => {
    const result = await executeAlphaReset(db, {
      reason: "unit refuse dev",
      confirmFingerprint: "irrelevant",
      env: {
        APP_MODE: "gated",
        DATABASE_URL: "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev",
        OPERATOR_RESET_SECRET: RESET_SECRET,
        OPERATOR_LABEL: "ops",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RESET_DEV_DB_REFUSED");
    }
  });

  it("rejects fingerprint mismatch on execute", async () => {
    const result = await executeAlphaReset(db, {
      reason: "unit fingerprint mismatch",
      confirmFingerprint: "not-the-real-fingerprint",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FINGERPRINT_MISMATCH");
    }
  });

  it("dry-run is immutable", async () => {
    const beforeAccounts = await db.select().from(accounts);
    const beforeTopics = await db.select().from(topics);
    const dry = await dryRunAlphaReset(db, {
      reason: "unit dry-run immutability",
    });
    expect(dry.ok).toBe(true);
    if (!dry.ok) {
      return;
    }
    expect(dry.value.dryRun).toBe(true);
    expect(dry.value.counts.after).toEqual(dry.value.counts.before);

    const afterAccounts = await db.select().from(accounts);
    const afterTopics = await db.select().from(topics);
    expect(afterAccounts).toHaveLength(beforeAccounts.length);
    expect(afterTopics).toHaveLength(beforeTopics.length);

    const [ada] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, "account-ostt-synth-ada"))
      .limit(1);
    expect(ada).toBeTruthy();
  });

  it("refuses public-demo mode on execute", async () => {
    const result = await executeAlphaReset(db, {
      reason: "unit wrong mode",
      confirmFingerprint: "irrelevant",
      env: {
        APP_MODE: "public-demo",
        DATABASE_URL: "postgres://ostt:ostt@127.0.0.1:54329/ostt_alpha_reset",
        OPERATOR_RESET_SECRET: RESET_SECRET,
        OPERATOR_LABEL: "ops",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["PUBLIC_DEMO_NO_RESET", "ENV_UNSAFE"]).toContain(result.code);
    }
  });

  it("refuses unclassified tables in the manifest", async () => {
    expect(() =>
      assertManifestComplete([...listSchemaTableNames(), "future_unclassified_table"]),
    ).toThrow(/ALPHA_RESET_MANIFEST_INCOMPLETE|missing classification/i);
  });
});
