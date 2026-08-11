import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  type ClaimRecord,
  getClaimById,
  type SubmissionWorkflowState,
  updateClaimContent,
} from "@/lib/claims/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  type EvidenceAuthorType,
  type EvidenceSourceType,
  type EvidenceSubmissionRecord,
  getEvidenceSubmissionById,
  updateEvidenceContent,
} from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  insertClaimContentRevision,
  insertEvidenceContentRevision,
} from "@/lib/revisions/repository";
import {
  claimContentSnapshotSchema,
  diffClaimContent,
  diffEvidenceContent,
  evidenceContentSnapshotSchema,
} from "@/lib/revisions/schemas";

/**
 * Draft-only edits (never submitted) may overwrite content without a revision row.
 * Post-submission edits in `changes_requested` always write append-only history.
 */
const DRAFT_ONLY: SubmissionWorkflowState = "draft";
const REVISION_REQUIRED: SubmissionWorkflowState = "changes_requested";

function gatedOrDeny<T>(): AdapterResult<T> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Submissions unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_SUBMISSIONS",
    };
  }
  return null;
}

function mapThrownAuthz(error: unknown): AdapterResult<never> | null {
  if (
    error &&
    typeof error === "object" &&
    "decision" in error &&
    error.decision &&
    typeof error.decision === "object" &&
    "ok" in error.decision &&
    (error.decision as { ok: boolean }).ok === false
  ) {
    const decision = error.decision as unknown as {
      error: string;
      code: string;
    };
    return { ok: false, error: decision.error, code: decision.code };
  }
  return null;
}

export const updateOwnClaimContentSchema = z.object({
  claimId: z.string().min(1),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  approachLabel: z.string().trim().min(1).max(200),
});

export const updateOwnEvidenceContentSchema = z.object({
  evidenceSubmissionId: z.string().min(1),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  sourceUrl: evidenceContentSnapshotSchema.shape.sourceUrl,
  title: z.string().trim().min(1).max(200),
  organization: z.string().trim().min(1).max(200),
  authorType: evidenceContentSnapshotSchema.shape.authorType,
  sourceType: evidenceContentSnapshotSchema.shape.sourceType,
  limitations: z.string().trim().min(1).max(4000),
});

export type ClaimEditResult = {
  claim: ClaimRecord;
  revisionRecorded: boolean;
  noop: boolean;
};

export type EvidenceEditResult = {
  evidence: EvidenceSubmissionRecord;
  revisionRecorded: boolean;
  noop: boolean;
};

/**
 * Subject-specific claim content edit.
 * - draft: unversioned overwrite (no revision/audit when content actually changes
 *   still emits claims.updated; true no-op emits nothing).
 * - changes_requested: content update + revision + claims.updated +
 *   claims.revision_recorded atomically.
 */
