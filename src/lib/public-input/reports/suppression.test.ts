import { describe, expect, it } from "vitest";

import {
  applyComplementarySmallCellSuppression,
  PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD,
  SMALL_CELL_POLICY_VERSION,
} from "@/lib/public-input/reports/suppression";

describe("complementary small-cell suppression", () => {
  it("reports genuine zeros as 0, never suppressed and never a suppression victim", () => {
    const { groups } = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.5 },
        { label: "B", share: 0.47 },
        { label: "C", share: 0.03 },
        { label: "Zero", share: 0 },
      ],
      100,
    );
    const zero = groups.find((g) => g.label === "Zero");
    expect(zero).toEqual({ label: "Zero", status: "reported", share: 0 });
  });

  it("suppresses an additional cell when exactly one would be reconstructible", () => {
    const { groups, suppressedCells } = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.5 },
        { label: "B", share: 0.47 },
        { label: "C", share: 0.03 },
        { label: "Zero", share: 0 },
      ],
      100,
    );
    expect(suppressedCells).toBe(2);
    const suppressedLabels = groups
      .filter((g) => g.status === "suppressed")
      .map((g) => g.label)
      .sort();
    expect(suppressedLabels).toEqual(["B", "C"]);
  });

  it("never suppresses shares to 0 — suppressed share is always null", () => {
    const { groups } = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.6 },
        { label: "B", share: 0.396 },
        { label: "C", share: 0.004 },
      ],
      1000,
    );
    for (const group of groups) {
      if (group.status === "suppressed") {
        expect(group.share).toBeNull();
        expect(group.share).not.toBe(0);
      }
    }
  });

  it("does not add extra suppression when zero or two-plus cells are already suppressed", () => {
    const noneSuppressed = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.5 },
        { label: "B", share: 0.5 },
      ],
      1000,
    );
    expect(noneSuppressed.suppressedCells).toBe(0);

    const twoSuppressed = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.98 },
        { label: "B", share: 0.012 },
        { label: "C", share: 0.008 },
      ],
      1000,
    );
    // B (12) and C (8) both < 20-ish? use explicit threshold below.
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.98 },
        { label: "B", share: 0.012 },
        { label: "C", share: 0.008 },
      ],
      1000,
      { threshold: 15 },
    );
    expect(result.suppressedCells).toBe(2);
    void twoSuppressed;
  });

  it("blocks a subtraction/reconstruction attack across versions of the same shape", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.6 },
        { label: "B", share: 0.396 },
        { label: "C", share: 0.004 },
      ],
      1000,
    );
    const reportedSum = result.groups
      .filter((g): g is { label: string; status: "reported"; share: number } =>
        g.status === "reported",
      )
      .reduce((sum, g) => sum + g.share, 0);
    // An attacker computing `1 − reportedSum` must not land close to C's
    // true share (0.004) once complementary suppression has run.
    expect(Math.abs(1 - reportedSum - 0.004)).toBeGreaterThan(0.01);
  });

  it("omits all groups when participation is below the reporting floor", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.6 },
        { label: "B", share: 0.4 },
      ],
      3,
      { threshold: 5 },
    );
    expect(result.groupsOmitted).toBe(true);
    expect(result.groups).toEqual([]);
    expect(result.suppressedCells).toBe(0);
  });

  it("uses an independent minParticipationForGroups when provided", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", share: 0.6 },
        { label: "B", share: 0.4 },
      ],
      8,
      { threshold: 5, minParticipationForGroups: 10 },
    );
    expect(result.groupsOmitted).toBe(true);
  });

  it("is stable / deterministic for tie-broken complementary victim selection by label", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "Zeta", share: 0.2 },
        { label: "Alpha", share: 0.2 },
        { label: "Middle", share: 0.6 - 2 * 0.2 + 0.004 }, // filler
        { label: "Tiny", share: 0.004 },
      ],
      1000,
    );
    // Tiny (implied 4) is suppressed alone; Alpha and Zeta tie at 0.2 share —
    // "Alpha" must win the tie deterministically (ascending label order).
    const suppressedLabels = result.groups
      .filter((g) => g.status === "suppressed")
      .map((g) => g.label)
      .sort();
    expect(suppressedLabels).toContain("Tiny");
    expect(suppressedLabels).toContain("Alpha");
    expect(suppressedLabels).not.toContain("Zeta");
  });

  it("never mutates the input array", () => {
    const input = [
      { label: "A", share: 0.5 },
      { label: "B", share: 0.5 },
    ];
    const frozen = Object.freeze([...input]);
    expect(() =>
      applyComplementarySmallCellSuppression(frozen, 1000),
    ).not.toThrow();
  });

  it("exposes the provisional demo threshold and policy version constants", () => {
    expect(PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD).toBe(5);
    expect(SMALL_CELL_POLICY_VERSION).toBe("4.4.1-complementary");
  });
});
