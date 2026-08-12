import { describe, expect, it } from "vitest";

import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";

describe("csrf helpers", () => {
  it("allows same-origin mutating requests", () => {
    expect(() =>
      assertCsrfSafe(
        new Request("http://localhost/api/example", {
          method: "POST",
          headers: {
            origin: "http://localhost",
            host: "localhost",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects cross-origin mutating requests", () => {
    expect(() =>
      assertCsrfSafe(
        new Request("http://localhost/api/example", {
          method: "POST",
          headers: {
            origin: "http://evil.example",
            host: "localhost",
          },
        }),
      ),
    ).toThrow("CSRF_ORIGIN_MISMATCH");
  });

  it("returns a no-store CSRF denial response", () => {
    const response = csrfDeniedResponse(new Error("CSRF_ORIGIN_MISMATCH"));
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
