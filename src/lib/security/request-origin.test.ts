import { afterEach, describe, expect, it } from "vitest";

import { resolveRequestOriginRef } from "@/lib/security/request-origin";

describe("request origin refs (3.9)", () => {
  const previousHops = process.env.TRUSTED_PROXY_HOPS;
  const previousSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    if (previousHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = previousHops;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });

  it("ignores forwarded headers when trusted proxy hops are unset", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const request = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    const result = resolveRequestOriginRef(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("untrusted_proxy");
  });

  it("derives an opaque origin ref from trusted forwarded hops", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    process.env.AUTH_SECRET = "test-secret-for-origin-ref";
    const request = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    const result = resolveRequestOriginRef(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.originRef.startsWith("orig_")).toBe(true);
      expect(result.originRef).not.toContain("203.0.113.10");
      expect(result.originRef).not.toContain("10.0.0.1");
    }
  });

  it("rejects invalid hop counts and malformed addresses", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const short = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    expect(resolveRequestOriginRef(short).ok).toBe(false);

    process.env.TRUSTED_PROXY_HOPS = "1";
    const bad = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "not-an-ip, 10.0.0.1" },
    });
    expect(resolveRequestOriginRef(bad).ok).toBe(false);
  });
});