export async function updateOwnClaimContent(
  db: GatedDb,
  input: {
    actorAccountId: string;
  } & z.input<typeof updateOwnClaimContentSchema>,
): Promise<AdapterResult<ClaimEditResult>> {
  const denied = gatedOrDeny<ClaimEditResult>();
  if (denied) return denied;

  const parsed = updateOwnClaimContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid claim content",
      code: "SUBMISSION_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      if (!principal) throw new Error("AUTH_REQUIRED");
      const authz = await authorizeCapability(tx, principal, "claims.edit_own");
      if (!authz.ok) throw Object.assign(new Error(authz.code), { decision: authz });

      const claim = await getClaimById(tx, parsed.data.claimId);
      if (!claim.ok || !claim.value) throw new Error("CLAIM_NOT_FOUND");
      if (claim.value.authorAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (
        claim.value.workflowState !== DRAFT_ONLY &&
        claim.value.workflowState !== REVISION_REQUIRED
      ) {
        throw new Error("SUBMISSION_NOT_EDITABLE");
      }

      const before = claimContentSnapshotSchema.parse({
        title: claim.value.title,
        summary: claim.value.summary,
        approachLabel: claim.value.approachLabel,
      });
      const after = claimContentSnapshotSchema.parse({
        title: parsed.data.title,
        summary: parsed.data.summary,
        approachLabel: parsed.data.approachLabel,
      });
      const changedFields = diffClaimContent(before, after);
      if (changedFields.length === 0) {
        return {
          ok: true as const,
          value: { claim: claim.value, revisionRecorded: false, noop: true },
        };
      }

      const updated = await updateClaimContent(tx, {
        claimId: claim.value.id,
        expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
        title: after.title,
        summary: after.summary,
        approachLabel: after.approachLabel,
      });
      if (!updated.ok) throw new Error(updated.code);
      if (!updated.value) throw new Error("SUBMISSION_STATE_CONFLICT");

      let revisionRecorded = false;
      if (claim.value.workflowState === REVISION_REQUIRED) {
        const revision = await insertClaimContentRevision(tx, {
          topicId: claim.value.topicId,
          claimId: claim.value.id,
          editorAccountId: principal.accountId,
          changedFields,
          beforeSnapshot: before,
          afterSnapshot: after,
          synthetic: principal.synthetic,
        });
        if (!revision.ok) throw new Error(revision.code);
        revisionRecorded = true;

        await appendAuthAudit(tx, {
          actorRole: "account_holder",
          actorAccountId: principal.accountId,
          action: "claims.revision_recorded",
          subjectType: "claim",
          subjectId: updated.value.id,
          summary: "Claim content revision recorded.",
          privatePayload: {
            claimId: updated.value.id,
            topicId: updated.value.topicId,
            revisionNumber: revision.value.revisionNumber,
            changedFields,
            capability: "claims.edit_own",
            previousWorkflowState: claim.value.workflowState,
            nextWorkflowState: updated.value.workflowState,
            actorAccountId: principal.accountId,
          },
          synthetic: principal.synthetic,
        });
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "claims.updated",
        subjectType: "claim",
        subjectId: updated.value.id,
        summary: "Own claim content updated.",
        privatePayload: {
          claimId: updated.value.id,
          topicId: updated.value.topicId,
          capability: "claims.edit_own",
          previousWorkflowState: claim.value.workflowState,
          nextWorkflowState: updated.value.workflowState,
          actorAccountId: principal.accountId,
        },
        synthetic: principal.synthetic,
      });

      return {
        ok: true as const,
        value: { claim: updated.value, revisionRecorded, noop: false },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "CLAIM_NOT_FOUND" || message === "SUBMISSION_NOT_OWNED") {
      return { ok: false, error: "Submission not found", code: "CLAIM_NOT_FOUND" };
    }
    if (message === "SUBMISSION_NOT_EDITABLE") {
      return {
        ok: false,
        error: "Claim is not editable in its current state",
        code: "SUBMISSION_NOT_EDITABLE",
      };
    }
    if (
      message === "SUBMISSION_STATE_CONFLICT" ||
      message === "REVISION_SEQUENCE_CONFLICT"
    ) {
      return {
        ok: false,
        error: "Claim changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    if (message === "REVISION_INSERT_FAILED") {
      return {
        ok: false,
        error: "Claim update failed",
        code: "SUBMISSION_UPDATE_FAILED",
      };
    }
    return {
      ok: false,
      error: "Claim update failed",
      code: "SUBMISSION_UPDATE_FAILED",
    };
  }
}

