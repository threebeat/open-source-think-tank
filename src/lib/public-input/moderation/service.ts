import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import { getConversationById } from "@/lib/public-input/lifecycle/repository";
import {
  getProviderModerationRecord,
  upsertProviderModerationRecord,
  type ProviderModerationRecord,
  type ProviderModerationStatus,
} from "@/lib/public-input/moderation/repository";
import {
  getFindingById,
  getReportById,
  insertReportModerationAction,
  updateFindingPublicationStatus,
  type PublicInputReportModerationActionKind,
  type ReportFindingRecord,
} from "@/lib/public-input/reports/repository";

const MIN_RATIONALE_LENGTH = 8;
const MAX_REASON_CODE_LENGTH = 200;

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Public Input moderation unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_MODERATION",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }>,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function isSubstantiveRationale(rationale: string | undefined): boolean {
  return Boolean(rationale && rationale.trim().length >= MIN_RATIONALE_LENGTH);
}

export type RecordProviderModerationInput = {
  actorAccountId: string;
  conversationId: string;
  /** Protected fingerprint — never the statement text itself. */
  opaqueStatementRef: string;
  status: ProviderModerationStatus;
  reasonCode: string;
  privateNote?: string;
};

/**
 * Observational provider-side record (ADR 0020). This is a shadow of what a
 * (fixture-only, never-live) provider reports as its own moderation status —
 * it never implies institutional endorsement, never assigns agenda
 * priority, and never edits consultation metrics.
 */
export async function recordProviderModeration(
  db: GatedDb,
  input: RecordProviderModerationInput,
): Promise<AdapterResult<ProviderModerationRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const opaqueStatementRef = input.opaqueStatementRef.trim();
  const reasonCode = input.reasonCode.trim();
  if (!opaqueStatementRef) {
    return {
      ok: false,
      error: "opaqueStatementRef is required",
      code: "PROVIDER_MODERATION_REF_REQUIRED",
    };
  }
  if (!reasonCode || reasonCode.length > MAX_REASON_CODE_LENGTH) {
    return {
      ok: false,
      error: "reasonCode is required and bounded",
      code: "PROVIDER_MODERATION_REASON_CODE_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.moderation.record",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const conversation = await getConversationById(tx, input.conversationId);
      if (!conversation.ok) throw new Error(conversation.code);
      if (!conversation.value) throw new Error("CONSULTATION_NOT_FOUND");

      const existing = await getProviderModerationRecord(tx, {
        conversationId: input.conversationId,
        opaqueStatementRef,
      });
      if (!existing.ok) throw new Error(existing.code);

      const upserted = await upsertProviderModerationRecord(tx, {
        conversationId: input.conversationId,
        opaqueStatementRef,
        status: input.status,
        reasonCode,
        privateNote: input.privateNote?.trim() || null,
        actorAccountId: decision.principal.accountId,
        synthetic: decision.principal.synthetic,
      });
      if (!upserted.ok) throw new Error(upserted.code);

      await appendAuthAudit(tx, {
        actorRole: decision.principal.platformRoles.includes("moderator")
          ? "moderator"
          : "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.moderation.provider_recorded",
        subjectType: "public_input_provider_moderation_record",
        subjectId: upserted.value.id,
        summary:
          "Provider-side Public Input moderation status recorded (observational; opaque ref never audited).",
        privatePayload: {
          conversationId: input.conversationId,
          topicId: conversation.value.topicId,
          moderationRecordId: upserted.value.id,
          capability: "consultations.moderation.record",
          previousStatus: existing.value?.status ?? null,
          nextStatus: upserted.value.status,
          reasonCode: upserted.value.reasonCode,
          hasPrivateNote: Boolean(upserted.value.privateNote),
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: upserted.value };
    });
  } catch (error) {
    return mapServiceError(error, "PROVIDER_MODERATION_RECORD_FAILED");
  }
}

export type DecideFindingPublicationInput = {
  actorAccountId: string;
  reportId: string;
  findingId: string;
  action: PublicInputReportModerationActionKind;
  /** Required optimistic concurrency token for the parent report row. */
  expectedConcurrencyVersion: number;
  publicRationale?: string;
  privateNote?: string;
};

/**
 * Institutional finding-eligibility decision (ADR 0020 / 4.5A). Append-only —
 * inserts a moderation-action row and updates the finding's
 * `publicationStatus` in the same transaction. Allowed **only** while the
 * parent report is `under_review` (published content is immutable — ADR 0019).
 * Moderators do not hold this capability; only `consultations.reports.review`
 * (administrator) may decide finding publication.
 */
