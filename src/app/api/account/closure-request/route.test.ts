import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: vi.fn(async () => ({
    ok: false,
    status: 401,
    error: "Authentication required",
    code: "AUTH_REQUIRED",
  })),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: vi.fn(() => {
    throw new Error("getGatedDb must not run in CSRF route unit tests");
  }),
}));

describe("POST /api/account/closure-request CSRF", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    process.env.APP_MODE = "gated";
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("rejects cross-origin POSTs before mutation", async () => {
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "csrf probe" }),
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toMatch(/^CSRF_/);
  });

  it("allows same-origin POSTs past CSRF to the session gate", async () => {
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          host: "localhost",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "same-origin probe" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
