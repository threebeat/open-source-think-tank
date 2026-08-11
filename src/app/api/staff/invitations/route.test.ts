import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertCsrfSafe } from "@/lib/security/csrf";

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

describe("POST /api/staff/invitations CSRF (3.4 follow-up)", () => {
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_csrf_invite";
  });

  afterEach(() => {
    vi.resetModules();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
    if (previousDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDbUrl;
    }
  });

  it("rejects cross-origin POSTs before body handling", async () => {
    const { POST } = await import("@/app/api/staff/invitations/route");
    const response = await POST(
      new Request("http://localhost/api/staff/invitations", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          intendedContactChannel: "csrf-probe@example.test",
        }),
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string; error?: string };
    expect(body.code).toMatch(/^CSRF_/);
    expect(JSON.stringify(body)).not.toContain("csrf-probe@example.test");
  });

  it("allows same-origin POSTs past CSRF to the session gate", async () => {
    expect(() =>
      assertCsrfSafe(
        new Request("http://localhost/api/staff/invitations", {
          method: "POST",
          headers: {
            origin: "http://localhost",
            host: "localhost",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).not.toThrow();

    const { POST } = await import("@/app/api/staff/invitations/route");
    const response = await POST(
      new Request("http://localhost/api/staff/invitations", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          host: "localhost",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          intendedContactChannel: "same-origin@example.test",
        }),
      }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 404 in public-demo without CSRF body work", async () => {
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    delete process.env.OPERATOR_BOOTSTRAP_SECRET;

    const { POST } = await import("@/app/api/staff/invitations/route");
    const response = await POST(
      new Request("http://localhost/api/staff/invitations", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          intendedContactChannel: "demo@example.test",
        }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
