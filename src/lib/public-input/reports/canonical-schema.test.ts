import { describe, expect, it } from "vitest";

import {
  CANONICAL_IMPORT_SCHEMA_VERSION,
  MAX_FINDINGS_PER_KIND,
  MAX_OPINION_GROUPS,
  validateCanonicalAggregateImport,
} from "@/lib/public-input/reports/canonical-schema";

function basePayload(): Record<string, unknown> {
  return {
    schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
    sourceKind: "fixture",
    methodVersion: "public-input-aggregate@4.4.0-test",
    publicTitle: "Drought surcharge aggregate report",
    participationCount: 1240,
    commentCount: 86,
    voteCount: 18420,
    participationSufficiency: "Meets the illustrative coverage floor.",
    representationLimitations: "Not a representative sample.",
    opinionGroups: [
      { label: "Group A", share: 0.6 },
      { label: "Group B", share: 0.4 },
    ],
    crossGroupAgreement: ["Publish thresholds before any surcharge applies."],
    meaningfulDisagreement: ["Graduated surcharge versus flat fee."],
  };
}

describe("canonical aggregate import schema", () => {
  it("accepts a well-formed fixture/manual_aggregate payload", () => {
    const result = validateCanonicalAggregateImport(basePayload());
    expect(result.ok).toBe(true);
  });

  it.each(["fixture", "manual_aggregate"])(
    "accepts operational sourceKind %s",
    (sourceKind) => {
      const result = validateCanonicalAggregateImport({
        ...basePayload(),
        sourceKind,
      });
      expect(result.ok).toBe(true);
    },
  );

  it.each(["polis_hosted", "polis_self_hosted", "live", "unknown"])(
    "rejects live/unknown provider sourceKind %s (fail closed)",
    (sourceKind) => {
      const result = validateCanonicalAggregateImport({
        ...basePayload(),
        sourceKind,
      });
      expect(result.ok).toBe(false);
    },
  );

  it("rejects unknown top-level keys (strict schema)", () => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      extraField: "should not be allowed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("IMPORT_PAYLOAD_SCHEMA_INVALID");
    }
  });

  it.each([
    "providerParticipantId",
    "accountId",
    "voteRows",
    "voteMatrix",
    "xid",
    "rawProviderUrl",
    "accessToken",
    "email",
    "token",
    "secret",
    "password",
  ])("rejects a forbidden key %s at the top level", (forbiddenKey) => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      [forbiddenKey]: "smuggled-value",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("IMPORT_PAYLOAD_FORBIDDEN_KEYS");
    }
  });

  it("rejects a forbidden key nested inside an opinion group (recursive walk)", () => {
    const payload = basePayload();
    (payload.opinionGroups as unknown[]).push({
      label: "Group C",
      share: 0.1,
      xid: "smuggled",
    });
    const result = validateCanonicalAggregateImport(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("IMPORT_PAYLOAD_FORBIDDEN_KEYS");
      expect(result.issues.join(",")).toMatch(/xid/);
    }
  });

  it("rejects a forbidden key nested several levels deep", () => {
    const payload: Record<string, unknown> = {
      ...basePayload(),
      nested: { deeper: { deepest: { voteMatrix: [[1, 0], [0, 1]] } } },
    };
    const result = validateCanonicalAggregateImport(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("IMPORT_PAYLOAD_FORBIDDEN_KEYS");
    }
  });

  it("rejects shares outside [0, 1]", () => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      opinionGroups: [{ label: "Group A", share: 1.5 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects negative or non-integer counts", () => {
    expect(
      validateCanonicalAggregateImport({
        ...basePayload(),
        participationCount: -1,
      }).ok,
    ).toBe(false);
    expect(
      validateCanonicalAggregateImport({
        ...basePayload(),
        participationCount: 1.5,
      }).ok,
    ).toBe(false);
  });

  it("rejects unsafe integers", () => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      participationCount: Number.MAX_SAFE_INTEGER + 10,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects blank required text fields", () => {
    expect(
      validateCanonicalAggregateImport({
        ...basePayload(),
        publicTitle: "   ",
      }).ok,
    ).toBe(false);
    expect(
      validateCanonicalAggregateImport({
        ...basePayload(),
        participationSufficiency: "",
      }).ok,
    ).toBe(false);
  });

  it(`rejects more than ${MAX_OPINION_GROUPS} opinion groups`, () => {
    const tooMany = Array.from({ length: MAX_OPINION_GROUPS + 1 }, (_, i) => ({
      label: `Group ${i}`,
      share: 1 / (MAX_OPINION_GROUPS + 1),
    }));
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      opinionGroups: tooMany,
    });
    expect(result.ok).toBe(false);
  });

  it(`rejects more than ${MAX_FINDINGS_PER_KIND} findings of a single kind`, () => {
    const tooMany = Array.from(
      { length: MAX_FINDINGS_PER_KIND + 1 },
      (_, i) => `Finding ${i}`,
    );
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      crossGroupAgreement: tooMany,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported schemaVersion", () => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      schemaVersion: "public-input-aggregate-import@999",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-object payloads", () => {
    expect(validateCanonicalAggregateImport(null).ok).toBe(false);
    expect(validateCanonicalAggregateImport("string").ok).toBe(false);
    expect(validateCanonicalAggregateImport([1, 2, 3]).ok).toBe(false);
  });

  it("rejects an overly long finding statement", () => {
    const result = validateCanonicalAggregateImport({
      ...basePayload(),
      crossGroupAgreement: ["x".repeat(501)],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts an optional generatedAt / providerExportVersionLabel and rejects malformed generatedAt", () => {
    const ok = validateCanonicalAggregateImport({
      ...basePayload(),
      generatedAt: "2026-03-01T18:00:00.000Z",
      providerExportVersionLabel: "export-v3",
    });
    expect(ok.ok).toBe(true);

    const bad = validateCanonicalAggregateImport({
      ...basePayload(),
      generatedAt: "not-a-date",
    });
    expect(bad.ok).toBe(false);
  });
});
