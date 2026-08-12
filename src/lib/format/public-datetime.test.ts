import { describe, expect, it } from "vitest";

import { formatPublicDateTime } from "@/lib/format/public-datetime";

describe("formatPublicDateTime", () => {
  it("formats ISO timestamps in America/Chicago with timezone label", () => {
    const formatted = formatPublicDateTime("2026-08-11T17:00:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/Aug/);
    expect(formatted).toMatch(/CDT|CST/);
  });

  it("returns a safe fallback for invalid input", () => {
    expect(formatPublicDateTime("not-a-date")).toBe("Date unavailable");
  });
});
