import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import { getConversationById } from "@/lib/public-input/lifecycle/repository";
import {
  canonicalHashOf,
} from "@/lib/public-input/reports/hash";
import {
  validateCanonicalAggregateImport,
  type CanonicalAggregateImport,
  type CanonicalImportSourceKind,
} from "@/lib/public-input/reports/canonical-schema";
import {
  findReportImportByCanonicalHash,
  getLatestPublishedReportForConversation,
  getLatestPublishedReportForTopic,
  getNextReportVersion,
  getReportById,
  getReportByImportId,
  getReportFindingsByReportId,
  getReportGroupsByReportId,
  getReportImportById,
  insertReport,
  insertReportFindings,
  insertReportGroups,
  insertReportImport,
  listReportsForConversation,
  lockConversationRowForImport,
  publishReportWorkflow,
  supersedeReport,
  updateReportGroupPublication,
  updateReportWorkflowState,
  type PublicInputReportDataProvenance,
  type ReportRecord,
} from "@/lib/public-input/reports/repository";
import {
  toPublicReportDto,
  toStaffReportDetailDto,
  type PublicReportDto,
  type StaffReportDetailDto,
} from "@/lib/public-input/reports/projection";
import {
  applyComplementarySmallCellSuppression,
  PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD,
  SMALL_CELL_ALGORITHM_VERSION,
  SMALL_CELL_POLICY_VERSION,
} from "@/lib/public-input/reports/suppression";

const MIN_REJECT_REASON_LENGTH = 8;

/** Conversation workflow states from which an aggregate-only import may be accepted (ADR 0018 §5). */
const IMPORT_ELIGIBLE_CONVERSATION_STATES = ["voting_closed", "closed"] as const;

/**
 * Content data provenance is derived exclusively from the validated
 * canonical payload's `sourceKind` — never independently overridable
 * (4.5A.1). The canonical schema is `.strict()`, so any payload attempting
 * to smuggle its own `dataProvenance` key already fails schema validation
 * before reaching this function; this switch is an exhaustive defense
 * against a future non-operational `sourceKind` ever being derived silently.
 */
function deriveDataProvenance(
  sourceKind: CanonicalImportSourceKind,
): PublicInputReportDataProvenance {
  switch (sourceKind) {
    case "fixture":
      return "synthetic_fixture";
    case "manual_aggregate":
      return "manual_aggregate";
    default: {
      const exhaustive: never = sourceKind;
      throw new Error(`IMPORT_SOURCE_KIND_PROVENANCE_CONTRADICTION:${String(exhaustive)}`);
    }
  }
}

/**
 * Fail-closed operator escape hatch (4.5A.1). Production small-cell
 * suppression parameters have not cleared privacy review (OQ27/OQ35), so
 * every non-synthetic (`manual_aggregate`) report publish — and any custom
 * suppression override on one — is refused unless this is explicitly set.
 */
function allowsNonSyntheticReportPublish(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.OSTT_ALLOW_NON_SYNTHETIC_REPORT_PUBLISH === "1";
}

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Public Input report ingestion/moderation unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_REPORTS",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }>,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function isSubstantiveReason(reason: string | undefined): boolean {
  return Boolean(reason && reason.trim().length >= MIN_REJECT_REASON_LENGTH);
}

export type ImportAggregateReportInput = {
  actorAccountId: string;
  conversationId: string;
  /**
   * @deprecated Ignored — publicTitle comes only from the validated canonical
   * payload so the hash covers every immutable public field (4.5A).
   */
  publicTitle?: string;
  /** Unknown/untrusted payload — validated against the canonical schema before anything is persisted. */
  payload: unknown;
};

export type ImportAggregateReportResult = {
  importId: string;
  reportId: string;
  reportVersion: number;
  isIdempotentReplay: boolean;
};

/**
 * Validate and persist an aggregate-only import (ADR 0018). Accepts only
 * `fixture` / `manual_aggregate` source kinds — the canonical schema and the
 * DB CHECK constraint both fail closed on anything else. Never auto-publishes.
 */
