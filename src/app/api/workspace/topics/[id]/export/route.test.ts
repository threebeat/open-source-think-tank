import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGatedSession = vi.fn();
const exportStaffTopicPackage = vi.fn();
const getGatedDb = vi.fn(() => ({ __mockDb: true }));

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: () => requireGatedSession(),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: () => getGatedDb(),
}));

vi.mock("@/lib/topics/staff-export", () => ({
  exportStaffTopicPackage: (...args: unknown[]) =>
    exportStaffTopicPackage(...args),
}));

describe("GET /api/workspace/topics/[id]/export", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    process.env.APP_MODE = "gated";
    requireGatedSession.mockReset();
    exportStaffTopicPackage.mockReset();
    getGatedDb.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("returns generic not-found with no-store in public-demo and skips services", async () => {
    process.env.APP_MODE = "public-demo";
    const { GET } = await import(
      "@/app/api/workspace/topics/[id]/export/route"
    );
    const response = await GET(
      new Request("http://localhost/api/workspace/topics/x/export"),
      { params: Promise.resolve({ id: "topic-ostt-synth-cedar-billing" }) },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(requireGatedSession).not.toHaveBeenCalled();
    expect(exportStaffTopicPackage).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("returns unauthenticated with no-store", async () => {
    requireGatedSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
    const { GET } = await import(
      "@/app/api/workspace/topics/[id]/export/route"
    );
    const response = await GET(
      new Request("http://localhost/api/workspace/topics/x/export"),
      { params: Promise.resolve({ id: "topic-ostt-synth-cedar-billing" }) },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(exportStaffTopicPackage).not.toHaveBeenCalled();
  });

  it("sets attachment, nosniff, and sanitized filename on success", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-staff-admin" },
    });
    exportStaffTopicPackage.mockResolvedValue({
      ok: true,
      value: {
        bundle: {
          exportedAt: "2026-08-12T00:00:00.000Z",
          topic: { id: "topic-ostt-synth-cedar-billing", slug: "ostt-synth-cedar-billing-ops" },
          claims: [],
          evidence: [],
          links: [],
          publicRationales: [],
          revisionSummaries: [],
          notice: "synthetic",
        },
        filename: "ostt-topic-export-ostt-synth-cedar-billing-ops.json",
      },
    });

    const { GET } = await import(
      "@/app/api/workspace/topics/[id]/export/route"
    );
    const response = await GET(
      new Request(
        "http://localhost/api/workspace/topics/topic-ostt-synth-cedar-billing/export",
      ),
      {
        params: Promise.resolve({ id: "topic-ostt-synth-cedar-billing" }),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ostt-topic-export-ostt-synth-cedar-billing-ops.json"',
    );
  });

  it("maps unauthorized/missing to 404 TOPIC_NOT_FOUND with no-store", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    exportStaffTopicPackage.mockResolvedValue({
      ok: false,
      error: "Topic not found",
      code: "TOPIC_NOT_FOUND",
    });

    const { GET } = await import(
      "@/app/api/workspace/topics/[id]/export/route"
    );
    const response = await GET(
      new Request(
        "http://localhost/api/workspace/topics/topic-ostt-synth-cedar-billing/export",
      ),
      {
        params: Promise.resolve({ id: "topic-ostt-synth-cedar-billing" }),
      },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("TOPIC_NOT_FOUND");
  });
});
