import { and, desc, eq, max } from "drizzle-orm";

import {
  publicInputReportFindings,
  publicInputReportGroups,
  publicInputReportImports,
  publicInputReportModerationActions,
  publicInputReports,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type PublicInputReportSourceKind = "fixture" | "manual_aggregate";

export type PublicInputReportWorkflowState =
  | "imported"
  | "validated"
  | "under_review"
  | "published"
  | "rejected"
  | "superseded";

export type PublicInputFindingKind =
  | "cross_group_agreement"
  | "meaningful_disagreement";

export type PublicInputFindingPublicationStatus =
  | "included"
  | "withheld"
  | "superseded";

export type PublicInputReportGroupCellStatus =
  | "reported"
  | "suppressed"
  | "omitted";

export type PublicInputReportModerationActionKind =
  | "include"
  | "withhold"
  | "supersede_finding";

export type ReportImportRecord = {
  id: string;
  conversationId: string;
  sourceKind: PublicInputReportSourceKind;
  schemaVersion: string;
  methodVersion: string;
  providerExportVersionLabel: string | null;
  canonicalHash: string;
  generatedAt: Date | null;
  importedAt: Date;
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

export type ReportRecord = {
  id: string;
  conversationId: string;
  importId: string;
  topicId: string;
  version: number;
  concurrencyVersion: number;
  workflowState: PublicInputReportWorkflowState;
  publicTitle: string;
  publishedAt: Date | null;
  publisherAccountId: string | null;
  importerAccountId: string | null;
  supersededByReportId: string | null;
  isLatestPublished: boolean;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportGroupRecord = {
  id: string;
  reportId: string;
  label: string;
  displayOrder: number;
  participantCount: number;
  rawShare: number;
  publishedStatus: PublicInputReportGroupCellStatus;
  publishedShare: number | null;
  synthetic: boolean;
};

export type ReportFindingRecord = {
  id: string;
  reportId: string;
  kind: PublicInputFindingKind;
  statementText: string;
  publicationStatus: PublicInputFindingPublicationStatus;
  displayOrder: number;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportModerationActionRecord = {
  id: string;
  reportId: string;
  findingId: string | null;
  action: PublicInputReportModerationActionKind;
  publicRationale: string | null;
  privateNote: string | null;
  actorAccountId: string;
  synthetic: boolean;
  createdAt: Date;
};

function mapImport(
  row: typeof publicInputReportImports.$inferSelect,
): ReportImportRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    sourceKind: row.sourceKind as PublicInputReportSourceKind,
    schemaVersion: row.schemaVersion,
    methodVersion: row.methodVersion,
    providerExportVersionLabel: row.providerExportVersionLabel,
    canonicalHash: row.canonicalHash,
    generatedAt: row.generatedAt,
    importedAt: row.importedAt,
    importedByAccountId: row.importedByAccountId,
    participationCount: row.participationCount,
    commentCount: row.commentCount,
    voteCount: row.voteCount,
    participationSufficiency: row.participationSufficiency,
    representationLimitations: row.representationLimitations,
    moderationReviewedCount: row.moderationReviewedCount,
    moderationAcceptedCount: row.moderationAcceptedCount,
    moderationRejectedCount: row.moderationRejectedCount,
    moderationPolicyVersion: row.moderationPolicyVersion,
    synthetic: row.synthetic,
  };
}

function mapReport(row: typeof publicInputReports.$inferSelect): ReportRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    importId: row.importId,
    topicId: row.topicId,
    version: row.version,
    concurrencyVersion: row.concurrencyVersion,
    workflowState: row.workflowState,
    publicTitle: row.publicTitle,
    publishedAt: row.publishedAt,
    publisherAccountId: row.publisherAccountId,
    importerAccountId: row.importerAccountId,
    supersededByReportId: row.supersededByReportId,
    isLatestPublished: row.isLatestPublished,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGroup(
  row: typeof publicInputReportGroups.$inferSelect,
): ReportGroupRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    label: row.label,
    displayOrder: row.displayOrder,
    participantCount: row.participantCount,
    rawShare: row.rawShare,
    publishedStatus: row.publishedStatus,
    publishedShare: row.publishedShare,
    synthetic: row.synthetic,
  };
}

function mapFinding(
  row: typeof publicInputReportFindings.$inferSelect,
): ReportFindingRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    kind: row.kind,
    statementText: row.statementText,
    publicationStatus: row.publicationStatus,
    displayOrder: row.displayOrder,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapModerationAction(
  row: typeof publicInputReportModerationActions.$inferSelect,
): ReportModerationActionRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    findingId: row.findingId,
    action: row.action,
    publicRationale: row.publicRationale,
    privateNote: row.privateNote,
    actorAccountId: row.actorAccountId,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
  };
}