export async function decideFindingPublication(
  db: GatedDb,
  input: DecideFindingPublicationInput,
): Promise<AdapterResult<ReportFindingRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  if (
    input.action !== "include" &&
    !isSubstantiveRationale(input.publicRationale)
  ) {
    return {
      ok: false,
      error: "A public rationale is required to withhold or supersede a finding",
      code: "FINDING_DECISION_RATIONALE_REQUIRED",
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

      const report = await getReportById(tx, input.reportId);
      if (!report.ok) throw new Error(report.code);
      if (!report.value) throw new Error("PUBLIC_INPUT_REPORT_NOT_FOUND");
      if (report.value.workflowState !== "under_review") {
        throw new Error("PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW");
      }
      if (
        report.value.concurrencyVersion !== input.expectedConcurrencyVersion
      ) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }

      const finding = await getFindingById(tx, input.findingId);
      if (!finding.ok) throw new Error(finding.code);
      if (!finding.value || finding.value.reportId !== input.reportId) {
        throw new Error("PUBLIC_INPUT_FINDING_NOT_FOUND");
      }
      const previousPublicationStatus = finding.value.publicationStatus;

      const nextPublicationStatus =
        input.action === "include"
          ? "included"
          : input.action === "withhold"
            ? "withheld"
            : "superseded";

      const inserted = await insertReportModerationAction(tx, {
        reportId: input.reportId,
        findingId: input.findingId,
        action: input.action,
        publicRationale: input.publicRationale?.trim() || null,
        privateNote: input.privateNote?.trim() || null,
        actorAccountId: decision.principal.accountId,
        synthetic: decision.principal.synthetic,
      });
      if (!inserted.ok) throw new Error(inserted.code);

      const updatedFinding = await updateFindingPublicationStatus(tx, {
        findingId: input.findingId,
        reportId: input.reportId,
        expectedConcurrencyVersion: input.expectedConcurrencyVersion,
        nextPublicationStatus,
      });
      if (!updatedFinding.ok) throw new Error(updatedFinding.code);
      if (!updatedFinding.value) {
        throw new Error("PUBLIC_INPUT_REPORT_STATE_CONFLICT");
      }

      if (input.action === "include") {
        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.reports.finding_included",
          subjectType: "public_input_report_finding",
          subjectId: updatedFinding.value.id,
          summary: "Public Input report finding (re)included in public projection.",
          privatePayload: {
            conversationId: report.value.conversationId,
            topicId: report.value.topicId,
            reportId: report.value.id,
            findingId: updatedFinding.value.id,
            moderationActionId: inserted.value.id,
            capability: "consultations.reports.review",
            previousPublicationStatus,
            nextPublicationStatus: "included",
            hasPrivateNote: Boolean(inserted.value.privateNote),
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });
      } else if (input.action === "withhold") {
        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.reports.finding_withheld",
          subjectType: "public_input_report_finding",
          subjectId: updatedFinding.value.id,
          summary: "Public Input report finding withheld from public projection.",
          reason: input.publicRationale?.trim(),
          privatePayload: {
            conversationId: report.value.conversationId,
            topicId: report.value.topicId,
            reportId: report.value.id,
            findingId: updatedFinding.value.id,
            moderationActionId: inserted.value.id,
            capability: "consultations.reports.review",
            previousPublicationStatus,
            nextPublicationStatus: "withheld",
            hasPublicRationale: true as const,
            hasPrivateNote: Boolean(inserted.value.privateNote),
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });
      } else {
        // supersede_finding (4.5A.1) — distinct audit action from withhold so
        // "a newer finding replaced this one" is never misreported as
        // "this finding failed institutional review".
        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.reports.finding_superseded",
          subjectType: "public_input_report_finding",
          subjectId: updatedFinding.value.id,
          summary: "Public Input report finding superseded in public projection.",
          reason: input.publicRationale?.trim(),
          privatePayload: {
            conversationId: report.value.conversationId,
            topicId: report.value.topicId,
            reportId: report.value.id,
            findingId: updatedFinding.value.id,
            moderationActionId: inserted.value.id,
            capability: "consultations.reports.review",
            previousPublicationStatus,
            nextPublicationStatus: "superseded",
            hasPublicRationale: true as const,
            hasPrivateNote: Boolean(inserted.value.privateNote),
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });
      }

      return { ok: true as const, value: updatedFinding.value };
    });
  } catch (error) {
    return mapServiceError(error, "FINDING_DECISION_FAILED");
  }
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
    PUBLIC_INPUT_REPORT_NOT_FOUND: {
      error: "Public Input report not found",
      code: "PUBLIC_INPUT_REPORT_NOT_FOUND",
    },
    PUBLIC_INPUT_FINDING_NOT_FOUND: {
      error: "Public Input report finding not found",
      code: "PUBLIC_INPUT_FINDING_NOT_FOUND",
    },
    PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW: {
      error:
        "Finding publication decisions are only allowed while the report is under_review",
      code: "PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW",
    },
    PUBLIC_INPUT_REPORT_STATE_CONFLICT: {
      error: "Report changed; reload and retry",
      code: "PUBLIC_INPUT_REPORT_STATE_CONFLICT",
    },
  };
  if (KNOWN[message]) {
    return { ok: false, ...KNOWN[message] };
  }
  return {
    ok: false,
    error: "Public Input moderation operation failed",
    code: fallbackCode,
  };
}
