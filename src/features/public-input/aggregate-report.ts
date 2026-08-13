import {
  SMALL_CELL_SUPPRESSION_THRESHOLD,
  type PublicInputAggregateReport,
  publicInputAggregateReports,
} from "@/fixtures/journey-catalog";
import {
  PUBLIC_INPUT_FORBIDDEN_KEYS,
  findForbiddenPublicInputKeys,
} from "@/lib/public-input/reports/forbidden-keys";
import {
  applyComplementarySmallCellSuppression,
  SMALL_CELL_POLICY_VERSION,
  type SuppressedGroupCell,
} from "@/lib/public-input/reports/suppression";

/**
 * Keys that must never appear anywhere in a public Public Input DTO
 * (including nested objects/arrays). Case-sensitive exact key match.
 * Re-exported from the shared lib list so the fixture path and the gated
 * report path can never drift apart (ADR 0018/0021).
 */
export const PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS = PUBLIC_INPUT_FORBIDDEN_KEYS;

export type OpinionGroupCell = SuppressedGroupCell;

export type PublicInputPublicDto = {
  synthetic: boolean;
  topicSlug: string;
  /** Always reportable aggregate totals (not per-person). */
  participationCount: number;
  commentTotal: number;
  voteTotal: number;
  opinionGroups: OpinionGroupCell[];
  crossGroupAgreement: string[];
  meaningfulDisagreement: string[];
  participationSufficiency: string;
  representationLimitations: string;
  methodVersion: string;
  importTimestamp: string;
  smallCellSuppressionThreshold: number;
  smallCellSuppressionNotice: string;
  suppressedCells: number;
  /** True when the whole opinion-group partition was omitted for insufficient participation. */
  groupsOmitted: boolean;
  smallCellSuppressionPolicyVersion: string;
  providerNotice: string;
  /**
   * Documentation of which totals are always reportable, suppressible, or never public.
   * Present for auditors and tests — not a composite score.
   */
  cellPolicy: {
    alwaysReportable: string[];
    suppressible: string[];
    neverPublic: string[];
  };
};

export const PUBLIC_INPUT_CELL_POLICY = {
  alwaysReportable: [
    "participationCount",
    "commentTotal",
    "voteTotal",
    "methodVersion",
    "importTimestamp",
    "crossGroupAgreement (statement text aggregates)",
    "meaningfulDisagreement (statement text aggregates)",
  ],
  suppressible: [
    "opinionGroups[].share when implied cell size is positive and below threshold",
    "opinionGroups[].share complementary victim when exactly one cell would otherwise be reconstructible",
  ],
  neverPublic: [...PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS],
} as const;

/**
 * Apply complementary small-cell suppression to group shares. Demo
 * provisional threshold is 5; production threshold requires privacy review
 * (OQ27, OQ35). Returns explicit status so a genuine zero and a suppressed
 * cell are never the same value, and so a lone suppressed cell can never be
 * reconstructed from the remaining reported shares (ADR 0021).
 */
export function applyComplementarySuppressionToReport(
  report: PublicInputAggregateReport,
  threshold: number = SMALL_CELL_SUPPRESSION_THRESHOLD,
): { groups: OpinionGroupCell[]; suppressedCells: number; groupsOmitted: boolean } {
  const result = applyComplementarySmallCellSuppression(
    report.opinionGroups,
    report.participationCount,
    { threshold },
  );
  return {
    groups: result.groups,
    suppressedCells: result.suppressedCells,
    groupsOmitted: result.groupsOmitted,
  };
}

export function formatOpinionGroupShare(cell: OpinionGroupCell): string {
  if (cell.status === "suppressed") {
    return "Suppressed";
  }
  return `${(cell.share * 100).toFixed(0)}%`;
}

/**
 * Lane-agnostic builder: assembles the public DTO shape from any aggregate
 * report-like input, given an explicit `synthetic` flag. The fixture path
 * (`toPublicInputPublicDto`) always passes `synthetic: true`; a future gated
 * projection can reuse this with `synthetic: false` for a real (non-fixture)
 * `manual_aggregate` import without duplicating suppression/DTO logic.
 */
export function buildPublicInputPublicDto(
  report: PublicInputAggregateReport,
  options: { synthetic: boolean } = { synthetic: true },
): PublicInputPublicDto {
  const { groups, suppressedCells, groupsOmitted } =
    applyComplementarySuppressionToReport(
      report,
      report.smallCellSuppressionThreshold,
    );
  return {
    synthetic: options.synthetic,
    topicSlug: report.topicSlug,
    participationCount: report.participationCount,
    commentTotal: report.commentTotal,
    voteTotal: report.voteTotal,
    opinionGroups: groups,
    crossGroupAgreement: [...report.crossGroupAgreement],
    meaningfulDisagreement: [...report.meaningfulDisagreement],
    participationSufficiency: report.participationSufficiency,
    representationLimitations: report.representationLimitations,
    methodVersion: report.methodVersion,
    importTimestamp: report.importTimestamp,
    smallCellSuppressionThreshold: report.smallCellSuppressionThreshold,
    smallCellSuppressionNotice: report.smallCellSuppressionNotice,
    suppressedCells,
    groupsOmitted,
    smallCellSuppressionPolicyVersion: SMALL_CELL_POLICY_VERSION,
    providerNotice:
      "Synthetic Public Input report only. Not connected to Pol.is. Pol.is is an input, not a decision-maker.",
    cellPolicy: {
      alwaysReportable: [...PUBLIC_INPUT_CELL_POLICY.alwaysReportable],
      suppressible: [...PUBLIC_INPUT_CELL_POLICY.suppressible],
      neverPublic: [...PUBLIC_INPUT_CELL_POLICY.neverPublic],
    },
  };
}

export function toPublicInputPublicDto(
  report: PublicInputAggregateReport,
): PublicInputPublicDto {
  return buildPublicInputPublicDto(report, { synthetic: true });
}

export function getPublicInputPublicDto(
  topicSlug: string,
): PublicInputPublicDto | null {
  const report = publicInputAggregateReports.find(
    (item) => item.topicSlug === topicSlug,
  );
  if (!report) {
    return null;
  }
  return toPublicInputPublicDto(report);
}

/**
 * Recursive walker: collect forbidden keys found at any depth in objects/arrays.
 * Re-exported from the shared lib walker (see src/lib/public-input/reports/forbidden-keys.ts).
 */
export const findForbiddenPublicKeys = findForbiddenPublicInputKeys;

/** @deprecated Prefer findForbiddenPublicKeys for nested coverage. */
export function assertNoForbiddenPublicKeys(dto: object): string[] {
  return findForbiddenPublicKeys(dto).map((path) => path.split(".").pop() ?? path);
}
