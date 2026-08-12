import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import * as auditLog from "@/lib/auth/audit-log";
import {
  exportStaffTopicPackage,
  staffTopicExportFilename,
} from "@/lib/topics/staff-export";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";
const TOPIC_ID = "topic-ostt-synth-cedar-billing";

describe("staff topic export (3.11)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_staff_export";

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

  it("authorized staff export redacts prohibited fields", async () => {
    const result = await exportStaffTopicPackage(db, ADMIN, TOPIC_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filename).toBe(
      staffTopicExportFilename("ostt-synth-cedar-billing-ops"),
    );
    expect(result.value.bundle.topic.id).toBe(TOPIC_ID);
    expect(result.value.bundle.claims.length).toBeGreaterThan(0);
    expect(result.value.bundle.evidence.length).toBeGreaterThan(0);

    const blob = JSON.stringify(result.value.bundle);
    for (const key of [
      "authorAccountId",
      "submitterAccountId",
      "privateNotes",
      "privateNote",
      "privateDetail",
      "actorAccountId",
      "contactChannel",
    ]) {
      expect(blob).not.toContain(`"${key}"`);
    }
    expect(blob).not.toMatch(/account-ostt-/i);
    expect(blob).not.toContain(ADMIN);
    expect(blob).not.toContain(PARTICIPANT);
  });

  it("audits with metadata-only private payload", async () => {
    const spy = vi.spyOn(auditLog, "appendAuthAudit");
    const result = await exportStaffTopicPackage(db, ADMIN, TOPIC_ID);
    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls.find(
      (entry) =>
        (entry[1] as { action?: string }).action ===
        "topics.staff_export_generated",
    );
    expect(call).toBeTruthy();
    const payload = call![1] as {
      action: string;
      subjectType: string;
      subjectId: string;
      privatePayload: Record<string, unknown>;
    };
    expect(payload.subjectType).toBe("topic");
    expect(payload.subjectId).toBe(TOPIC_ID);
    expect(payload.privatePayload).toMatchObject({
      topicId: TOPIC_ID,
      capability: "topics.export_staff",
      counts: expect.objectContaining({
        claims: expect.any(Number),
        evidence: expect.any(Number),
        links: expect.any(Number),
        revisions: expect.any(Number),
      }),
    });
    const payloadBlob = JSON.stringify(payload.privatePayload);
    expect(payloadBlob).not.toContain("privateNotes");
    expect(payloadBlob).not.toContain("privateDetail");
    spy.mockRestore();
  });

  it("returns TOPIC_NOT_FOUND for unauthorized or nonexistent topics", async () => {
    const unauthorized = await exportStaffTopicPackage(
      db,
      PARTICIPANT,
      TOPIC_ID,
    );
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.code).toBe("TOPIC_NOT_FOUND");
    }

    const missing = await exportStaffTopicPackage(
      db,
      ADMIN,
      "topic-ostt-synth-does-not-exist",
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("TOPIC_NOT_FOUND");
    }
  });

  it("denies staff export in public-demo mode", async () => {
    const priorUrl = process.env.DATABASE_URL;
    const priorAuth = process.env.AUTH_SECRET;
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    try {
      const denied = await exportStaffTopicPackage(db, ADMIN, TOPIC_ID);
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.code).toBe("PUBLIC_DEMO_NO_STAFF_EXPORT");
      }
    } finally {
      process.env.APP_MODE = "gated";
      if (priorUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorUrl;
      if (priorAuth === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = priorAuth;
    }
  });

  it("revalidates source URLs without fetching remotes", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const result = await exportStaffTopicPackage(db, ADMIN, TOPIC_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(fetchSpy).not.toHaveBeenCalled();
      for (const row of result.value.bundle.evidence) {
        if (row.sourceUrl) {
          expect(row.sourceUrl.startsWith("https://")).toBe(true);
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
