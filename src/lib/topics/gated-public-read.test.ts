import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  getPublishedTopicProjection,
  listPublishedTopicsForPublic,
} from "@/lib/topics/gated-public-read";

describe("gated public read (3.10)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_public_read";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  it("returns null for missing or unpublished slugs (generic not-found)", async () => {
    const missing = await getPublishedTopicProjection(
      db,
      "does-not-exist-unpublished-slug",
    );
    expect(missing.ok).toBe(true);
    if (missing.ok) {
      expect(missing.value).toBeNull();
    }
  });

  it("returns a published projection that includes evidence conflict summaries", async () => {
    const result = await getPublishedTopicProjection(
      db,
      "ostt-synth-cedar-billing-ops",
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) {
      throw new Error("expected published projection");
    }
    expect(result.value.claims.length).toBeGreaterThan(0);
    expect(result.value.evidence.length).toBeGreaterThan(0);
    const withConflict = result.value.evidence.find(
      (row) => row.conflictPublicSummary,
    );
    expect(withConflict?.conflictPublicSummary).toMatch(/consulting stipend/i);
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toContain(
      "Synthetic evidence private detail for staff boundary drills",
    );
    expect(serialized).not.toContain("privateDetail");
    expect(serialized).not.toContain("account-ostt-synth");
  });

  it("lists published topics newest-first with operational labels", async () => {
    const listed = await listPublishedTopicsForPublic(db);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.some((row) => row.slug === "ostt-synth-cedar-billing-ops")).toBe(
      true,
    );
    for (const row of listed.value) {
      expect(row.operationalLabel.length).toBeGreaterThan(0);
      expect(JSON.stringify(row)).not.toContain("account-");
    }
    const dates = listed.value.map((row) => row.publishedAt);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });
});
