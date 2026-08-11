import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  type ClaimEvidenceRelationship,
  type ClaimRecord,
  getClaimById,
  insertClaim,
  insertClaimEvidenceLink,
  listClaims,
  type SubmissionWorkflowState,
  updateClaimWorkflow,
} from "@/lib/claims/repository";
import { insertConflictDisclosure } from "@/lib/conflicts/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  type EvidenceAuthorType,
  type EvidenceSourceType,
  type EvidenceSubmissionRecord,
  getEvidenceSubmissionById,
  insertEvidenceSubmission,
  updateEvidenceWorkflow,
} from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  updateOwnClaimContent,
  updateOwnEvidenceContent,
} from "@/lib/revisions/edit";
import { getTopicById } from "@/lib/topics/repository";

export {
  updateOwnClaimContent,
  updateOwnEvidenceContent,
} from "@/lib/revisions/edit";

/**
 * Disclosure attachment rule (3.5):
 * One `conflict_disclosures` row attaches to the claim only (exactly-one-subject).
 * Evidence in the same envelope inherits the claim disclosure for the submission UI;
 * we do not invent a polymorphic subject or weaken the DB constraint.
 */

const MAX_TITLE = 200;
const MAX_SUMMARY = 4000;
const MAX_APPROACH = 200;
const MAX_ORG = 200;
const MAX_LIMITATIONS = 4000;
const MAX_URL = 2000;
const MAX_PUBLIC_SUMMARY = 1000;
const MAX_PRIVATE_DETAIL = 4000;
const NO_CONFLICT_SUMMARY = "No known conflict of interest to disclose.";

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_URL)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source URL must be a valid absolute URL",
      });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source URL must use http or https",
      });
    }
  });

const authorTypeSchema = z.enum([
  "agency",
  "researcher",
  "journalist",
  "civil_society",
  "industry",
  "other",
]);

const sourceTypeSchema = z.enum([
  "report",
  "dataset",
  "peer_reviewed",
  "news",
  "memo",
  "other",
]);

const relationshipSchema = z.enum(["supporting", "counterevidence"]);

const disclosureChoiceSchema = z.enum(["none", "disclose"]);

export const submissionEnvelopeSchema = z
  .object({
    topicId: z.string().min(1),
    claimTitle: z.string().trim().min(1).max(MAX_TITLE),
    claimSummary: z.string().trim().min(1).max(MAX_SUMMARY),
    approachLabel: z.string().trim().min(1).max(MAX_APPROACH),
    sourceUrl: httpUrlSchema,
    evidenceTitle: z.string().trim().min(1).max(MAX_TITLE),
    organization: z.string().trim().min(1).max(MAX_ORG),
    authorType: authorTypeSchema,
    sourceType: sourceTypeSchema,
    limitations: z.string().trim().min(1).max(MAX_LIMITATIONS),
    relationship: relationshipSchema,
    disclosureChoice: disclosureChoiceSchema,
    disclosurePublicSummary: z.string().trim().max(MAX_PUBLIC_SUMMARY).optional(),
    disclosurePrivateDetail: z
      .string()
      .trim()
      .max(MAX_PRIVATE_DETAIL)
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.disclosureChoice === "disclose") {
      const summary = value.disclosurePublicSummary?.trim() ?? "";
      if (summary.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Public conflict summary is required when disclosing",
          path: ["disclosurePublicSummary"],
        });
      }
    }
  });

export type SubmissionEnvelope = {
  claim: ClaimRecord;
  evidence: EvidenceSubmissionRecord;
  relationship: ClaimEvidenceRelationship;
  disclosureId: string;
};

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Submissions unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_SUBMISSIONS",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<
    Awaited<ReturnType<typeof authorizeCapability>>,
    { ok: true }
  >,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function mapThrownAuthz(error: unknown): AdapterResult<never> | null {
  if (
    typeof error === "object" &&
    error &&
    "decision" in error &&
    (error as { decision: { ok: false } }).decision
  ) {
    return authzFail(
      (
        error as {
          decision: Exclude<
            Awaited<ReturnType<typeof authorizeCapability>>,
            { ok: true }
          >;
        }
      ).decision,
    );
  }
  return null;
}