export async function importAggregateReport(
  db: GatedDb,
  input: ImportAggregateReportInput,
): Promise<AdapterResult<ImportAggregateReportResult>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const validated = validateCanonicalAggregateImport(input.payload);
  if (!validated.ok) {
    return {
      ok: false,
      error: `${validated.error}${validated.issues.length ? `: ${validated.issues.slice(0, 5).join("; ")}` : ""}`,
      code: validated.code,
    };
  }

  // Title is taken exclusively from the hashed canonical payload (4.5A).
  const publicTitle = validated.value.publicTitle.trim();

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.reports.import",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const locked = await lockConversationRowForImport(
        tx,
        input.conversationId,
      );
      if (!locked.ok) throw new Error(locked.code);
      if (!locked.value) throw new Error("CONSULTATION_NOT_FOUND");

      const conversation = await getConversationById(tx, input.conversationId);
      if (!conversation.ok) {
        throw new Error(conversation.code);
      }
      if (!conversation.value) {
        throw new Error("CONSULTATION_NOT_FOUND");
      }
      if (
        !(IMPORT_ELIGIBLE_CONVERSATION_STATES as readonly string[]).includes(
          conversation.value.workflowState,
        )
      ) {
        throw new Error("CONSULTATION_NOT_READY_FOR_IMPORT");
      }

      const canonicalHash = canonicalHashOf(validated.value);

      const existingImport = await findReportImportByCanonicalHash(tx, {
        conversationId: input.conversationId,
        canonicalHash,
      });
      if (!existingImport.ok) {
        throw new Error(existingImport.code);
      }
      if (existingImport.value) {
        const existingReport = await getReportByImportId(
          tx,
          existingImport.value.id,
        );
        if (!existingReport.ok) {
          throw new Error(existingReport.code);
        }
        if (!existingReport.value) {
          throw new Error("PUBLIC_INPUT_REPORT_IMPORT_ORPHANED");
        }

        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.reports.imported",
          subjectType: "public_input_report_import",
          subjectId: existingImport.value.id,
          summary:
            "Public Input aggregate report import replayed idempotently (identical canonical hash).",
          privatePayload: {
            conversationId: input.conversationId,
            topicId: conversation.value.topicId,
            importId: existingImport.value.id,
            reportId: existingReport.value.id,
            capability: "consultations.reports.import",
            sourceKind: existingImport.value.sourceKind,
            schemaVersion: existingImport.value.schemaVersion,
            canonicalHash,
            reportVersion: existingReport.value.version,
            isIdempotentReplay: true,
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });

        return {
          ok: true as const,
          value: {
            importId: existingImport.value.id,
            reportId: existingReport.value.id,
            reportVersion: existingReport.value.version,
            isIdempotentReplay: true,
          },
        };
      }

      const nextVersion = await getNextReportVersion(tx, input.conversationId);
      if (!nextVersion.ok) {
        throw new Error(nextVersion.code);
      }

      const payload: CanonicalAggregateImport = validated.value;
      const disclosure = payload.aggregateModerationDisclosure ?? null;
      // Content-row provenance/synthetic is derived from the validated
      // payload's sourceKind only — never from the importing actor's own
      // synthetic flag, which is reserved for audit events (4.5A.1).
      const dataProvenance = deriveDataProvenance(payload.sourceKind);

      const insertedImport = await insertReportImport(tx, {
        conversationId: input.conversationId,
        sourceKind: payload.sourceKind,
        schemaVersion: payload.schemaVersion,
        methodVersion: payload.methodVersion,
        providerExportVersionLabel: payload.providerExportVersionLabel ?? null,
        canonicalHash,
        generatedAt: payload.generatedAt ? new Date(payload.generatedAt) : null,
        importedByAccountId: decision.principal.accountId,
        participationCount: payload.participationCount,
        commentCount: payload.commentCount,
        voteCount: payload.voteCount,
        participationSufficiency: payload.participationSufficiency,
        representationLimitations: payload.representationLimitations,
        moderationReviewedCount: disclosure?.reviewedCount ?? 0,
        moderationAcceptedCount: disclosure?.acceptedCount ?? 0,
        moderationRejectedCount: disclosure?.rejectedCount ?? 0,
        moderationPolicyVersion: disclosure?.policyVersion ?? null,
        dataProvenance,
      });
      if (!insertedImport.ok) {
        throw new Error(insertedImport.code);
      }

      const insertedReport = await insertReport(tx, {
        conversationId: input.conversationId,
        importId: insertedImport.value.id,
        topicId: conversation.value.topicId,
        version: nextVersion.value,
        publicTitle,
        importerAccountId: decision.principal.accountId,
        dataProvenance,
      });
      if (!insertedReport.ok) {
        throw new Error(insertedReport.code);
      }

      const groupsInserted = await insertReportGroups(tx, {
        reportId: insertedReport.value.id,
        participationCount: payload.participationCount,
        dataProvenance,
        groups: payload.opinionGroups.map((group, index) => ({
          label: group.label,
          participantCount: group.participantCount,
          displayOrder: index,
        })),
      });
      if (!groupsInserted.ok) {
        throw new Error(groupsInserted.code);
      }

      const findingsInput = [
        ...payload.crossGroupAgreement.map((statementText, index) => ({
          kind: "cross_group_agreement" as const,
          statementText,
          displayOrder: index,
        })),
        ...payload.meaningfulDisagreement.map((statementText, index) => ({
          kind: "meaningful_disagreement" as const,
          statementText,
          displayOrder: index,
        })),
      ];
      const findingsInserted = await insertReportFindings(tx, {
        reportId: insertedReport.value.id,
        dataProvenance,
        findings: findingsInput,
      });
      if (!findingsInserted.ok) {
        throw new Error(findingsInserted.code);
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.reports.imported",
        subjectType: "public_input_report_import",
        subjectId: insertedImport.value.id,
        summary: "Public Input aggregate report import validated and stored.",
        privatePayload: {
          conversationId: input.conversationId,
          topicId: conversation.value.topicId,
          importId: insertedImport.value.id,
          reportId: insertedReport.value.id,
          capability: "consultations.reports.import",
          sourceKind: insertedImport.value.sourceKind,
          schemaVersion: insertedImport.value.schemaVersion,
          canonicalHash,
          reportVersion: insertedReport.value.version,
          isIdempotentReplay: false,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return {
        ok: true as const,
        value: {
          importId: insertedImport.value.id,
          reportId: insertedReport.value.id,
          reportVersion: insertedReport.value.version,
          isIdempotentReplay: false,
        },
      };
    });
  } catch (error) {
    return mapServiceError(error, "PUBLIC_INPUT_REPORT_IMPORT_FAILED");
  }
}

