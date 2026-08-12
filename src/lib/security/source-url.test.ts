import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SOURCE_URL_MAX_LENGTH,
  isAllowedSourceUrl,
  sourceUrlHostname,
  sourceUrlSchema,
  validateSourceUrl,
} from "@/lib/security/source-url";

describe("source URL policy (3.9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid canonical public https URL", () => {
    const result = validateSourceUrl("https://www.tn.gov/health/report");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.canonicalUrl).toBe("https://www.tn.gov/health/report");
      expect(result.hostname).toBe("www.tn.gov");
    }
  });

  it("normalizes mixed-case hosts", () => {
    const result = validateSourceUrl("https://WWW.Example.COM/Path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostname).toBe("www.example.com");
      expect(result.canonicalUrl).toBe("https://www.example.com/Path");
    }
  });

  it("rejects over-limit values", () => {
    const value = `https://www.example.com/${"a".repeat(SOURCE_URL_MAX_LENGTH)}`;
    const result = validateSourceUrl(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("length");
  });

  it("rejects malformed, credentials, control characters, and bad schemes", () => {
    expect(validateSourceUrl("not a url").ok).toBe(false);
    expect(validateSourceUrl("http://www.example.com/a").ok).toBe(false);
    if (!validateSourceUrl("http://www.example.com/a").ok) {
      expect(validateSourceUrl("http://www.example.com/a")).toMatchObject({
        category: "scheme",
      });
    }
    expect(validateSourceUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateSourceUrl("data:text/plain,hi").ok).toBe(false);
    expect(validateSourceUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateSourceUrl("ftp://files.example.com/a").ok).toBe(false);
    expect(validateSourceUrl("//www.example.com/a").ok).toBe(false);
    expect(validateSourceUrl("https://user:pass@www.example.com/a").ok).toBe(
      false,
    );
    expect(validateSourceUrl("https://www.example.com/a path").ok).toBe(false);
    expect(validateSourceUrl("https://www.example.com/\u0001").ok).toBe(false);
    expect(validateSourceUrl("https://www.example.com/%zz").ok).toBe(false);
  });

  it("rejects private, metadata, local, single-label, and non-443 hosts/ports", () => {
    const cases: Array<[string, string]> = [
      ["https://127.0.0.1/a", "host_private"],
      ["https://10.0.0.5/a", "host_private"],
      ["https://192.168.1.1/a", "host_private"],
      ["https://172.16.0.1/a", "host_private"],
      ["https://169.254.169.254/latest", "host_private"],
      ["https://100.64.1.1/a", "host_private"],
      ["https://[::1]/a", "host_private"],
      ["https://[fe80::1]/a", "host_private"],
      ["https://[fc00::1]/a", "host_private"],
      ["https://[::ffff:192.168.0.1]/a", "host_private"],
      ["https://localhost/a", "host_local"],
      ["https://app.localhost/a", "host_local"],
      ["https://printer.local/a", "host_local"],
      ["https://svc.internal/a", "host_local"],
      ["https://intranet/a", "host_single_label"],
      ["https://www.example.com:8443/a", "port"],
    ];
    for (const [url, category] of cases) {
      const result = validateSourceUrl(url);
      expect(result.ok, url).toBe(false);
      if (!result.ok) expect(result.category, url).toBe(category);
    }
  });

  it("exposes helpers and zod transform to canonical form", () => {
    expect(isAllowedSourceUrl("https://www.example.com/ok")).toBe(true);
    expect(isAllowedSourceUrl("http://www.example.com/ok")).toBe(false);
    expect(sourceUrlHostname("https://WWW.Example.com/x?q=1#f")).toBe(
      "www.example.com",
    );
    expect(sourceUrlHostname("http://www.example.com/x")).toBeNull();
    const parsed = sourceUrlSchema.safeParse("https://WWW.Example.COM/report");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe("https://www.example.com/report");
    }
  });

  it("never performs network I/O", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("fetch must not be called");
    });
    validateSourceUrl("https://www.example.com/no-fetch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
