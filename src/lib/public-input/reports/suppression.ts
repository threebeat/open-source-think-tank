/**
 * Complementary small-cell suppression (ADR 0021 + Phase 4.5A exact-count fix).
 *
 * Shared by the synthetic fixture path and gated publish-time projection —
 * one algorithm, two callers.
 *
 * Rules:
 *   1. Suppress any cell whose exact `participantCount` is in (0, threshold).
 *      A genuine zero count stays reported as share `0` (never coerced, never
 *      suppressed). Counts are integers — never inferred via Math.round(share×N).
 *   2. If suppression leaves exactly one suppressed cell among a closed set,
 *      suppress one additional positive cell (smallest count, then label).
 *   3. If `participationCount` is below `minParticipationForGroups`, omit all
 *      group shares.
 *   4. Suppressed cells are always `{ status: "suppressed", share: null }`.
 */

export const SMALL_CELL_POLICY_VERSION = "4.5.1-exact-count-complementary";

/**
 * Algorithm-version snapshot persisted alongside `SMALL_CELL_POLICY_VERSION`
 * on every publish (4.5A.1). Currently identical to the policy version — kept
 * as a distinct named constant so the algorithm implementation can version
 * independently of the policy document in a future package.
 */
export const SMALL_CELL_ALGORITHM_VERSION = SMALL_CELL_POLICY_VERSION;

/** Synthetic public-demo provisional value only — NOT a production privacy decision (OQ27, OQ35). */
export const PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD = 5;

export type SuppressibleGroupInput = {
  label: string;
  /** Exact aggregate participant count for this group (integer). */
  participantCount: number;
};

export type SuppressedGroupCell =
  | { label: string; status: "reported"; share: number }
  | { label: string; status: "suppressed"; share: null };

export type ComplementarySuppressionOptions = {
  threshold?: number;
  minParticipationForGroups?: number;
};

export type ComplementarySuppressionResult = {
  groups: SuppressedGroupCell[];
  suppressedCells: number;
  groupsOmitted: boolean;
  policyVersion: string;
};

function displayShare(participantCount: number, participationCount: number): number {
  if (participationCount <= 0) {
    return 0;
  }
  return participantCount / participationCount;
}

/**
 * Apply complementary small-cell suppression using exact participant counts.
 * Never mutates the input array.
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
    const count = group.participantCount;
    if (count > 0 && count < threshold) {
      suppressedIndexes.add(index);
    }
  });

  if (suppressedIndexes.size === 1) {
    let candidateIndex: number | null = null;
    groups.forEach((group, index) => {
      if (suppressedIndexes.has(index)) {
        return;
      }
      if (!(group.participantCount > 0)) {
        return;
      }
      if (candidateIndex === null) {
        candidateIndex = index;
        return;
      }
      const candidate = groups[candidateIndex]!;
      if (
        group.participantCount < candidate.participantCount ||
        (group.participantCount === candidate.participantCount &&
          group.label < candidate.label)
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
    return {
      label: group.label,
      status: "reported",
      share: displayShare(group.participantCount, participationCount),
    };
  });

  return {
    groups: resultGroups,
    suppressedCells: suppressedIndexes.size,
    groupsOmitted: false,
    policyVersion: SMALL_CELL_POLICY_VERSION,
  };
}
