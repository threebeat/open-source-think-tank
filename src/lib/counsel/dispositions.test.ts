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
  it("keeps readiness and activation gates blocking until counsel returns", () => {
    for (const id of READINESS_COUNSEL_GATE_IDS) {
      expect(COUNSEL_DISPOSITIONS[id]?.status).toBe("blocking");
      expect(COUNSEL_DISPOSITIONS[id]?.counselSource).toMatch(
        /counsel-review-packet-2\.12/,
      );
    }
    for (const id of ACTIVATION_COUNSEL_GATE_IDS) {
      expect(COUNSEL_DISPOSITIONS[id]?.status).toBe("blocking");
    }
    expect(activationCounselAllowsRealAccounts()).toBe(false);
    expect(readinessCounselAllowsFoundationTag()).toBe(false);
    expect(blockingReadinessCounselGates().length).toBe(
      READINESS_COUNSEL_GATE_IDS.length,
    );
  });

  it("includes data map / retention as a readiness gate", () => {
    expect(COUNSEL_DISPOSITIONS.data_map_retention?.id).toBe(
      "data_map_retention",
    );
    expect(READINESS_COUNSEL_GATE_IDS).toContain("data_map_retention");
  });
});