async function requireSubmitCapabilities(
  tx: GatedDb,
  actorAccountId: string,
) {
  const principal = await loadPrincipal(tx, actorAccountId);
  if (!principal) {
    throw Object.assign(new Error("AUTH_REQUIRED"), {
      decision: {
        ok: false as const,
        status: 401,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
    });
  }
  for (const capability of [
    "claims.submit",
    "evidence.submit",
    "conflicts.disclose_own",
  ] as const) {
    const decision = await authorizeCapability(tx, principal, capability);
    if (!decision.ok) {
      throw Object.assign(new Error(decision.code), { decision });
    }
  }
  return principal;
}

async function requirePrincipal(
  tx: GatedDb,
  actorAccountId: string,
) {
  const principal = await loadPrincipal(tx, actorAccountId);
  if (!principal) {
    throw Object.assign(new Error("AUTH_REQUIRED"), {
      decision: {
        ok: false as const,
        status: 401,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
    });
  }
  return principal;
}

function resolvePublicSummary(input: {
  disclosureChoice: "none" | "disclose";
  disclosurePublicSummary?: string;
}): string {
  if (input.disclosureChoice === "none") {
    return NO_CONFLICT_SUMMARY;
  }
  return input.disclosurePublicSummary!.trim();
}

/**
 * Atomic create-and-submit: claim + evidence + same-topic link + claim disclosure + audits.
 * Actor IDs come from the principal — never from the request body.
 */
export async function createAndSubmitClaimEvidence(
  db: GatedDb,
  input: {
    actorAccountId: string;
  } & z.input<typeof submissionEnvelopeSchema>,
): Promise<AdapterResult<SubmissionEnvelope>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = submissionEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid submission input",
      code: "SUBMISSION_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await requireSubmitCapabilities(
        tx,
        input.actorAccountId,
      );

      const topic = await getTopicById(tx, parsed.data.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }
      if (topic.value.workflowState !== "open_for_submissions") {
        throw new Error("TOPIC_NOT_OPEN_FOR_SUBMISSIONS");
      }

      const claim = await insertClaim(tx, {
        topicId: topic.value.id,
        authorAccountId: principal.accountId,
        title: parsed.data.claimTitle,
        summary: parsed.data.claimSummary,
        approachLabel: parsed.data.approachLabel,
        synthetic: principal.synthetic,
        workflowState: "submitted",
      });
      if (!claim.ok) throw new Error(claim.code);

      const evidence = await insertEvidenceSubmission(tx, {
        topicId: topic.value.id,
        submitterAccountId: principal.accountId,
        sourceUrl: parsed.data.sourceUrl,
        title: parsed.data.evidenceTitle,
        organization: parsed.data.organization,
        authorType: parsed.data.authorType as EvidenceAuthorType,
        sourceType: parsed.data.sourceType as EvidenceSourceType,
        limitations: parsed.data.limitations,
        synthetic: principal.synthetic,
        workflowState: "submitted",
      });
      if (!evidence.ok) throw new Error(evidence.code);

      const link = await insertClaimEvidenceLink(tx, {
        topicId: topic.value.id,
        claimId: claim.value.id,
        evidenceSubmissionId: evidence.value.id,
        relationship: parsed.data.relationship,
      });
      if (!link.ok) throw new Error(link.code);

      const publicSummary = resolvePublicSummary(parsed.data);
      const disclosure = await insertConflictDisclosure(tx, {
        disclosingAccountId: principal.accountId,
        claimId: claim.value.id,
        evidenceSubmissionId: null,
        publicSummary,
        privateDetail:
          parsed.data.disclosureChoice === "disclose"
            ? (parsed.data.disclosurePrivateDetail?.trim() || null)
            : null,
        synthetic: principal.synthetic,
      });
      if (!disclosure.ok) throw new Error(disclosure.code);

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "claims.submitted",
        subjectType: "claim",
        subjectId: claim.value.id,
        summary: "Claim submitted with linked evidence.",
        privatePayload: {
          claimId: claim.value.id,
          topicId: topic.value.id,
          evidenceSubmissionId: evidence.value.id,
          capability: "claims.submit",
          previousWorkflowState: null,
          nextWorkflowState: "submitted",
          actorAccountId: principal.accountId,
          relationship: parsed.data.relationship,
        },
        synthetic: principal.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "evidence.submitted",
        subjectType: "evidence_submission",
        subjectId: evidence.value.id,
        summary: "Evidence source URL submitted (not fetched).",
        privatePayload: {
          evidenceSubmissionId: evidence.value.id,
          topicId: topic.value.id,
          claimId: claim.value.id,
          capability: "evidence.submit",
          previousWorkflowState: null,
          nextWorkflowState: "submitted",
          actorAccountId: principal.accountId,
          sourceUrlHost: new URL(parsed.data.sourceUrl).host,
        },
        synthetic: principal.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "conflicts.disclosed",
        subjectType: "conflict_disclosure",
        subjectId: disclosure.value.id,
        summary: "Conflict disclosure recorded on claim.",
        privatePayload: {
          disclosureId: disclosure.value.id,
          claimId: claim.value.id,
          topicId: topic.value.id,
          capability: "conflicts.disclose_own",
          actorAccountId: principal.accountId,
          disclosureChoice: parsed.data.disclosureChoice,
          attachedTo: "claim",
        },
        synthetic: principal.synthetic,
      });

      return {
        ok: true as const,
        value: {
          claim: claim.value,
          evidence: evidence.value,
          relationship: parsed.data.relationship,
          disclosureId: disclosure.value.id,
        },
      };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "TOPIC_NOT_FOUND") {
      return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
    }
    if (message === "TOPIC_NOT_OPEN_FOR_SUBMISSIONS") {
      return {
        ok: false,
        error: "Topic is not open for submissions",
        code: "TOPIC_NOT_OPEN_FOR_SUBMISSIONS",
      };
    }
    return {
      ok: false,
      error: "Submission failed",
      code: "SUBMISSION_FAILED",
    };
  }
}