export async function findReportImportByCanonicalHash(
  db: GatedDb,
  input: { conversationId: string; canonicalHash: string },
): Promise<AdapterResult<ReportImportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .select()
    .from(publicInputReportImports)
    .where(
      and(
        eq(publicInputReportImports.conversationId, input.conversationId),
        eq(publicInputReportImports.canonicalHash, input.canonicalHash),
      ),
    )
    .limit(1);
  return { ok: true, value: row ? mapImport(row) : null };
}

export async function insertReportImport(
  db: GatedDb,
  input: {
    conversationId: string;
    sourceKind: PublicInputReportSourceKind;
    schemaVersion: string;
    methodVersion: string;
    providerExportVersionLabel: string | null;
    canonicalHash: string;
    generatedAt: Date | null;
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
  },
): Promise<AdapterResult<ReportImportRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const id = newEntityId("pinrimp");
  const [row] = await db
    .insert(publicInputReportImports)
    .values({
      id,
      conversationId: input.conversationId,
      sourceKind: input.sourceKind,
      schemaVersion: input.schemaVersion,
      methodVersion: input.methodVersion,
      providerExportVersionLabel: input.providerExportVersionLabel,
      canonicalHash: input.canonicalHash,
      generatedAt: input.generatedAt,
      importedByAccountId: input.importedByAccountId,
      participationCount: input.participationCount,
      commentCount: input.commentCount,
      voteCount: input.voteCount,
      participationSufficiency: input.participationSufficiency,
      representationLimitations: input.representationLimitations,
      moderationReviewedCount: input.moderationReviewedCount,
      moderationAcceptedCount: input.moderationAcceptedCount,
      moderationRejectedCount: input.moderationRejectedCount,
      moderationPolicyVersion: input.moderationPolicyVersion,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert Public Input report import",
      code: "PUBLIC_INPUT_REPORT_IMPORT_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapImport(row) };
}

export async function getNextReportVersion(
  db: GatedDb,
  conversationId: string,
): Promise<AdapterResult<number>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .select({ maxVersion: max(publicInputReports.version) })
    .from(publicInputReports)
    .where(eq(publicInputReports.conversationId, conversationId));
  const current = row?.maxVersion ?? 0;
  return { ok: true, value: current + 1 };
}

export async function insertReport(
  db: GatedDb,
  input: {
    conversationId: string;
    importId: string;
    topicId: string;
    version: number;
    publicTitle: string;
    importerAccountId: string;
    synthetic: boolean;
  },
): Promise<AdapterResult<ReportRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const id = newEntityId("pinrpt");
  const [row] = await db
    .insert(publicInputReports)
    .values({
      id,
      conversationId: input.conversationId,
      importId: input.importId,
      topicId: input.topicId,
      version: input.version,
      concurrencyVersion: 1,
      workflowState: "imported",
      publicTitle: input.publicTitle,
      publishedAt: null,
      publisherAccountId: null,
      importerAccountId: input.importerAccountId,
      supersededByReportId: null,
      isLatestPublished: false,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert Public Input report",
      code: "PUBLIC_INPUT_REPORT_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapReport(row) };
}

export async function insertReportGroups(
  db: GatedDb,
  input: {
    reportId: string;
    participationCount: number;
    synthetic: boolean;
    groups: {
      label: string;
      participantCount: number;
      displayOrder: number;
    }[];
  },
): Promise<AdapterResult<ReportGroupRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  if (input.groups.length === 0) {
    return { ok: true, value: [] };
  }

  const rows = await db
    .insert(publicInputReportGroups)
    .values(
      input.groups.map((group) => {
        const rawShare =
          input.participationCount > 0
            ? group.participantCount / input.participationCount
            : 0;
        return {
          id: newEntityId("pinrgrp"),
          reportId: input.reportId,
          label: group.label,
          displayOrder: group.displayOrder,
          participantCount: group.participantCount,
          rawShare,
          publishedStatus: "reported" as const,
          publishedShare: rawShare,
          synthetic: input.synthetic,
        };
      }),
    )
    .returning();

  return { ok: true, value: rows.map(mapGroup) };
}

