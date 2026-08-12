import { describe, expect, it } from "vitest";

import {
  MUTATION_BODY_MAX_BYTES,
  mutationRateLimitedResponse,
  readBoundedJsonObject,
} from "@/lib/security/bounded-json";

describe("bounded JSON reader (3.9)", () => {
  it("accepts a small JSON object", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    const result = await readBoundedJsonObject(request);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ hello: "world" });
  });

  it("rejects declared oversized Content-Length with 413", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MUTATION_BODY_MAX_BYTES + 1),
      },
      body: "{}",
    });
    const result = await readBoundedJsonObject(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const body = await result.response.json();
      expect(body.code).toBe("PAYLOAD_TOO_LARGE");
      expect(result.response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("rejects streamed bodies above the cap", async () => {
    const oversized = "x".repeat(MUTATION_BODY_MAX_BYTES + 8);
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `"${oversized}"`,
    });
    const result = await readBoundedJsonObject(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rejects malformed or non-object JSON with 400", async () => {
    for (const body of ["{", "[]", "null", '"x"', "1"]) {
      const request = new Request("https://example.test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const result = await readBoundedJsonObject(request);
      expect(result.ok, body).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const json = await result.response.json();
        expect(json.code).toBe("INVALID_JSON");
      }
    }
  });

  it("builds a no-store 429 with integer Retry-After", async () => {
    const response = mutationRateLimitedResponse(0.2);
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("1");
    const body = await response.json();
    expect(body.code).toBe("MUTATION_RATE_LIMITED");
    expect(body.error).toMatch(/Too many attempts/i);
  });
});
