import { describe, expect, it } from "vitest";

import {
  applyComplementarySmallCellSuppression,
  PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD,
  SMALL_CELL_POLICY_VERSION,
} from "@/lib/public-input/reports/suppression";

describe("complementary small-cell suppression (exact participantCount)", () => {
  it("reports genuine zeros as 0, never suppressed and never a suppression victim", () => {
    const { groups } = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 50 },
        { label: "B", participantCount: 47 },
        { label: "C", participantCount: 3 },
        { label: "Zero", participantCount: 0 },
      ],
      100,
    );
    const zero = groups.find((g) => g.label === "Zero");
    expect(zero).toEqual({ label: "Zero", status: "reported", share: 0 });
  });

  it("suppresses an additional cell when exactly one would be reconstructible", () => {
    const { groups, suppressedCells } = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 50 },
        { label: "B", participantCount: 47 },
        { label: "C", participantCount: 3 },
        { label: "Zero", participantCount: 0 },
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
        { label: "A", participantCount: 600 },
        { label: "B", participantCount: 396 },
        { label: "C", participantCount: 4 },
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
        { label: "A", participantCount: 500 },
        { label: "B", participantCount: 500 },
      ],
      1000,
    );
    expect(noneSuppressed.suppressedCells).toBe(0);

    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 980 },
        { label: "B", participantCount: 12 },
        { label: "C", participantCount: 8 },
      ],
      1000,
      { threshold: 15 },
    );
    expect(result.suppressedCells).toBe(2);
  });

  it("blocks a subtraction/reconstruction attack across versions of the same shape", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 600 },
        { label: "B", participantCount: 396 },
        { label: "C", participantCount: 4 },
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
        { label: "A", participantCount: 2 },
        { label: "B", participantCount: 1 },
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
        { label: "A", participantCount: 5 },
        { label: "B", participantCount: 3 },
      ],
      8,
      { threshold: 5, minParticipationForGroups: 10 },
    );
    expect(result.groupsOmitted).toBe(true);
  });

  it("is stable / deterministic for tie-broken complementary victim selection by label", () => {
    const result = applyComplementarySmallCellSuppression(
      [
        { label: "Zeta", participantCount: 200 },
        { label: "Alpha", participantCount: 200 },
        { label: "Middle", participantCount: 596 },
        { label: "Tiny", participantCount: 4 },
      ],
      1000,
    );
    // Tiny (4) is suppressed alone; Alpha and Zeta tie at 200 —
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
      { label: "A", participantCount: 500 },
      { label: "B", participantCount: 500 },
    ];
    const frozen = Object.freeze([...input]);
    expect(() =>
      applyComplementarySmallCellSuppression(frozen, 1000),
    ).not.toThrow();
  });

  it("uses exact participantCount — never rounds a fractional share across the threshold", () => {
    // Under the old Math.round(share×N) bug, an implied 4.6 would round to 5
    // and escape suppression. Exact count 4 must suppress (and take a
    // complementary victim so the cell is not reconstructible).
    const below = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 996 },
        { label: "B", participantCount: 4 },
      ],
      1000,
    );
    expect(below.groups.find((g) => g.label === "B")?.status).toBe(
      "suppressed",
    );
    expect(below.suppressedCells).toBe(2);

    // Exact count at the threshold stays reported (no round-down either).
    const atThreshold = applyComplementarySmallCellSuppression(
      [
        { label: "A", participantCount: 995 },
        { label: "B", participantCount: 5 },
      ],
      1000,
    );
    expect(atThreshold.suppressedCells).toBe(0);
    expect(atThreshold.groups.every((g) => g.status === "reported")).toBe(true);
  });

  it("exposes the provisional demo threshold and exact-count policy version", () => {
    expect(PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD).toBe(5);
    expect(SMALL_CELL_POLICY_VERSION).toBe("4.5.1-exact-count-complementary");
  });
});
