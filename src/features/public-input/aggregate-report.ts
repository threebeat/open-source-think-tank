import {
  SMALL_CELL_SUPPRESSION_THRESHOLD,
  type PublicInputAggregateReport,
  publicInputAggregateReports,
} from "@/fixtures/journey-catalog";

/** Fields that must never appear on a public Public Input DTO. */
export const PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS = [
  "providerParticipantId",
  "providerParticipantIds",
  "accountId",
  "accountIds",
  "voteRows",
  "perPersonVotes",
  "individualGroupMembership",
  "groupMembershipByPerson",
  "crossConversationLinkage",
  "contact",
  "identity",
  "verification",
  "rawProviderUrl",
  "accessToken",
  "xid",
] as const;

export type PublicInputPublicDto = {
  synthetic: true;
  topicSlug: string;
  participationCount: number;
  commentTotal: number;
  voteTotal: number;
  opinionGroups: { label: string; share: number }[];
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
};

/**
 * Apply small-cell suppression to group shares when implied cell size < threshold.
 * Demo provisional threshold is 5; production threshold requires privacy review.
 */
export function applySmallCellSuppression(
  report: PublicInputAggregateReport,
  threshold = SMALL_CELL_SUPPRESSION_THRESHOLD,
): { groups: { label: string; share: number | null }[]; suppressedCells: number } {
  let suppressedCells = 0;
  const groups = report.opinionGroups.map((group) => {
    const implied = Math.round(group.share * report.participationCount);
    if (implied > 0 && implied < threshold) {
      suppressedCells += 1;
      return { label: group.label, share: null };
    }
    return { label: group.label, share: group.share };
  });
  return { groups, suppressedCells };
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
    opinionGroups: groups.map((group) => ({
      label: group.label,
      share: group.share ?? 0,
    })),
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

export function assertNoForbiddenPublicKeys(dto: object): string[] {
  const keys = new Set(Object.keys(dto));
  return PUBLIC_INPUT_FORBIDDEN_PUBLIC_KEYS.filter((key) => keys.has(key));
}