export async function insertReportFindings(
  db: GatedDb,
  input: {
    reportId: string;
    synthetic: boolean;
    findings: {
      kind: PublicInputFindingKind;
      statementText: string;
      displayOrder: number;
    }[];
  },
): Promise<AdapterResult<ReportFindingRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  if (input.findings.length === 0) {
    return { ok: true, value: [] };
  }

  const rows = await db
    .insert(publicInputReportFindings)
    .values(
      input.findings.map((finding) => ({
        id: newEntityId("pinrfind"),
        reportId: input.reportId,
        kind: finding.kind,
        statementText: finding.statementText,
        publicationStatus: "included" as const,
        displayOrder: finding.displayOrder,
        synthetic: input.synthetic,
      })),
    )
    .returning();

  return { ok: true, value: rows.map(mapFinding) };
}

export async function getReportByImportId(
  db: GatedDb,
  importId: string,
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputReports)
    .where(eq(publicInputReports.importId, importId))
    .limit(1);
  return { ok: true, value: row ? mapReport(row) : null };
}

/**
 * Public topic projection must resolve through the topic's **current**
 * consultation only (4.5A). Historical conversations may each retain a
 * latest-published flag, but only the current designation is eligible for
 * the live topic route. Historical reports belong in Records later.
 */
export async function getLatestPublishedReportForTopic(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const { getCurrentConversationByTopicId } = await import(
    "@/lib/public-input/lifecycle/repository"
  );
  const current = await getCurrentConversationByTopicId(db, topicId);
  if (!current.ok) return current;
  if (!current.value) {
    return { ok: true, value: null };
  }

  return getLatestPublishedReportForConversation(db, current.value.id);
}

export async function getReportById(
  db: GatedDb,
  reportId: string,
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputReports)
    .where(eq(publicInputReports.id, reportId))
    .limit(1);
  return { ok: true, value: row ? mapReport(row) : null };
}

export async function getReportImportById(
  db: GatedDb,
  importId: string,
): Promise<AdapterResult<ReportImportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputReportImports)
    .where(eq(publicInputReportImports.id, importId))
    .limit(1);
  return { ok: true, value: row ? mapImport(row) : null };
}

export async function getReportGroupsByReportId(
  db: GatedDb,
  reportId: string,
): Promise<AdapterResult<ReportGroupRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const rows = await db
    .select()
    .from(publicInputReportGroups)
    .where(eq(publicInputReportGroups.reportId, reportId))
    .orderBy(publicInputReportGroups.displayOrder);
  return { ok: true, value: rows.map(mapGroup) };
}

export async function getReportFindingsByReportId(
  db: GatedDb,
  reportId: string,
): Promise<AdapterResult<ReportFindingRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const rows = await db
    .select()
    .from(publicInputReportFindings)
    .where(eq(publicInputReportFindings.reportId, reportId))
    .orderBy(publicInputReportFindings.kind, publicInputReportFindings.displayOrder);
  return { ok: true, value: rows.map(mapFinding) };
}

export async function getFindingById(
  db: GatedDb,
  findingId: string,
): Promise<AdapterResult<ReportFindingRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputReportFindings)
    .where(eq(publicInputReportFindings.id, findingId))
    .limit(1);
  return { ok: true, value: row ? mapFinding(row) : null };
}

export async function listReportsForConversation(
  db: GatedDb,
  conversationId: string,
): Promise<AdapterResult<ReportRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const rows = await db
    .select()
    .from(publicInputReports)
    .where(eq(publicInputReports.conversationId, conversationId))
    .orderBy(desc(publicInputReports.version));
  return { ok: true, value: rows.map(mapReport) };
}

export async function getLatestPublishedReportForConversation(
  db: GatedDb,
  conversationId: string,
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputReports)
    .where(
      and(
        eq(publicInputReports.conversationId, conversationId),
        eq(publicInputReports.isLatestPublished, true),
      ),
    )
    .limit(1);
  return { ok: true, value: row ? mapReport(row) : null };
}

/** Expected-concurrency-version workflow transition (no group/finding writes here). */
export async function updateReportWorkflowState(
  db: GatedDb,
  input: {
    reportId: string;
    expectedConcurrencyVersion: number;
    nextWorkflowState: PublicInputReportWorkflowState;
  },
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputReports)
    .set({
      workflowState: input.nextWorkflowState,
      concurrencyVersion: input.expectedConcurrencyVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputReports.id, input.reportId),
        eq(
          publicInputReports.concurrencyVersion,
          input.expectedConcurrencyVersion,
        ),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapReport(row) : null };
}

