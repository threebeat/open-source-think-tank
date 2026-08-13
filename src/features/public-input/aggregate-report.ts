import {
  SMALL_CELL_SUPPRESSION_THRESHOLD,
  type PublicInputAggregateReport,
  publicInputAggregateReports,
} from "@/fixtures/journey-catalog";

/**
 * Keys that must never appear anywhere in a public Public Input DTO
 * (including nested objects/arrays). Case-sensitive exact key match.
 */
export const PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS = [
  "providerParticipantId",
  "providerParticipantIds",
  "accountId",
  "accountIds",
  "voteRows",
  "perPersonVotes",
  "voteMatrix",
  "individualGroupMembership",
  "groupMembershipByPerson",
  "authorProviderLinkage",
  "crossConversationLinkage",
  "contact",
  "identity",
  "verification",
  "rawProviderUrl",
  "accessToken",
  "reportSecret",
  "embedSecret",
  "xid",
] as const;

export type OpinionGroupCell =
  | { label: string; status: "reported"; share: number }
  | { label: string; status: "suppressed"; share: null };

export type PublicInputPublicDto = {
  synthetic: true;
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
  ],
  neverPublic: [...PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS],
} as const;

/**
 * Apply small-cell suppression to group shares when implied cell size < threshold.
 * Demo provisional threshold is 5; production threshold requires privacy review.
 * Returns explicit status so a genuine zero and a suppressed cell are never the same value.
 */
export function applySmallCellSuppression(
  report: PublicInputAggregateReport,
  threshold = SMALL_CELL_SUPPRESSION_THRESHOLD,
): { groups: OpinionGroupCell[]; suppressedCells: number } {
  let suppressedCells = 0;
  const groups: OpinionGroupCell[] = report.opinionGroups.map((group) => {
    const implied = Math.round(group.share * report.participationCount);
    if (implied > 0 && implied < threshold) {
      suppressedCells += 1;
      return { label: group.label, status: "suppressed", share: null };
    }
    return { label: group.label, status: "reported", share: group.share };
  });
  return { groups, suppressedCells };
}

export function formatOpinionGroupShare(cell: OpinionGroupCell): string {
  if (cell.status === "suppressed") {
    return "Suppressed";
  }
  return `${(cell.share * 100).toFixed(0)}%`;
}

export function toPublicInputPublicDto(
  report: PublicInputAggregateReport,
): PublicInputPublicDto {
  const { groups, suppressedCells } = applySmallCellSuppression(report);
  return {
    synthetic: true,
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
    providerNotice:
      "Synthetic Public Input report only. Not connected to Pol.is. Pol.is is an input, not a decision-maker.",
    cellPolicy: {
      alwaysReportable: [...PUBLIC_INPUT_CELL_POLICY.alwaysReportable],
      suppressible: [...PUBLIC_INPUT_CELL_POLICY.suppressible],
      neverPublic: [...PUBLIC_INPUT_CELL_POLICY.neverPublic],
    },
  };
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
 */
export function findForbiddenPublicKeys(
  value: unknown,
  path: string[] = [],
): string[] {
  const hits: string[] = [];
  if (value == null) {
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findForbiddenPublicKeys(item, [...path, String(index)]));
    });
    return hits;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (
        (PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS as readonly string[]).includes(key)
      ) {
        hits.push([...path, key].join("."));
      }
      hits.push(...findForbiddenPublicKeys(nested, [...path, key]));
    }
  }
  return hits;
}

/** @deprecated Prefer findForbiddenPublicKeys for nested coverage. */
export function assertNoForbiddenPublicKeys(dto: object): string[] {
  return findForbiddenPublicKeys(dto).map((path) => path.split(".").pop() ?? path);
}