export async function validateReport(
  db: GatedDb,
  input: {
    actorAccountId: string;
    reportId: string;
    expectedConcurrencyVersion: number;
  },
): Promise<AdapterResult<ReportRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.reports.import",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getReportOrThrow(tx, input.reportId);
      if (
        current.workflowState !== "imported" ||
        current.concurrencyVersion !== input.expectedConcurrencyVersion
      ) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }

      const updated = await updateReportWorkflowState(tx, {
        reportId: input.reportId,
        expectedConcurrencyVersion: input.expectedConcurrencyVersion,
        nextWorkflowState: "validated",
      });
      if (!updated.ok) throw new Error(updated.code);
      if (!updated.value) throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.reports.validated",
        subjectType: "public_input_report",
        subjectId: updated.value.id,
        summary: "Public Input aggregate report import passed canonical validation.",
        privatePayload: {
          conversationId: updated.value.conversationId,
          topicId: updated.value.topicId,
          importId: updated.value.importId,
          reportId: updated.value.id,
          capability: "consultations.reports.import",
          previousWorkflowState: "imported",
          nextWorkflowState: "validated",
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "PUBLIC_INPUT_REPORT_VALIDATE_FAILED");
  }
}

export async function beginReview(
  db: GatedDb,
  input: {
    actorAccountId: string;
    reportId: string;
    expectedConcurrencyVersion: number;
  },
): Promise<AdapterResult<ReportRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.reports.review",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getReportOrThrow(tx, input.reportId);
      if (
        current.workflowState !== "validated" ||
        current.concurrencyVersion !== input.expectedConcurrencyVersion
      ) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }

      const updated = await updateReportWorkflowState(tx, {
        reportId: input.reportId,
        expectedConcurrencyVersion: input.expectedConcurrencyVersion,
        nextWorkflowState: "under_review",
      });
      if (!updated.ok) throw new Error(updated.code);
      if (!updated.value) throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.reports.review_started",
        subjectType: "public_input_report",
        subjectId: updated.value.id,
        summary: "Public Input aggregate report moved under review.",
        privatePayload: {
          conversationId: updated.value.conversationId,
          topicId: updated.value.topicId,
          reportId: updated.value.id,
          capability: "consultations.reports.review",
          previousWorkflowState: "validated",
          nextWorkflowState: "under_review",
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "PUBLIC_INPUT_REPORT_REVIEW_FAILED");
  }
}

