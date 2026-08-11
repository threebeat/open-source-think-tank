import { describe, expect, it } from "vitest";

import {
  ACTIVATION_COUNSEL_GATE_IDS,
  COUNSEL_DISPOSITIONS,
  READINESS_COUNSEL_GATE_IDS,
  activationCounselAllowsRealAccounts,
  blockingReadinessCounselGates,
  readinessCounselAllowsFoundationTag,
} from "@/lib/counsel/dispositions";

describe("counsel dispositions", () => {
  it("records alpha-test interim council clearances for readiness and activation", () => {
    for (const id of READINESS_COUNSEL_GATE_IDS) {
      expect(COUNSEL_DISPOSITIONS[id]?.status).toBe("cleared");
      expect(COUNSEL_DISPOSITIONS[id]?.counselSource).toMatch(
        /0007-alpha-test-interim-council-dispositions/,
      );
      expect(COUNSEL_DISPOSITIONS[id]?.scope.toLowerCase()).toMatch(/alpha-test/);
    }
    for (const id of ACTIVATION_COUNSEL_GATE_IDS) {
      expect(COUNSEL_DISPOSITIONS[id]?.status).toBe("cleared");
    }
    expect(activationCounselAllowsRealAccounts()).toBe(true);
    expect(readinessCounselAllowsFoundationTag()).toBe(true);
    expect(blockingReadinessCounselGates()).toHaveLength(0);
  });

  it("includes data map / retention as a readiness gate", () => {
    expect(COUNSEL_DISPOSITIONS.data_map_retention?.id).toBe(
      "data_map_retention",
    );
    expect(READINESS_COUNSEL_GATE_IDS).toContain("data_map_retention");
  });
});
