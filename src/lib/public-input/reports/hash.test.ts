import { describe, expect, it } from "vitest";

import {
  canonicalHashOf,
  canonicalStringify,
  isValidCanonicalHash,
  sha256Hex,
} from "@/lib/public-input/reports/hash";
import { CANONICAL_IMPORT_SCHEMA_VERSION } from "@/lib/public-input/reports/canonical-schema";

describe("canonical hash", () => {
  it("produces an identical hash regardless of key insertion order", () => {
    const a = {
      b: 1,
      a: 2,
      opinionGroups: [{ label: "X", participantCount: 50 }],
    };
    const b = {
      a: 2,
      opinionGroups: [{ participantCount: 50, label: "X" }],
      b: 1,
    };
    expect(canonicalHashOf(a)).toBe(canonicalHashOf(b));
  });

  it("preserves array order (order is meaningful for display order)", () => {
    const a = { items: ["first", "second"] };
    const b = { items: ["second", "first"] };
    expect(canonicalHashOf(a)).not.toBe(canonicalHashOf(b));
  });

  it("is a deterministic sha256 hex digest matching the canonical hash pattern", () => {
    const hash = canonicalHashOf({ hello: "world" });
    expect(isValidCanonicalHash(hash)).toBe(true);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(sha256Hex(canonicalStringify({ hello: "world" })));
  });

  it("is idempotent across repeated calls with the same payload", () => {
    const payload = {
      schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
      publicTitle: "Title from payload",
      opinionGroups: [
        { label: "Group A", participantCount: 50 },
        { label: "Group B", participantCount: 50 },
      ],
    };
    const first = canonicalHashOf(payload);
    const second = canonicalHashOf(JSON.parse(JSON.stringify(payload)));
    expect(first).toBe(second);
  });

  it("includes payload publicTitle in the hash (outer request title is irrelevant)", () => {
    const base = {
      schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
      publicTitle: "Canonical title",
      opinionGroups: [{ label: "A", participantCount: 100 }],
    };
    const changedTitle = {
      ...base,
      publicTitle: "Different canonical title",
    };
    expect(canonicalHashOf(base)).not.toBe(canonicalHashOf(changedTitle));
    // Fields that are not part of the hashed payload (e.g. an outer form title)
    // cannot affect the digest when omitted from the object being hashed.
    expect(canonicalHashOf(base)).toBe(
      canonicalHashOf({ ...base /* no outerTitle field */ }),
    );
  });

  it("rejects non-finite numbers rather than silently hashing NaN/Infinity", () => {
    expect(() => canonicalStringify({ x: Number.NaN })).toThrow(
      /CANONICAL_JSON_NON_FINITE_NUMBER/,
    );
    expect(() => canonicalStringify({ x: Infinity })).toThrow(
      /CANONICAL_JSON_NON_FINITE_NUMBER/,
    );
  });

  it("distinguishes payloads that differ only in nested values", () => {
    const a = { opinionGroups: [{ label: "A", participantCount: 50 }] };
    const b = { opinionGroups: [{ label: "A", participantCount: 51 }] };
    expect(canonicalHashOf(a)).not.toBe(canonicalHashOf(b));
  });

  it("rejects an obviously-invalid hash string", () => {
    expect(isValidCanonicalHash("not-a-hash")).toBe(false);
    expect(isValidCanonicalHash("A".repeat(64))).toBe(false); // uppercase hex rejected
  });
});