export type PublishReportInput = {
  actorAccountId: string;
  reportId: string;
  expectedConcurrencyVersion: number;
  smallCellThreshold?: number;
  minParticipationForGroups?: number;
};

export async function publishReport(
  db: GatedDb,
  input: PublishReportInput,
): Promise<AdapterResult<ReportRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.reports.publish",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getReportOrThrow(tx, input.reportId);
      if (
        current.workflowState !== "under_review" ||
        current.concurrencyVersion !== input.expectedConcurrencyVersion
      ) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }

      // Legacy-estimated / pre-@1.1 reports may never publish — a correction
      // requires a brand-new import version (ADR 0019, 4.5A.1). The DB CHECK
      // enforces this too; this fails closed earlier with a clearer code.
      if (current.requiresReimport) {
        throw new Error("PUBLIC_INPUT_REPORT_REQUIRES_REIMPORT");
      }

      // Production small-cell suppression has not cleared privacy review
      // (OQ27/OQ35) — every non-synthetic (manual_aggregate) publish, and
      // any custom threshold/minParticipation override on one, is refused
      // unless an operator has explicitly opted in via the escape-hatch env
      // var. This blocks both the general publish and the override case in
      // one fail-closed gate (4.5A.1).
      const isSyntheticReport = current.dataProvenance === "synthetic_fixture";
      if (!isSyntheticReport && !allowsNonSyntheticReportPublish()) {
        throw new Error("PUBLIC_INPUT_REPORT_PRODUCTION_PRIVACY_UNAPPROVED");
      }

      const conversation = await getConversationById(tx, current.conversationId);
      if (!conversation.ok) throw new Error(conversation.code);
      if (!conversation.value) throw new Error("CONSULTATION_NOT_FOUND");
      if (conversation.value.workflowState !== "closed") {
        throw new Error("CONSULTATION_NOT_CLOSED_FOR_PUBLISH");
      }

      const reportImport = await getReportImportById(tx, current.importId);
      if (!reportImport.ok) throw new Error(reportImport.code);
      if (!reportImport.value) throw new Error("PUBLIC_INPUT_REPORT_IMPORT_ORPHANED");

      const groups = await getReportGroupsByReportId(tx, input.reportId);
      if (!groups.ok) throw new Error(groups.code);

      const orderedGroups = [...groups.value].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );
      const resolvedThreshold =
        input.smallCellThreshold ?? PROVISIONAL_DEMO_SMALL_CELL_THRESHOLD;
      const resolvedMinParticipation =
        input.minParticipationForGroups ?? resolvedThreshold;
      const suppression = applyComplementarySmallCellSuppression(
        orderedGroups.map((g) => ({
          label: g.label,
          participantCount: g.participantCount,
        })),
        reportImport.value.participationCount,
        {
          threshold: resolvedThreshold,
          minParticipationForGroups: resolvedMinParticipation,
        },
      );

      for (let i = 0; i < orderedGroups.length; i += 1) {
        const group = orderedGroups[i]!;
        const nextStatus = suppression.groupsOmitted
          ? "omitted"
          : suppression.groups[i]!.status;
        const nextShare = suppression.groupsOmitted
          ? null
          : suppression.groups[i]!.share;
        const updatedGroup = await updateReportGroupPublication(tx, {
          groupId: group.id,
          publishedStatus: nextStatus,
          publishedShare: nextShare,
        });
        if (!updatedGroup.ok) throw new Error(updatedGroup.code);
      }

      const previousPublished = await getLatestPublishedReportForConversation(
        tx,
        current.conversationId,
      );
      if (!previousPublished.ok) throw new Error(previousPublished.code);

      if (previousPublished.value && previousPublished.value.id !== current.id) {
        const superseded = await supersedeReport(tx, {
          reportId: previousPublished.value.id,
          expectedConcurrencyVersion:
            previousPublished.value.concurrencyVersion,
          supersededByReportId: current.id,
        });
        if (!superseded.ok) throw new Error(superseded.code);
        if (!superseded.value) throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");

        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.reports.superseded",
          subjectType: "public_input_report",
          subjectId: superseded.value.id,
          summary: "Public Input aggregate report superseded by a newer published version.",
          privatePayload: {
            conversationId: superseded.value.conversationId,
            topicId: superseded.value.topicId,
            reportId: superseded.value.id,
            capability: "consultations.reports.publish",
            previousWorkflowState: "published",
            nextWorkflowState: "superseded",
            supersededByReportId: current.id,
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });
      }

      const publishedAt = new Date();
      const published = await publishReportWorkflow(tx, {
        reportId: input.reportId,
        expectedConcurrencyVersion: input.expectedConcurrencyVersion,
        publisherAccountId: decision.principal.accountId,
        publishedAt,
        smallCellPolicyVersion: SMALL_CELL_POLICY_VERSION,
        smallCellAlgorithmVersion: SMALL_CELL_ALGORITHM_VERSION,
        smallCellThreshold: resolvedThreshold,
        smallCellMinParticipation: resolvedMinParticipation,
      });
      if (!published.ok) throw new Error(published.code);
      if (!published.value) throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");

      const suppressedCellCount = suppression.groupsOmitted
        ? orderedGroups.length
        : suppression.suppressedCells;

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.reports.published",
        subjectType: "public_input_report",
        subjectId: published.value.id,
        summary: "Public Input aggregate report published.",
        privatePayload: {
          conversationId: published.value.conversationId,
          topicId: published.value.topicId,
          reportId: published.value.id,
          capability: "consultations.reports.publish",
          previousWorkflowState: "under_review",
          nextWorkflowState: "published",
          reportVersion: published.value.version,
          supersededReportId: previousPublished.value?.id ?? null,
          suppressedCellCount,
          smallCellPolicyVersion: SMALL_CELL_POLICY_VERSION,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: published.value };
    });
  } catch (error) {
    return mapServiceError(error, "PUBLIC_INPUT_REPORT_PUBLISH_FAILED");
  }
}