/** Publish transition: sets published metadata + isLatestPublished together. */
export async function publishReportWorkflow(
  db: GatedDb,
  input: {
    reportId: string;
    expectedConcurrencyVersion: number;
    publisherAccountId: string;
    publishedAt: Date;
  },
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputReports)
    .set({
      workflowState: "published",
      isLatestPublished: true,
      publishedAt: input.publishedAt,
      publisherAccountId: input.publisherAccountId,
      concurrencyVersion: input.expectedConcurrencyVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputReports.id, input.reportId),
        eq(
          publicInputReports.concurrencyVersion,
          input.expectedConcurrencyVersion,
        ),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapReport(row) : null };
}

/** Supersede transition on the *previously* published report only. */
export async function supersedeReport(
  db: GatedDb,
  input: {
    reportId: string;
    expectedConcurrencyVersion: number;
    supersededByReportId: string;
  },
): Promise<AdapterResult<ReportRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputReports)
    .set({
      workflowState: "superseded",
      isLatestPublished: false,
      supersededByReportId: input.supersededByReportId,
      concurrencyVersion: input.expectedConcurrencyVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputReports.id, input.reportId),
        eq(
          publicInputReports.concurrencyVersion,
          input.expectedConcurrencyVersion,
        ),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapReport(row) : null };
}

/** Persist the publish-time complementary suppression decision onto each group row. */
export async function updateReportGroupPublication(
  db: GatedDb,
  input: {
    groupId: string;
    publishedStatus: PublicInputReportGroupCellStatus;
    publishedShare: number | null;
  },
): Promise<AdapterResult<ReportGroupRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputReportGroups)
    .set({
      publishedStatus: input.publishedStatus,
      publishedShare: input.publishedShare,
    })
    .where(eq(publicInputReportGroups.id, input.groupId))
    .returning();

  return { ok: true, value: row ? mapGroup(row) : null };
}

export async function insertReportModerationAction(
  db: GatedDb,
  input: {
    reportId: string;
    findingId: string;
    action: PublicInputReportModerationActionKind;
    publicRationale: string | null;
    privateNote: string | null;
    actorAccountId: string;
    synthetic: boolean;
  },
): Promise<AdapterResult<ReportModerationActionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const id = newEntityId("pinrmod");
  const [row] = await db
    .insert(publicInputReportModerationActions)
    .values({
      id,
      reportId: input.reportId,
      findingId: input.findingId,
      action: input.action,
      publicRationale: input.publicRationale,
      privateNote: input.privateNote,
      actorAccountId: input.actorAccountId,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to record Public Input report moderation action",
      code: "PUBLIC_INPUT_REPORT_MODERATION_ACTION_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapModerationAction(row) };
}

export async function updateFindingPublicationStatus(
  db: GatedDb,
  input: {
    findingId: string;
    reportId: string;
    expectedConcurrencyVersion: number;
    nextPublicationStatus: PublicInputFindingPublicationStatus;
  },
): Promise<AdapterResult<ReportFindingRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  // Lock the parent report row: must be under_review and match concurrency.
  const [locked] = await db
    .update(publicInputReports)
    .set({
      concurrencyVersion: input.expectedConcurrencyVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputReports.id, input.reportId),
        eq(publicInputReports.workflowState, "under_review"),
        eq(
          publicInputReports.concurrencyVersion,
          input.expectedConcurrencyVersion,
        ),
      ),
    )
    .returning();

  if (!locked) {
    return {
      ok: false,
      error: "Report changed or is not under_review; reload and retry",
      code: "PUBLIC_INPUT_REPORT_STATE_CONFLICT",
    };
  }

  const [row] = await db
    .update(publicInputReportFindings)
    .set({
      publicationStatus: input.nextPublicationStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputReportFindings.id, input.findingId),
        eq(publicInputReportFindings.reportId, input.reportId),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapFinding(row) : null };
}

/**
 * Serialize imports for a conversation (SELECT FOR UPDATE on the conversation
 * row). Call inside a transaction before hash/idempotency checks and inserts.
 */
export async function lockConversationRowForImport(
  db: GatedDb,
  conversationId: string,
): Promise<AdapterResult<{ id: string } | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const { publicInputConversations } = await import("@/db/schema");
  const [row] = await db
    .select({ id: publicInputConversations.id })
    .from(publicInputConversations)
    .where(eq(publicInputConversations.id, conversationId))
    .for("update")
    .limit(1);

  return { ok: true, value: row ?? null };
}

export async function listModerationActionsForReport(
  db: GatedDb,
  reportId: string,
): Promise<AdapterResult<ReportModerationActionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const rows = await db
    .select()
    .from(publicInputReportModerationActions)
    .where(eq(publicInputReportModerationActions.reportId, reportId))
    .orderBy(desc(publicInputReportModerationActions.createdAt));
  return { ok: true, value: rows.map(mapModerationAction) };
}
