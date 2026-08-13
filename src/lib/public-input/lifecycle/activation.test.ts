import { describe, expect, it } from "vitest";

import {
  LIVE_PUBLIC_INPUT_ACTIVATION_GATES,
  assertLiveProviderDisabled,
  isLiveProviderActivationComplete,
  unresolvedActivationGates,
} from "@/lib/public-input/lifecycle/activation";

describe("Public Input live-provider activation gates (4.3, fail-closed)", () => {
  it("ships with every gate unresolved today", () => {
    expect(LIVE_PUBLIC_INPUT_ACTIVATION_GATES.length).toBeGreaterThan(0);
    for (const gate of LIVE_PUBLIC_INPUT_ACTIVATION_GATES) {
      expect(gate.status).toBe("unresolved");
    }
  });

  it("isLiveProviderActivationComplete is false with the shipped gate list", () => {
    expect(isLiveProviderActivationComplete()).toBe(false);
  });

  it("unresolvedActivationGates returns every shipped gate", () => {
    expect(unresolvedActivationGates()).toHaveLength(
      LIVE_PUBLIC_INPUT_ACTIVATION_GATES.length,
    );
  });

  it("assertLiveProviderDisabled does not throw for the shipped (unresolved) gates", () => {
    expect(() => assertLiveProviderDisabled()).not.toThrow();
  });

  it("an empty gate list must never be treated as activation-complete", () => {
    expect(isLiveProviderActivationComplete([])).toBe(false);
  });

  it("is only complete when every gate is explicitly resolved", () => {
    const allResolved = LIVE_PUBLIC_INPUT_ACTIVATION_GATES.map((gate) => ({
      ...gate,
      status: "resolved" as const,
    }));
    expect(isLiveProviderActivationComplete(allResolved)).toBe(true);
    expect(() => assertLiveProviderDisabled(allResolved)).toThrow(
      /LIVE_PUBLIC_INPUT_ACTIVATION_UNEXPECTEDLY_COMPLETE/,
    );

    const oneUnresolved = allResolved.map((gate, index) =>
      index === 0 ? { ...gate, status: "unresolved" as const } : gate,
    );
    expect(isLiveProviderActivationComplete(oneUnresolved)).toBe(false);
  });
});