export async function rejectReport(
  db: GatedDb,
  input: {
    actorAccountId: string;
    reportId: string;
    expectedConcurrencyVersion: number;
    reason: string;
  },
): Promise<AdapterResult<ReportRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  if (!isSubstantiveReason(input.reason)) {
    return {
      ok: false,
      error: "A substantive reason is required to reject a report",
      code: "PUBLIC_INPUT_REPORT_REASON_REQUIRED",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.reports.review",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getReportOrThrow(tx, input.reportId);
      if (
        (current.workflowState !== "validated" &&
          current.workflowState !== "under_review") ||
        current.concurrencyVersion !== input.expectedConcurrencyVersion
      ) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }
      const previousWorkflowState = current.workflowState;

      const updated = await updateReportWorkflowState(tx, {
        reportId: input.reportId,
        expectedConcurrencyVersion: input.expectedConcurrencyVersion,
        nextWorkflowState: "rejected",
      });
      if (!updated.ok) throw new Error(updated.code);
      if (!updated.value) throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.reports.rejected",
        subjectType: "public_input_report",
        subjectId: updated.value.id,
        summary: "Public Input aggregate report rejected.",
        reason: input.reason.trim(),
        privatePayload: {
          conversationId: updated.value.conversationId,
          topicId: updated.value.topicId,
          reportId: updated.value.id,
          capability: "consultations.reports.review",
          previousWorkflowState,
          nextWorkflowState: "rejected",
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "PUBLIC_INPUT_REPORT_REJECT_FAILED");
  }
}

