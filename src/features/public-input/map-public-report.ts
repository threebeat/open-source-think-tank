import type { PublicInputPublicDto } from "@/features/public-input/aggregate-report";
import { PUBLIC_INPUT_CELL_POLICY } from "@/features/public-input/aggregate-report";
import type { PublicReportDto } from "@/lib/public-input/reports/projection";

/**
 * Map a gated published `PublicReportDto` into the shared panel DTO without
 * re-running suppression (publish-time values are already stored) and without
 * importing any gated DB/auth clients into the public-demo bundle.
 */
export function mapPublicReportDtoToPanelDto(
  report: PublicReportDto,
  topicSlug: string,
): PublicInputPublicDto {
  const dto: PublicInputPublicDto = {
    synthetic: report.synthetic,
    topicSlug,
    participationCount: report.participationCount,
    commentTotal: report.commentTotal,
    voteTotal: report.voteTotal,
    opinionGroups: report.opinionGroups.map((group) => {
      if (group.status === "reported") {
        return {
          label: group.label,
          status: "reported" as const,
          share: group.share,
        };
      }
      return {
        label: group.label,
        status: "suppressed" as const,
        share: null,
      };
    }),
    crossGroupAgreement: [...report.crossGroupAgreement],
    meaningfulDisagreement: [...report.meaningfulDisagreement],
    participationSufficiency: report.participationSufficiency,
    representationLimitations: report.representationLimitations,
    methodVersion: report.methodVersion,
    importTimestamp: report.importTimestamp,
    // Publish-time snapshot from the stored report row — never a runtime
    // constant, so this always reflects what was actually applied (4.5A.1).
    smallCellSuppressionThreshold: report.smallCellThreshold,
    smallCellSuppressionNotice: report.smallCellSuppressionNotice,
    suppressedCells: report.suppressedCells,
    groupsOmitted: report.groupsOmitted,
    smallCellSuppressionPolicyVersion: report.smallCellSuppressionPolicyVersion,
    providerNotice: report.providerNotice,
    cellPolicy: {
      alwaysReportable: [...PUBLIC_INPUT_CELL_POLICY.alwaysReportable],
      suppressible: [...PUBLIC_INPUT_CELL_POLICY.suppressible],
      neverPublic: [...PUBLIC_INPUT_CELL_POLICY.neverPublic],
    },
    reportVersion: report.reportVersion,
    publicTitle: report.publicTitle,
    publishedAt: report.publishedAt,
    isSuperseded: report.isSuperseded,
  };
  if (report.moderationDisclosure) {
    dto.moderationDisclosure = report.moderationDisclosure;
  }
  return dto;
}
