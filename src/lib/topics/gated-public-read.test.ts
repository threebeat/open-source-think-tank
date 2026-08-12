import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { topics } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";

const getTopicBySlug = vi.fn();
const loadProjectionInputs = vi.fn();

vi.mock("@/lib/topics/repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/topics/repository")>();
  return {
    ...actual,
    getTopicBySlug: (...args: unknown[]) => getTopicBySlug(...args),
  };
});

vi.mock("@/lib/topics/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/topics/publish")>();
  return {
    ...actual,
    loadProjectionInputs: (...args: unknown[]) => loadProjectionInputs(...args),
  };
});

import {
  getPublishedTopicProjection,
  listPublishedTopicsForPublic,
} from "@/lib/topics/gated-public-read";

describe("gated public read (3.10)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let realGetTopicBySlug: typeof import("@/lib/topics/repository").getTopicBySlug;
  let realLoadProjectionInputs: typeof import("@/lib/topics/publish").loadProjectionInputs;

  async function useRealLookups() {
    getTopicBySlug.mockImplementation(realGetTopicBySlug);
    loadProjectionInputs.mockImplementation(realLoadProjectionInputs);
  }

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

    const realRepo =
      await vi.importActual<typeof import("@/lib/topics/repository")>(
        "@/lib/topics/repository",
      );
    const realPublish =
      await vi.importActual<typeof import("@/lib/topics/publish")>(
        "@/lib/topics/publish",
      );
    realGetTopicBySlug = realRepo.getTopicBySlug;
    realLoadProjectionInputs = realPublish.loadProjectionInputs;
    await useRealLookups();
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  afterEach(async () => {
    await useRealLookups();
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

  it("normalizes thrown topic lookup failure to PUBLIC_TOPIC_PROJECTION_UNAVAILABLE", async () => {
    getTopicBySlug.mockRejectedValue(new Error("forced topic lookup failure"));
    const result = await getPublishedTopicProjection(
      db,
      "ostt-synth-cedar-billing-ops",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PUBLIC_TOPIC_PROJECTION_UNAVAILABLE");
      expect(result.error).not.toMatch(/forced topic lookup/i);
    }
  });

  it("normalizes thrown projection-input failure to PUBLIC_TOPIC_PROJECTION_UNAVAILABLE", async () => {
    loadProjectionInputs.mockRejectedValue(
      new Error("forced projection input failure"),
    );
    const result = await getPublishedTopicProjection(
      db,
      "ostt-synth-cedar-billing-ops",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PUBLIC_TOPIC_PROJECTION_UNAVAILABLE");
      expect(result.error).not.toMatch(/forced projection input/i);
    }
  });

  it("normalizes AdapterResult failure from getTopicBySlug (no code passthrough)", async () => {
    getTopicBySlug.mockResolvedValue({
      ok: false,
      error: "Gated persistence unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_GATED_DB",
    });
    const result = await getPublishedTopicProjection(
      db,
      "ostt-synth-cedar-billing-ops",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PUBLIC_TOPIC_PROJECTION_UNAVAILABLE");
      expect(result.code).not.toBe("PUBLIC_DEMO_NO_GATED_DB");
    }
  });

  it("keeps missing/unpublished as ok:true value:null (not unavailable)", async () => {
    const unpublishedSlug = "ostt-synth-empty-shell-unpublished-probe";
    await db.insert(topics).values({
      id: "topic-ostt-synth-empty-shell-unpublished",
      slug: unpublishedSlug,
      title: "ostt-synth unpublished empty shell",
      question: "Synthetic unpublished question?",
      background: "Synthetic unpublished background.",
      scope: "Synthetic unpublished scope.",
      workflowState: "draft",
      publicationStatus: "unpublished",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      createdByAccountId: "account-ostt-synth-staff-admin",
      publishedAt: null,
      publishedByAccountId: null,
      synthetic: true,
    });

    const missing = await getPublishedTopicProjection(db, "no-such-slug-xyz");
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.value).toBeNull();

    const unpublished = await getPublishedTopicProjection(db, unpublishedSlug);
    expect(unpublished.ok).toBe(true);
    if (unpublished.ok) expect(unpublished.value).toBeNull();
  });

  it("returns a safe empty shell for published topic with zero eligible claims/evidence", async () => {
    const slug = "ostt-synth-empty-published-shell";
    await db.insert(topics).values({
      id: "topic-ostt-synth-empty-published-shell",
      slug,
      title: "ostt-synth empty published shell",
      question: "Synthetic empty published question?",
      background: "Synthetic empty published background.",
      scope: "Synthetic empty published scope.",
      workflowState: "open_for_submissions",
      publicationStatus: "published",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      createdByAccountId: "account-ostt-synth-staff-admin",
      publishedAt: new Date("2026-08-06T00:00:00.000Z"),
      publishedByAccountId: "account-ostt-synth-staff-admin",
      synthetic: true,
    });

    const { insertClaim } = await import("@/lib/claims/repository");
    const draft = await insertClaim(db, {
      topicId: "topic-ostt-synth-empty-published-shell",
      authorAccountId: "account-ostt-synth-ada",
      title: "ostt-synth draft-only excluded claim",
      summary: "Synthetic draft claim excluded from public projection.",
      approachLabel: "Excluded",
      synthetic: true,
      workflowState: "draft",
    });
    expect(draft.ok).toBe(true);

    const result = await getPublishedTopicProjection(db, slug);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) {
      throw new Error("expected empty published shell");
    }
    expect(result.value.slug).toBe(slug);
    expect(result.value.claims).toEqual([]);
    expect(result.value.evidence).toEqual([]);
    expect(JSON.stringify(result.value)).not.toContain("account-ostt-synth");
    expect(JSON.stringify(result.value)).not.toContain("draft-only excluded");
  });
});