export async function getPublishedReportForTopic(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<PublicReportDto | null>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const report = await getLatestPublishedReportForTopic(db, topicId);
  if (!report.ok) return report;
  if (!report.value) return { ok: true, value: null };

  const [reportImport, groups, findings] = await Promise.all([
    getReportImportById(db, report.value.importId),
    getReportGroupsByReportId(db, report.value.id),
    getReportFindingsByReportId(db, report.value.id),
  ]);
  if (!reportImport.ok) return reportImport;
  if (!groups.ok) return groups;
  if (!findings.ok) return findings;
  if (!reportImport.value) {
    return {
      ok: false,
      error: "Published report is missing its import provenance",
      code: "PUBLIC_INPUT_REPORT_IMPORT_ORPHANED",
    };
  }

  const dto = toPublicReportDto({
    report: report.value,
    reportImport: reportImport.value,
    groups: groups.value,
    findings: findings.value,
  });
  return { ok: true, value: dto };
}

export type StaffReportListItem = {
  reportId: string;
  version: number;
  concurrencyVersion: number;
  workflowState: ReportRecord["workflowState"];
  publicTitle: string;
  isLatestPublished: boolean;
  publishedAt: string | null;
  importerAccountId: string | null;
  publisherAccountId: string | null;
  supersededByReportId: string | null;
  synthetic: boolean;
  createdAt: string;
  updatedAt: string;
};

async function authorizeAnyReportStaffCapability(
  db: GatedDb,
  actorAccountId: string,
): Promise<AdapterResult<{ accountId: string; synthetic: boolean }>> {
  const principal = await loadPrincipal(db, actorAccountId);
  for (const capability of [
    "consultations.reports.import",
    "consultations.reports.review",
    "consultations.reports.publish",
  ] as const) {
    const decision = await authorizeCapability(db, principal, capability);
    if (decision.ok) {
      return {
        ok: true,
        value: {
          accountId: decision.principal.accountId,
          synthetic: decision.principal.synthetic,
        },
      };
    }
  }
  return {
    ok: false,
    error: "Missing report staff capability",
    code: "AUTHZ_DENIED",
  };
}

export async function listStaffReportsForConversation(
  db: GatedDb,
  input: { actorAccountId: string; conversationId: string },
): Promise<AdapterResult<StaffReportListItem[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const authz = await authorizeAnyReportStaffCapability(db, input.actorAccountId);
  if (!authz.ok) return authz;

  const conversation = await getConversationById(db, input.conversationId);
  if (!conversation.ok) return conversation;
  if (!conversation.value) {
    return {
      ok: false,
      error: "Public Input conversation not found",
      code: "CONSULTATION_NOT_FOUND",
    };
  }

  const reports = await listReportsForConversation(db, input.conversationId);
  if (!reports.ok) return reports;

  return {
    ok: true,
    value: reports.value.map((report) => ({
      reportId: report.id,
      version: report.version,
      concurrencyVersion: report.concurrencyVersion,
      workflowState: report.workflowState,
      publicTitle: report.publicTitle,
      isLatestPublished: report.isLatestPublished,
      publishedAt: report.publishedAt ? report.publishedAt.toISOString() : null,
      importerAccountId: report.importerAccountId,
      publisherAccountId: report.publisherAccountId,
      supersededByReportId: report.supersededByReportId,
      synthetic: report.synthetic,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    })),
  };
}

