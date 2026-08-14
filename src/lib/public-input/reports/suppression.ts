/**
 * Complementary small-cell suppression (ADR 0021).
 *
 * Shared by the synthetic fixture path (src/features/public-input/aggregate-report.ts)
 * and the gated publish-time projection (src/lib/public-input/reports/projection.ts) —
 * one algorithm, two callers, so demo and gated reports can never silently drift apart.
 *
 * Rules:
 *   1. Suppress any cell whose implied participant count is in (0, threshold).
 *      A genuine zero share stays reported as `0` (never coerced, never suppressed).
 *   2. If suppression leaves exactly one suppressed cell among a closed set of
 *      shares, an observer can reconstruct it via `total − sum(reported)`.
 *      Block that by suppressing one additional cell: the smallest positive
 *      reported share, tie-broken by ascending label for determinism.
 *   3. If `participationCount` is below `minParticipationForGroups`, omit all
 *      group shares outright (the whole partition is too small to protect
 *      any single cell without materially distorting the shape).
 *   4. Suppressed cells are always `{ status: "suppressed", share: null }` —
 *      never `0`, never silently dropped without a status.
 */

export const SMALL_CELL_POLICY_VERSION = "4.4.1-complementary";

/** Synthetic public-demo provisional value only — NOT a production privacy decision (OQ27, OQ35). */
export const PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD = 5;

export type SuppressibleGroupInput = {
  label: string;
  share: number;
};

export type SuppressedGroupCell =
  | { label: string; status: "reported"; share: number }
  | { label: string; status: "suppressed"; share: null };

export type ComplementarySuppressionOptions = {
  /** Implied-cell-size threshold below which a positive cell is suppressed. */
  threshold?: number;
  /**
   * Below this participation count, all group shares are omitted rather than
   * suppressed piecemeal. Defaults to `threshold` when not given.
   */
  minParticipationForGroups?: number;
};

export type ComplementarySuppressionResult = {
  groups: SuppressedGroupCell[];
  suppressedCells: number;
  /** True when the whole partition was omitted for insufficient participation. */
  groupsOmitted: boolean;
  policyVersion: string;
};

function impliedCellSize(share: number, participationCount: number): number {
  return Math.round(share * participationCount);
}

/**
 * Apply complementary small-cell suppression to a set of opinion-group
 * shares. Never mutates the input array.
 */
export function applyComplementarySmallCellSuppression(
  groups: readonly SuppressibleGroupInput[],
  participationCount: number,
  options: ComplementarySuppressionOptions = {},
): ComplementarySuppressionResult {
  const threshold = options.threshold ?? PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD;
  const minParticipationForGroups =
    options.minParticipationForGroups ?? threshold;

  if (participationCount < minParticipationForGroups) {
    return {
      groups: [],
      suppressedCells: 0,
      groupsOmitted: true,
      policyVersion: SMALL_CELL_POLICY_VERSION,
    };
  }

  const suppressedIndexes = new Set<number>();
  groups.forEach((group, index) => {
    const implied = impliedCellSize(group.share, participationCount);
    if (implied > 0 && implied < threshold) {
      suppressedIndexes.add(index);
    }
  });

  // Complementary rule: exactly one suppressed cell is reconstructible from
  // the total and the remaining reported shares — suppress one more.
  if (suppressedIndexes.size === 1) {
    let candidateIndex: number | null = null;
    groups.forEach((group, index) => {
      if (suppressedIndexes.has(index)) {
        return;
      }
      if (!(group.share > 0)) {
        // Genuine zeros are never chosen as the complementary victim.
        return;
      }
      if (candidateIndex === null) {
        candidateIndex = index;
        return;
      }
      const candidate = groups[candidateIndex]!;
      if (
        group.share < candidate.share ||
        (group.share === candidate.share && group.label < candidate.label)
      ) {
        candidateIndex = index;
      }
    });
    if (candidateIndex !== null) {
      suppressedIndexes.add(candidateIndex);
    }
  }

  const resultGroups: SuppressedGroupCell[] = groups.map((group, index) => {
    if (suppressedIndexes.has(index)) {
      return { label: group.label, status: "suppressed", share: null };
    }
    return { label: group.label, status: "reported", share: group.share };
  });

  return {
    groups: resultGroups,
    suppressedCells: suppressedIndexes.size,
    groupsOmitted: false,
    policyVersion: SMALL_CELL_POLICY_VERSION,
  };
}
