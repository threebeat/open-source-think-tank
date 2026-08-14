import type {
  ReportFindingRecord,
  ReportGroupRecord,
  ReportImportRecord,
  ReportRecord,
} from "@/lib/public-input/reports/repository";
import { SMALL_CELL_POLICY_VERSION } from "@/lib/public-input/reports/suppression";

export type PublicOpinionGroupCell =
  | { label: string; status: "reported"; share: number }
  | { label: string; status: "suppressed" | "omitted"; share: null };

/**
 * Allowlisted public projection of a published report (ADR 0019, ADR 0021).
 * Sourced only from stored `publishedStatus` / `publishedShare` — this
 * function never re-derives suppression; that happens once, at publish time
 * (src/lib/public-input/reports/service.ts), and is stored on the group rows
 * so republication of the same version can never quietly change what was
 * already shown. NEVER add `conversationId`, `importId`, raw import ids,
 * `providerConversationRef`, or any account id here.
 */
export type PublicReportModerationDisclosure = {
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  policyVersion: string | null;
};

export type PublicReportDto = {
  synthetic: boolean;
  topicId: string;
  reportVersion: number;
  publicTitle: string;
  publishedAt: string;
  participationCount: number;
  commentTotal: number;
  voteTotal: number;
  opinionGroups: PublicOpinionGroupCell[];
  crossGroupAgreement: string[];
  meaningfulDisagreement: string[];
  participationSufficiency: string;
  representationLimitations: string;
  methodVersion: string;
  importTimestamp: string;
  smallCellSuppressionPolicyVersion: string;
  smallCellSuppressionNotice: string;
  suppressedCells: number;
  groupsOmitted: boolean;
  moderationDisclosure: PublicReportModerationDisclosure;
  providerNotice: string;
  /** True when this published version has been superseded (history view only). */
  isSuperseded: boolean;
};

function toPublicGroupCell(group: ReportGroupRecord): PublicOpinionGroupCell {
  if (group.publishedStatus === "reported") {
    return {
      label: group.label,
      status: "reported",
      share: group.publishedShare ?? 0,
    };
  }
  return { label: group.label, status: group.publishedStatus, share: null };
}

function findingsOfKind(
  findings: readonly ReportFindingRecord[],
  kind: ReportFindingRecord["kind"],
): string[] {
  return findings
    .filter((f) => f.kind === kind && f.publicationStatus === "included")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((f) => f.statementText);
}

export function toPublicReportDto(input: {
  report: ReportRecord;
  reportImport: ReportImportRecord;
  groups: readonly ReportGroupRecord[];
  findings: readonly ReportFindingRecord[];
}): PublicReportDto | null {
  const { report, reportImport, groups, findings } = input;
  if (report.workflowState !== "published" || !report.publishedAt) {
    return null;
  }

  const orderedGroups = [...groups].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const suppressedCells = orderedGroups.filter(
    (g) => g.publishedStatus === "suppressed",
  ).length;
  const groupsOmitted = orderedGroups.some(
    (g) => g.publishedStatus === "omitted",
  );

  return {
    synthetic: report.synthetic,
    topicId: report.topicId,
    reportVersion: report.version,
    publicTitle: report.publicTitle,
    publishedAt: report.publishedAt.toISOString(),
    participationCount: reportImport.participationCount,
    commentTotal: reportImport.commentCount,
    voteTotal: reportImport.voteCount,
    opinionGroups: groupsOmitted ? [] : orderedGroups.map(toPublicGroupCell),
    crossGroupAgreement: findingsOfKind(findings, "cross_group_agreement"),
    meaningfulDisagreement: findingsOfKind(findings, "meaningful_disagreement"),
    participationSufficiency: reportImport.participationSufficiency,
    representationLimitations: reportImport.representationLimitations,
    methodVersion: reportImport.methodVersion,
    importTimestamp: (reportImport.generatedAt ?? reportImport.importedAt).toISOString(),
    smallCellSuppressionPolicyVersion: SMALL_CELL_POLICY_VERSION,
    smallCellSuppressionNotice:
      "Complementary small-cell suppression applied at publication. Suppressed shares are not zeros and cannot be reconstructed by subtraction. Production threshold remains subject to privacy review (OQ27/OQ35).",
    suppressedCells,
    groupsOmitted,
    moderationDisclosure: {
      reviewedCount: reportImport.moderationReviewedCount,
      acceptedCount: reportImport.moderationAcceptedCount,
      rejectedCount: reportImport.moderationRejectedCount,
      policyVersion: reportImport.moderationPolicyVersion,
    },
    providerNotice:
      "Aggregate-only Public Input report. Not connected to a live Pol.is conversation. Pol.is / Public Input organizes preference and is not evidence, truth, representativeness, or an institutional decision.",
    isSuperseded: false,
  };
}