export async function getStaffReportDetail(
  db: GatedDb,
  input: { actorAccountId: string; reportId: string },
): Promise<AdapterResult<StaffReportDetailDto | null>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const authz = await authorizeAnyReportStaffCapability(db, input.actorAccountId);
  if (!authz.ok) return authz;

  const report = await getReportById(db, input.reportId);
  if (!report.ok) return report;
  if (!report.value) return { ok: true, value: null };

  const [reportImport, groups, findings] = await Promise.all([
    getReportImportById(db, report.value.importId),
    getReportGroupsByReportId(db, report.value.id),
    getReportFindingsByReportId(db, report.value.id),
  ]);
  if (!reportImport.ok) return reportImport;
  if (!groups.ok) return groups;
  if (!findings.ok) return findings;
  if (!reportImport.value) {
    return {
      ok: false,
      error: "Report is missing its import provenance",
      code: "PUBLIC_INPUT_REPORT_IMPORT_ORPHANED",
    };
  }

  return {
    ok: true,
    value: toStaffReportDetailDto({
      report: report.value,
      reportImport: reportImport.value,
      groups: groups.value,
      findings: findings.value,
    }),
  };
}

async function getReportOrThrow(
  db: GatedDb,
  reportId: string,
): Promise<ReportRecord> {
  const current = await getReportById(db, reportId);
  if (!current.ok) {
    throw new Error(current.code);
  }
  if (!current.value) {
    throw new Error("PUBLIC_INPUT_REPORT_NOT_FOUND");
  }
  return current.value;
}

function mapServiceError(
  error: unknown,
  fallbackCode: string,
): AdapterResult<never> {
  if (
    typeof error === "object" &&
    error &&
    "decision" in error &&
    (error as { decision: { ok: false } }).decision
  ) {
    return authzFail(
      (error as {
        decision: Exclude<
          Awaited<ReturnType<typeof authorizeCapability>>,
          { ok: true }
        >;
      }).decision,
    );
  }
  const message = error instanceof Error ? error.message : "";
  const KNOWN: Record<string, { error: string; code: string }> = {
    CONSULTATION_NOT_FOUND: {
      error: "Public Input conversation not found",
      code: "CONSULTATION_NOT_FOUND",
    },
    CONSULTATION_NOT_READY_FOR_IMPORT: {
      error:
        "Conversation must be voting_closed or closed before an aggregate report can be imported",
      code: "CONSULTATION_NOT_READY_FOR_IMPORT",
    },
    CONSULTATION_NOT_CLOSED_FOR_PUBLISH: {
      error: "Conversation must be closed before its report can be published",
      code: "CONSULTATION_NOT_CLOSED_FOR_PUBLISH",
    },
    PUBLIC_INPUT_REPORT_NOT_FOUND: {
      error: "Public Input report not found",
      code: "PUBLIC_INPUT_REPORT_NOT_FOUND",
    },
    PUBLIC_INPUT_REPORT_STATE_CONFLICT: {
      error: "Report changed; reload and retry",
      code: "PUBLIC_INPUT_REPORT_STATE_CONFLICT",
    },
    PUBLIC_INPUT_REPORT_IMPORT_ORPHANED: {
      error: "Report import provenance is missing",
      code: "PUBLIC_INPUT_REPORT_IMPORT_ORPHANED",
    },
    PUBLIC_INPUT_REPORT_REQUIRES_REIMPORT: {
      error:
        "Report has legacy estimated counts and requires a new import version before it can publish",
      code: "PUBLIC_INPUT_REPORT_REQUIRES_REIMPORT",
    },
    PUBLIC_INPUT_REPORT_PRODUCTION_PRIVACY_UNAPPROVED: {
      error:
        "Publishing a non-synthetic (manual_aggregate) report requires explicit operator approval pending production small-cell privacy review",
      code: "PUBLIC_INPUT_REPORT_PRODUCTION_PRIVACY_UNAPPROVED",
    },
  };
  if (KNOWN[message]) {
    return { ok: false, ...KNOWN[message] };
  }
  return {
    ok: false,
    error: "Public Input report operation failed",
    code: fallbackCode,
  };
}