export async function updateOwnEvidenceContent(
  db: GatedDb,
  input: {
    actorAccountId: string;
  } & z.input<typeof updateOwnEvidenceContentSchema>,
): Promise<AdapterResult<EvidenceEditResult>> {
  const denied = gatedOrDeny<EvidenceEditResult>();
  if (denied) return denied;

  const parsed = updateOwnEvidenceContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid evidence content",
      code: "SUBMISSION_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      if (!principal) throw new Error("AUTH_REQUIRED");
      const authz = await authorizeCapability(
        tx,
        principal,
        "evidence.edit_own",
      );
      if (!authz.ok) throw Object.assign(new Error(authz.code), { decision: authz });

      const evidence = await getEvidenceSubmissionById(
        tx,
        parsed.data.evidenceSubmissionId,
      );
      if (!evidence.ok || !evidence.value) throw new Error("EVIDENCE_NOT_FOUND");
      if (evidence.value.submitterAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (
        evidence.value.workflowState !== DRAFT_ONLY &&
        evidence.value.workflowState !== REVISION_REQUIRED
      ) {
        throw new Error("SUBMISSION_NOT_EDITABLE");
      }

      const before = evidenceContentSnapshotSchema.parse({
        sourceUrl: evidence.value.sourceUrl,
        title: evidence.value.title,
        organization: evidence.value.organization,
        authorType: evidence.value.authorType,
        sourceType: evidence.value.sourceType,
        limitations: evidence.value.limitations,
      });
      const after = evidenceContentSnapshotSchema.parse({
        sourceUrl: parsed.data.sourceUrl,
        title: parsed.data.title,
        organization: parsed.data.organization,
        authorType: parsed.data.authorType,
        sourceType: parsed.data.sourceType,
        limitations: parsed.data.limitations,
      });
      const changedFields = diffEvidenceContent(before, after);
      if (changedFields.length === 0) {
        return {
          ok: true as const,
          value: {
            evidence: evidence.value,
            revisionRecorded: false,
            noop: true,
          },
        };
      }

      const updated = await updateEvidenceContent(tx, {
        evidenceId: evidence.value.id,
        expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
        sourceUrl: after.sourceUrl,
        title: after.title,
        organization: after.organization,
        authorType: after.authorType as EvidenceAuthorType,
        sourceType: after.sourceType as EvidenceSourceType,
        limitations: after.limitations,
      });
      if (!updated.ok) throw new Error(updated.code);
      if (!updated.value) throw new Error("SUBMISSION_STATE_CONFLICT");

      let revisionRecorded = false;
      if (evidence.value.workflowState === REVISION_REQUIRED) {
        const revision = await insertEvidenceContentRevision(tx, {
          topicId: evidence.value.topicId,
          evidenceSubmissionId: evidence.value.id,
          editorAccountId: principal.accountId,
          changedFields,
          beforeSnapshot: before,
          afterSnapshot: after,
          synthetic: principal.synthetic,
        });
        if (!revision.ok) throw new Error(revision.code);
        revisionRecorded = true;

        await appendAuthAudit(tx, {
          actorRole: "account_holder",
          actorAccountId: principal.accountId,
          action: "evidence.revision_recorded",
          subjectType: "evidence_submission",
          subjectId: updated.value.id,
          summary: "Evidence content revision recorded.",
          privatePayload: {
            evidenceSubmissionId: updated.value.id,
            topicId: updated.value.topicId,
            revisionNumber: revision.value.revisionNumber,
            changedFields,
            capability: "evidence.edit_own",
            previousWorkflowState: evidence.value.workflowState,
            nextWorkflowState: updated.value.workflowState,
            actorAccountId: principal.accountId,
          },
          synthetic: principal.synthetic,
        });
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "evidence.updated",
        subjectType: "evidence_submission",
        subjectId: updated.value.id,
        summary: "Own evidence content updated.",
        privatePayload: {
          evidenceSubmissionId: updated.value.id,
          topicId: updated.value.topicId,
          capability: "evidence.edit_own",
          previousWorkflowState: evidence.value.workflowState,
          nextWorkflowState: updated.value.workflowState,
          actorAccountId: principal.accountId,
          sourceUrlHost: new URL(after.sourceUrl).host,
        },
        synthetic: principal.synthetic,
      });

      return {
        ok: true as const,
        value: { evidence: updated.value, revisionRecorded, noop: false },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "EVIDENCE_NOT_FOUND" || message === "SUBMISSION_NOT_OWNED") {
      return {
        ok: false,
        error: "Submission not found",
        code: "EVIDENCE_NOT_FOUND",
      };
    }
    if (message === "SUBMISSION_NOT_EDITABLE") {
      return {
        ok: false,
        error: "Evidence is not editable in its current state",
        code: "SUBMISSION_NOT_EDITABLE",
      };
    }
    if (
      message === "SUBMISSION_STATE_CONFLICT" ||
      message === "REVISION_SEQUENCE_CONFLICT"
    ) {
      return {
        ok: false,
        error: "Evidence changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Evidence update failed",
      code: "SUBMISSION_UPDATE_FAILED",
    };
  }
}