/**
 * Staff-facing detail. Still never exposes `providerConversationRef` (not a
 * column on these tables) and never exposes raw participant-level data
 * (never stored here at all — see ADR 0018).
 */
export type StaffReportDetailDto = {
  reportId: string;
  conversationId: string;
  topicId: string;
  importId: string;
  version: number;
  concurrencyVersion: number;
  workflowState: ReportRecord["workflowState"];
  publicTitle: string;
  isLatestPublished: boolean;
  publishedAt: string | null;
  publisherAccountId: string | null;
  importerAccountId: string | null;
  supersededByReportId: string | null;
  synthetic: boolean;
  createdAt: string;
  updatedAt: string;
  import: {
    importId: string;
    sourceKind: ReportImportRecord["sourceKind"];
    schemaVersion: string;
    methodVersion: string;
    providerExportVersionLabel: string | null;
    canonicalHash: string;
    generatedAt: string | null;
    importedAt: string;
    importedByAccountId: string;
    participationCount: number;
    commentCount: number;
    voteCount: number;
    participationSufficiency: string;
    representationLimitations: string;
    moderationReviewedCount: number;
    moderationAcceptedCount: number;
    moderationRejectedCount: number;
    moderationPolicyVersion: string | null;
    synthetic: boolean;
  };
  groups: {
    id: string;
    label: string;
    displayOrder: number;
    rawShare: number;
    publishedStatus: ReportGroupRecord["publishedStatus"];
    publishedShare: number | null;
    synthetic: boolean;
  }[];
  findings: {
    id: string;
    kind: ReportFindingRecord["kind"];
    statementText: string;
    publicationStatus: ReportFindingRecord["publicationStatus"];
    displayOrder: number;
    synthetic: boolean;
  }[];
};

export function toStaffReportDetailDto(input: {
  report: ReportRecord;
  reportImport: ReportImportRecord;
  groups: readonly ReportGroupRecord[];
  findings: readonly ReportFindingRecord[];
}): StaffReportDetailDto {
  const { report, reportImport, groups, findings } = input;
  return {
    reportId: report.id,
    conversationId: report.conversationId,
    topicId: report.topicId,
    importId: report.importId,
    version: report.version,
    concurrencyVersion: report.concurrencyVersion,
    workflowState: report.workflowState,
    publicTitle: report.publicTitle,
    isLatestPublished: report.isLatestPublished,
    publishedAt: report.publishedAt ? report.publishedAt.toISOString() : null,
    publisherAccountId: report.publisherAccountId,
    importerAccountId: report.importerAccountId,
    supersededByReportId: report.supersededByReportId,
    synthetic: report.synthetic,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    import: {
      importId: reportImport.id,
      sourceKind: reportImport.sourceKind,
      schemaVersion: reportImport.schemaVersion,
      methodVersion: reportImport.methodVersion,
      providerExportVersionLabel: reportImport.providerExportVersionLabel,
      canonicalHash: reportImport.canonicalHash,
      generatedAt: reportImport.generatedAt
        ? reportImport.generatedAt.toISOString()
        : null,
      importedAt: reportImport.importedAt.toISOString(),
      importedByAccountId: reportImport.importedByAccountId,
      participationCount: reportImport.participationCount,
      commentCount: reportImport.commentCount,
      voteCount: reportImport.voteCount,
      participationSufficiency: reportImport.participationSufficiency,
      representationLimitations: reportImport.representationLimitations,
      moderationReviewedCount: reportImport.moderationReviewedCount,
      moderationAcceptedCount: reportImport.moderationAcceptedCount,
      moderationRejectedCount: reportImport.moderationRejectedCount,
      moderationPolicyVersion: reportImport.moderationPolicyVersion,
      synthetic: reportImport.synthetic,
    },
    groups: [...groups]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((g) => ({
        id: g.id,
        label: g.label,
        displayOrder: g.displayOrder,
        rawShare: g.rawShare,
        publishedStatus: g.publishedStatus,
        publishedShare: g.publishedShare,
        synthetic: g.synthetic,
      })),
    findings: [...findings]
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.displayOrder - b.displayOrder)
      .map((f) => ({
        id: f.id,
        kind: f.kind,
        statementText: f.statementText,
        publicationStatus: f.publicationStatus,
        displayOrder: f.displayOrder,
        synthetic: f.synthetic,
      })),
  };
}

/** Defense-in-depth: fails a test/build if a public DTO ever grows a protected field. */
export function assertNoProtectedReportFieldLeak(value: object): void {
  const forbidden = [
    "conversationId",
    "importId",
    "providerConversationRef",
    "publisherAccountId",
    "importerAccountId",
    "canonicalHash",
    "rawShare",
  ];
  for (const key of forbidden) {
    if (key in value) {
      throw new Error(
        `PUBLIC_INPUT_REPORT_DTO_LEAK: ${key} must never appear on a public report DTO`,
      );
    }
  }
}
