import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MUTATION_BODY_MAX_BYTES } from "@/lib/security/bounded-json";
import {
  MUTATION_RATE_LIMIT_POLICY,
  resetMutationRateLimiter,
} from "@/lib/security/mutation-rate-limit";

const requireGatedSession = vi.fn();
const requestAccountClosure = vi.fn();
const getGatedDb = vi.fn(() => ({ __mockDb: true }));

vi.mock("@/lib/auth/guard", () => ({
  requireGatedSession: () => requireGatedSession(),
}));

vi.mock("@/lib/auth/runtime", () => ({
  getGatedDb: () => getGatedDb(),
}));

vi.mock("@/lib/privacy/closure", () => ({
  requestAccountClosure: (...args: unknown[]) => requestAccountClosure(...args),
}));

function sameOriginHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    origin: "http://localhost",
    host: "localhost",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    ...extra,
  };
}

describe("POST /api/account/closure-request", () => {
  let previousMode: string | undefined;

  beforeEach(() => {
    previousMode = process.env.APP_MODE;
    process.env.APP_MODE = "gated";
    requireGatedSession.mockReset();
    requestAccountClosure.mockReset();
    getGatedDb.mockClear();
    resetMutationRateLimiter();
  });

  afterEach(() => {
    vi.resetModules();
    resetMutationRateLimiter();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
  });

  it("rejects cross-origin POSTs with no-store before session or domain work", async () => {
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
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string };
    expect(body.code).toMatch(/^CSRF_/);
    expect(requireGatedSession).not.toHaveBeenCalled();
    expect(requestAccountClosure).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("returns generic not-found with no-store in public-demo and skips gated imports", async () => {
    process.env.APP_MODE = "public-demo";
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "demo probe" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(requireGatedSession).not.toHaveBeenCalled();
    expect(requestAccountClosure).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("allows same-origin POSTs past CSRF to the session gate with no-store", async () => {
    requireGatedSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "same-origin probe" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(requestAccountClosure).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("rejects oversized declared bodies with PAYLOAD_TOO_LARGE before domain work", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders({
          "content-length": String(MUTATION_BODY_MAX_BYTES + 1),
        }),
        body: JSON.stringify({ reason: "oversized probe" }),
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(requestAccountClosure).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with no-store before domain work", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INVALID_JSON");
    expect(requestAccountClosure).not.toHaveBeenCalled();
    expect(getGatedDb).not.toHaveBeenCalled();
  });

  it("rate-limits privacy_request family with Retry-After and no domain write", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    requestAccountClosure.mockResolvedValue({
      ok: true,
      value: { requestId: "delreq-test", status: "pending" },
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const limit = MUTATION_RATE_LIMIT_POLICY.privacy_request.accountLimit;
    for (let i = 0; i < limit; i += 1) {
      const okResponse = await POST(
        new Request("http://localhost/api/account/closure-request", {
          method: "POST",
          headers: sameOriginHeaders(),
          body: JSON.stringify({ reason: `allowed ${i}` }),
        }),
      );
      expect(okResponse.status).toBe(200);
    }
    const denied = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "rate limited" }),
      }),
    );
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
    expect(denied.headers.get("Retry-After")).toMatch(/^\d+$/);
    const body = (await denied.json()) as { code?: string };
    expect(body.code).toBe("MUTATION_RATE_LIMITED");
    expect(requestAccountClosure).toHaveBeenCalledTimes(limit);
  });

  it("preserves duplicate-request domain errors without creating another call side effect expectation", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    requestAccountClosure.mockResolvedValue({
      ok: false,
      error: "An open closure/deletion request already exists",
      code: "CLOSURE_REQUEST_EXISTS",
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "duplicate probe" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string; error?: string };
    expect(body.code).toBe("CLOSURE_REQUEST_EXISTS");
    expect(body.error).toMatch(/already exists/i);
  });

  it("maps unexpected internal failures to a stable public error", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    requestAccountClosure.mockResolvedValue({
      ok: false,
      error: "relation account_deletion_requests does not exist",
      code: "CLOSURE_TX_FAILED",
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "internal probe" }),
      }),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string; error?: string };
    expect(body.code).toBe("CLOSURE_REQUEST_FAILED");
    expect(body.error).not.toMatch(/relation|does not exist/i);
    expect(body.error).toMatch(/could not submit the closure request/i);
  });

  it("preserves missing-reason domain errors", async () => {
    requireGatedSession.mockResolvedValue({
      ok: true,
      session: { accountId: "account-ostt-synth-ada" },
    });
    requestAccountClosure.mockResolvedValue({
      ok: false,
      error: "Closure request requires a reason",
      code: "CLOSURE_REASON_REQUIRED",
    });
    const { POST } = await import("@/app/api/account/closure-request/route");
    const response = await POST(
      new Request("http://localhost/api/account/closure-request", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ reason: "" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("CLOSURE_REASON_REQUIRED");
  });
});
