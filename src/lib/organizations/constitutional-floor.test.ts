import { describe, expect, it } from "vitest";

import {
  CONSTITUTIONAL_FLOOR_VERSION,
  SYNTHETIC_CONSTITUTIONAL_CONFIG,
  validateConstitutionalFloor,
} from "@/lib/organizations/constitutional-floor";

describe("constitutional floor", () => {
  it("accepts the required boolean floor", () => {
    const result = validateConstitutionalFloor(
      SYNTHETIC_CONSTITUTIONAL_CONFIG,
      { synthetic: false },
    );
    expect(result.ok).toBe(true);
    expect(CONSTITUTIONAL_FLOOR_VERSION).toBe(
      "commonhall-constitutional-floor@1.0.0",
    );
  });

  it("rejects hosted Pol.is and missing neutrality keys", () => {
    const hosted = validateConstitutionalFloor(
      { ...SYNTHETIC_CONSTITUTIONAL_CONFIG, hostedPolisEnabled: true },
      { synthetic: true },
    );
    expect(hosted.ok).toBe(false);
    if (!hosted.ok) {
      expect(hosted.code).toBe("CONSTITUTIONAL_FLOOR_HOSTED_POLIS");
    }

    const rest = { ...SYNTHETIC_CONSTITUTIONAL_CONFIG };
    delete rest.viewpointNeutralModeration;
    const missing = validateConstitutionalFloor(rest, { synthetic: true });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("CONSTITUTIONAL_FLOOR_MISSING");
    }
  });

  it("rejects non-synthetic numeric production defaults (open decisions)", () => {
    const result = validateConstitutionalFloor(
      {
        ...SYNTHETIC_CONSTITUTIONAL_CONFIG,
        consultationThresholds: { acceptance: 0.6 },
        chamber: { size: 9 },
      },
      { synthetic: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CONSTITUTIONAL_FLOOR_NUMERIC_OPEN_DECISION");
      expect(result.error).toMatch(/V2-07/);
    }

    const syntheticOk = validateConstitutionalFloor(
      {
        ...SYNTHETIC_CONSTITUTIONAL_CONFIG,
        consultationThresholds: { acceptance: 0.6 },
      },
      { synthetic: true },
    );
    expect(syntheticOk.ok).toBe(true);
  });
});