/**
 * Subject-specific claim resubmit: changes_requested → submitted.
 * Does not mutate linked evidence (3.7 independence).
 */
export async function resubmitOwnClaim(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    expectedWorkflowState: SubmissionWorkflowState;
  },
): Promise<AdapterResult<{ claim: ClaimRecord }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await requirePrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "claims.submit",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const claim = await getClaimById(tx, input.claimId);
      if (!claim.ok || !claim.value) throw new Error("CLAIM_NOT_FOUND");
      if (claim.value.authorAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (claim.value.workflowState !== "changes_requested") {
        throw new Error("SUBMISSION_NOT_RESUBMITTABLE");
      }
      if (claim.value.workflowState !== input.expectedWorkflowState) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      const topic = await getTopicById(tx, claim.value.topicId);
      if (!topic.ok || !topic.value) throw new Error("TOPIC_NOT_FOUND");
      if (topic.value.workflowState !== "open_for_submissions") {
        throw new Error("TOPIC_NOT_OPEN_FOR_SUBMISSIONS");
      }

      const nextClaim = await updateClaimWorkflow(tx, {
        claimId: claim.value.id,
        expectedWorkflowState: "changes_requested",
        nextWorkflowState: "submitted",
      });
      if (!nextClaim.ok || !nextClaim.value) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "claims.resubmitted",
        subjectType: "claim",
        subjectId: nextClaim.value.id,
        summary: "Claim resubmitted after changes requested.",
        privatePayload: {
          claimId: nextClaim.value.id,
          topicId: nextClaim.value.topicId,
          capability: "claims.submit",
          previousWorkflowState: "changes_requested",
          nextWorkflowState: "submitted",
          actorAccountId: principal.accountId,
        },
        synthetic: principal.synthetic,
      });

      return { ok: true as const, value: { claim: nextClaim.value } };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "CLAIM_NOT_FOUND" || message === "SUBMISSION_NOT_OWNED") {
      return { ok: false, error: "Submission not found", code: "CLAIM_NOT_FOUND" };
    }
    if (message === "SUBMISSION_NOT_RESUBMITTABLE") {
      return {
        ok: false,
        error: "Only changes_requested claims can be resubmitted",
        code: "SUBMISSION_NOT_RESUBMITTABLE",
      };
    }
    if (message === "TOPIC_NOT_OPEN_FOR_SUBMISSIONS") {
      return {
        ok: false,
        error: "Topic is not open for submissions",
        code: "TOPIC_NOT_OPEN_FOR_SUBMISSIONS",
      };
    }
    if (message === "SUBMISSION_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Claim changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Resubmit failed",
      code: "SUBMISSION_RESUBMIT_FAILED",
    };
  }
}

/**
 * Subject-specific evidence resubmit: changes_requested → submitted.
 * Does not mutate linked claims (3.7 independence).
 */
export async function resubmitOwnEvidence(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    expectedWorkflowState: SubmissionWorkflowState;
  },
): Promise<AdapterResult<{ evidence: EvidenceSubmissionRecord }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await requirePrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "evidence.submit",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const evidence = await getEvidenceSubmissionById(
        tx,
        input.evidenceSubmissionId,
      );
      if (!evidence.ok || !evidence.value) throw new Error("EVIDENCE_NOT_FOUND");
      if (evidence.value.submitterAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (evidence.value.workflowState !== "changes_requested") {
        throw new Error("SUBMISSION_NOT_RESUBMITTABLE");
      }
      if (evidence.value.workflowState !== input.expectedWorkflowState) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      const topic = await getTopicById(tx, evidence.value.topicId);
      if (!topic.ok || !topic.value) throw new Error("TOPIC_NOT_FOUND");
      if (topic.value.workflowState !== "open_for_submissions") {
        throw new Error("TOPIC_NOT_OPEN_FOR_SUBMISSIONS");
      }

      const nextEvidence = await updateEvidenceWorkflow(tx, {
        evidenceSubmissionId: evidence.value.id,
        expectedWorkflowState: "changes_requested",
        nextWorkflowState: "submitted",
      });
      if (!nextEvidence.ok || !nextEvidence.value) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "evidence.resubmitted",
        subjectType: "evidence_submission",
        subjectId: nextEvidence.value.id,
        summary: "Evidence resubmitted after changes requested.",
        privatePayload: {
          evidenceSubmissionId: nextEvidence.value.id,
          topicId: nextEvidence.value.topicId,
          capability: "evidence.submit",
          previousWorkflowState: "changes_requested",
          nextWorkflowState: "submitted",
          actorAccountId: principal.accountId,
        },
        synthetic: principal.synthetic,
      });

      return { ok: true as const, value: { evidence: nextEvidence.value } };
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
    if (message === "SUBMISSION_NOT_RESUBMITTABLE") {
      return {
        ok: false,
        error: "Only changes_requested evidence can be resubmitted",
        code: "SUBMISSION_NOT_RESUBMITTABLE",
      };
    }
    if (message === "TOPIC_NOT_OPEN_FOR_SUBMISSIONS") {
      return {
        ok: false,
        error: "Topic is not open for submissions",
        code: "TOPIC_NOT_OPEN_FOR_SUBMISSIONS",
      };
    }
    if (message === "SUBMISSION_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Evidence changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Resubmit failed",
      code: "SUBMISSION_RESUBMIT_FAILED",
    };
  }
}

const withdrawableStates: SubmissionWorkflowState[] = [
  "draft",
  "submitted",
  "changes_requested",
];

/**
 * Withdraw own claim only. Linked evidence and revision history are retained.
 */
export async function withdrawOwnClaim(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    expectedWorkflowState: SubmissionWorkflowState;
    reason?: string;
  },
): Promise<AdapterResult<{ claim: ClaimRecord }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await requirePrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "claims.withdraw_own",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const claim = await getClaimById(tx, input.claimId);
      if (!claim.ok || !claim.value) throw new Error("CLAIM_NOT_FOUND");
      if (claim.value.authorAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (!withdrawableStates.includes(claim.value.workflowState)) {
        throw new Error("SUBMISSION_NOT_WITHDRAWABLE");
      }
      if (claim.value.workflowState !== input.expectedWorkflowState) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      const nextClaim = await updateClaimWorkflow(tx, {
        claimId: claim.value.id,
        expectedWorkflowState: claim.value.workflowState,
        nextWorkflowState: "withdrawn",
      });
      if (!nextClaim.ok || !nextClaim.value) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "claims.withdrawn",
        subjectType: "claim",
        subjectId: nextClaim.value.id,
        summary: "Claim withdrawn; history retained.",
        reason: input.reason?.trim(),
        privatePayload: {
          claimId: nextClaim.value.id,
          topicId: nextClaim.value.topicId,
          capability: "claims.withdraw_own",
          previousWorkflowState: claim.value.workflowState,
          nextWorkflowState: "withdrawn",
          actorAccountId: principal.accountId,
        },
        synthetic: principal.synthetic,
      });

      return { ok: true as const, value: { claim: nextClaim.value } };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "CLAIM_NOT_FOUND" || message === "SUBMISSION_NOT_OWNED") {
      return { ok: false, error: "Submission not found", code: "CLAIM_NOT_FOUND" };
    }
    if (message === "SUBMISSION_NOT_WITHDRAWABLE") {
      return {
        ok: false,
        error: "Claim cannot be withdrawn in its current state",
        code: "SUBMISSION_NOT_WITHDRAWABLE",
      };
    }
    if (message === "SUBMISSION_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Claim changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Withdraw failed",
      code: "SUBMISSION_WITHDRAW_FAILED",
    };
  }
}

/**
 * Withdraw own evidence only. Linked claims, links, and revision history retained.
 */
export async function withdrawOwnEvidence(
  db: GatedDb,
  input: {
    actorAccountId: string;
    evidenceSubmissionId: string;
    expectedWorkflowState: SubmissionWorkflowState;
    reason?: string;
  },
): Promise<AdapterResult<{ evidence: EvidenceSubmissionRecord }>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  try {
    return await db.transaction(async (tx) => {
      const principal = await requirePrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "evidence.withdraw_own",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const evidence = await getEvidenceSubmissionById(
        tx,
        input.evidenceSubmissionId,
      );
      if (!evidence.ok || !evidence.value) throw new Error("EVIDENCE_NOT_FOUND");
      if (evidence.value.submitterAccountId !== principal.accountId) {
        throw new Error("SUBMISSION_NOT_OWNED");
      }
      if (!withdrawableStates.includes(evidence.value.workflowState)) {
        throw new Error("SUBMISSION_NOT_WITHDRAWABLE");
      }
      if (evidence.value.workflowState !== input.expectedWorkflowState) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      const nextEvidence = await updateEvidenceWorkflow(tx, {
        evidenceSubmissionId: evidence.value.id,
        expectedWorkflowState: evidence.value.workflowState,
        nextWorkflowState: "withdrawn",
      });
      if (!nextEvidence.ok || !nextEvidence.value) {
        throw new Error("SUBMISSION_STATE_CONFLICT");
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: principal.accountId,
        action: "evidence.withdrawn",
        subjectType: "evidence_submission",
        subjectId: nextEvidence.value.id,
        summary: "Evidence withdrawn; history retained.",
        reason: input.reason?.trim(),
        privatePayload: {
          evidenceSubmissionId: nextEvidence.value.id,
          topicId: nextEvidence.value.topicId,
          capability: "evidence.withdraw_own",
          previousWorkflowState: evidence.value.workflowState,
          nextWorkflowState: "withdrawn",
          actorAccountId: principal.accountId,
        },
        synthetic: principal.synthetic,
      });

      return { ok: true as const, value: { evidence: nextEvidence.value } };
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
    if (message === "SUBMISSION_NOT_WITHDRAWABLE") {
      return {
        ok: false,
        error: "Evidence cannot be withdrawn in its current state",
        code: "SUBMISSION_NOT_WITHDRAWABLE",
      };
    }
    if (message === "SUBMISSION_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Evidence changed; reload and retry",
        code: "SUBMISSION_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Withdraw failed",
      code: "SUBMISSION_WITHDRAW_FAILED",
    };
  }
}

/** @deprecated Prefer subject-specific updateOwnClaimContent / updateOwnEvidenceContent. */
export async function updateOwnSubmission(
  db: GatedDb,
  input: {
    actorAccountId: string;
    claimId: string;
    evidenceSubmissionId: string;
    expectedClaimUpdatedAt: string;
    expectedEvidenceUpdatedAt: string;
    claimTitle: string;
    claimSummary: string;
    approachLabel: string;
    sourceUrl: string;
    evidenceTitle: string;
    organization: string;
    authorType: z.infer<typeof authorTypeSchema>;
    sourceType: z.infer<typeof sourceTypeSchema>;
    limitations: string;
  },
): Promise<
  AdapterResult<{
    claim: ClaimRecord;
    evidence: EvidenceSubmissionRecord;
  }>
> {
  if (!input.evidenceSubmissionId?.trim()) {
    return {
      ok: false,
      error: "evidenceSubmissionId is required",
      code: "SUBMISSION_INPUT_INVALID",
    };
  }

  const claimResult = await updateOwnClaimContent(db, {
    actorAccountId: input.actorAccountId,
    claimId: input.claimId,
    expectedUpdatedAt: input.expectedClaimUpdatedAt,
    title: input.claimTitle,
    summary: input.claimSummary,
    approachLabel: input.approachLabel,
  });
  if (!claimResult.ok) return claimResult;

  const evidenceResult = await updateOwnEvidenceContent(db, {
    actorAccountId: input.actorAccountId,
    evidenceSubmissionId: input.evidenceSubmissionId,
    expectedUpdatedAt: input.expectedEvidenceUpdatedAt,
    sourceUrl: input.sourceUrl,
    title: input.evidenceTitle,
    organization: input.organization,
    authorType: input.authorType,
    sourceType: input.sourceType,
    limitations: input.limitations,
  });
  if (!evidenceResult.ok) return evidenceResult;

  return {
    ok: true,
    value: {
      claim: claimResult.value.claim,
      evidence: evidenceResult.value.evidence,
    },
  };
}

/** List claims authored by the principal (own submissions only). */
export async function listOwnClaimsForTopic(
  db: GatedDb,
  input: { actorAccountId: string; topicId: string },
): Promise<AdapterResult<ClaimRecord[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const principal = await requirePrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "claims.submit",
  );
  if (!decision.ok) return authzFail(decision);

  const listed = await listClaims(db, { topicId: input.topicId });
  if (!listed.ok) return listed;
  return {
    ok: true,
    value: listed.value.filter(
      (row) => row.authorAccountId === principal.accountId,
    ),
  };
}
