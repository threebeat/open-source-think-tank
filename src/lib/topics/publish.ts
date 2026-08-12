import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  listClaimEvidenceLinks,
  listClaimReviews,
  listClaims,
  type ClaimRecord,
  type ClaimReviewRecord,
} from "@/lib/claims/repository";
import { listConflictDisclosuresForClaim } from "@/lib/conflicts/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  listEvidenceReviews,
  listEvidenceSubmissions,
  type EvidenceReviewRecord,
  type EvidenceSubmissionRecord,
} from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import { toPublicRevisionSummary } from "@/lib/revisions/history";
import { countContentRevisionsForSubjects } from "@/lib/revisions/repository";
import type { PublicRevisionSummaryProjection } from "@/lib/topics/public-projection";
import {
  getTopicById,
  type TopicRecord,
  updateTopicPublication,
} from "@/lib/topics/repository";

export type PublishReadinessBlocker = {
  code: string;
  message: string;
};

export type PublishReadinessResult = {
  ready: boolean;
  blockers: PublishReadinessBlocker[];
  acceptedVisibleClaimIds: string[];
  linkedAcceptedVisibleEvidenceIds: string[];
};

const publishInputSchema = z.object({
  topicId: z.string().min(1),
  expectedPublicationStatus: z.literal("unpublished"),
});

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Topic publication unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PUBLISH",
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

function latestWorkflowRationale(
  reviews: ClaimReviewRecord[] | EvidenceReviewRecord[],
  decision: "accepted" | "changes_requested" | "rejected",
): string | null {
  const matching = [...reviews]
    .filter((row) => row.decision === decision)
    .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
  const rationale = matching[0]?.publicRationale?.trim();
  return rationale && rationale.length > 0 ? rationale : null;
}

function latestQualityRationale(
  reviews: EvidenceReviewRecord[],
): string | null {
  const matching = [...reviews]
    .filter((row) => row.decision === "quality_decided")
    .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
  const rationale = matching[0]?.publicRationale?.trim();
  return rationale && rationale.length > 0 ? rationale : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Deterministic publish-readiness check. Organizes already-recorded human
 * decisions; it is not an automatic institutional judgment.
 */
export async function evaluatePublishReadiness(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<PublishReadinessResult>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const topic = await getTopicById(db, topicId);
  if (!topic.ok) return topic;
  if (!topic.value) {
    return {
      ok: false,
      error: "Topic not found",
      code: "TOPIC_NOT_FOUND",
    };
  }

  return {
    ok: true,
    value: await computeReadiness(db, topic.value),
  };
}

async function computeReadiness(
  db: GatedDb,
  topic: TopicRecord,
): Promise<PublishReadinessResult> {
  const blockers: PublishReadinessBlocker[] = [];

  if (topic.publicationStatus !== "unpublished") {
    blockers.push({
      code: "ALREADY_PUBLISHED",
      message: "Topic is already published.",
    });
  }
  if (topic.workflowState !== "under_review") {
    blockers.push({
      code: "WORKFLOW_NOT_UNDER_REVIEW",
      message:
        "Operational workflow must be under review before initial publication.",
    });
  }

  const claimsResult = await listClaims(db, { topicId: topic.id });
  const evidenceResult = await listEvidenceSubmissions(db, {
    topicId: topic.id,
  });
  const linksResult = await listClaimEvidenceLinks(db, { topicId: topic.id });

  const claims = claimsResult.ok ? claimsResult.value : [];
  const evidence = evidenceResult.ok ? evidenceResult.value : [];
  const links = linksResult.ok ? linksResult.value : [];
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));

  const publishableClaims: ClaimRecord[] = [];
  const publishableEvidenceIds = new Set<string>();

  for (const claim of claims) {
    if (
      claim.workflowState !== "accepted" ||
      claim.moderationVisibility !== "visible"
    ) {
      continue;
    }
    const reviews = await listClaimReviews(db, claim.id);
    const rationale = reviews.ok
      ? latestWorkflowRationale(reviews.value, "accepted")
      : null;
    if (!rationale) {
      blockers.push({
        code: "CLAIM_MISSING_PUBLIC_RATIONALE",
        message:
          "An accepted visible claim is missing a public workflow rationale.",
      });
      continue;
    }

    const claimLinks = links.filter(
      (link) => link.claimId === claim.id && link.topicId === topic.id,
    );
    let linkedOk = false;
    for (const link of claimLinks) {
      const row = evidenceById.get(link.evidenceSubmissionId);
      if (!row) continue;
      if (
        row.workflowState !== "accepted" ||
        row.moderationVisibility !== "visible"
      ) {
        continue;
      }
      if (row.qualityStatus === "pending") {
        blockers.push({
          code: "EVIDENCE_QUALITY_PENDING",
          message:
            "Linked evidence still has pending quality and cannot be published.",
        });
        continue;
      }
      const evidenceReviews = await listEvidenceReviews(db, row.id);
      const workflowRationale = evidenceReviews.ok
        ? latestWorkflowRationale(evidenceReviews.value, "accepted")
        : null;
      const qualityRationale = evidenceReviews.ok
        ? latestQualityRationale(evidenceReviews.value)
        : null;
      if (!workflowRationale) {
        blockers.push({
          code: "EVIDENCE_MISSING_WORKFLOW_RATIONALE",
          message:
            "Linked accepted evidence is missing a public workflow rationale.",
        });
        continue;
      }
      if (!qualityRationale) {
        blockers.push({
          code: "EVIDENCE_MISSING_QUALITY_RATIONALE",
          message:
            "Linked evidence is missing a public quality rationale.",
        });
        continue;
      }
      if (!isHttpUrl(row.sourceUrl)) {
        blockers.push({
          code: "EVIDENCE_URL_INVALID",
          message:
            "Linked evidence source URL is not a valid http(s) URL.",
        });
        continue;
      }
      publishableEvidenceIds.add(row.id);
      linkedOk = true;
    }

    if (!linkedOk) {
      continue;
    }
    publishableClaims.push(claim);
  }

  if (publishableClaims.length === 0) {
    blockers.push({
      code: "NO_PUBLISHABLE_CLAIM",
      message:
        "Need at least one accepted, visible claim with public rationale and linked accepted visible evidence.",
    });
  }
  if (publishableEvidenceIds.size === 0) {
    blockers.push({
      code: "NO_PUBLISHABLE_EVIDENCE",
      message:
        "Need at least one accepted, visible evidence source with non-pending quality and public rationales, linked to a publishable claim.",
    });
  }

  // Deduplicate blockers by code+message for stable UI.
  const seen = new Set<string>();
  const uniqueBlockers = blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ready =
    uniqueBlockers.length === 0 &&
    publishableClaims.length > 0 &&
    publishableEvidenceIds.size > 0;

  return {
    ready,
    blockers: uniqueBlockers,
    acceptedVisibleClaimIds: publishableClaims.map((row) => row.id),
    linkedAcceptedVisibleEvidenceIds: [...publishableEvidenceIds],
  };
}

/**
 * Administrator publish: unpublished → published with provenance.
 * Preserves topic operational workflow exactly.
 */
export async function publishTopic(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId: string;
    expectedPublicationStatus: "unpublished";
  },
): Promise<AdapterResult<TopicRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = publishInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid publish input",
      code: "TOPIC_PUBLISH_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "topics.publish",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const topic = await getTopicById(tx, parsed.data.topicId);
      if (!topic.ok || !topic.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }
      if (topic.value.publicationStatus !== "unpublished") {
        throw new Error("TOPIC_PUBLICATION_CONFLICT");
      }

      const readiness = await computeReadiness(tx, topic.value);
      if (!readiness.ready) {
        throw Object.assign(new Error("TOPIC_NOT_READY"), { readiness });
      }

      const publishedAt = new Date();
      const priorWorkflow = topic.value.workflowState;
      const updated = await updateTopicPublication(tx, {
        topicId: topic.value.id,
        expectedPublicationStatus: "unpublished",
        nextPublicationStatus: "published",
        publishedAt,
        publishedByAccountId: decision.principal.accountId,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("TOPIC_PUBLICATION_CONFLICT");
      }
      if (updated.value.workflowState !== priorWorkflow) {
        throw new Error("TOPIC_WORKFLOW_SIDE_EFFECT");
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "topics.published",
        subjectType: "topic",
        subjectId: topic.value.id,
        summary: "Topic published for gated visitor projection.",
        privatePayload: {
          topicId: topic.value.id,
          capability: "topics.publish",
          previousPublicationStatus: "unpublished",
          nextPublicationStatus: "published",
          unchangedWorkflowState: priorWorkflow,
          actorAccountId: decision.principal.accountId,
          readinessSummary: {
            acceptedVisibleClaimCount:
              readiness.acceptedVisibleClaimIds.length,
            linkedAcceptedVisibleEvidenceCount:
              readiness.linkedAcceptedVisibleEvidenceIds.length,
            includedClaimIds: readiness.acceptedVisibleClaimIds,
            includedEvidenceIds: readiness.linkedAcceptedVisibleEvidenceIds,
          },
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    const authz = mapThrownAuthz(error);
    if (authz) return authz;
    const message = error instanceof Error ? error.message : "";
    if (message === "TOPIC_NOT_FOUND") {
      return {
        ok: false,
        error: "Topic not found",
        code: "TOPIC_NOT_FOUND",
      };
    }
    if (message === "TOPIC_PUBLICATION_CONFLICT") {
      return {
        ok: false,
        error: "Publication status changed; reload and retry",
        code: "TOPIC_PUBLICATION_CONFLICT",
      };
    }
    if (message === "TOPIC_NOT_READY") {
      const readiness = (
        error as { readiness?: PublishReadinessResult }
      ).readiness;
      return {
        ok: false,
        error: readiness?.blockers[0]?.message ?? "Topic is not ready to publish",
        code: "TOPIC_NOT_READY",
      };
    }
    return {
      ok: false,
      error: "Topic publication failed",
      code: "TOPIC_PUBLISH_FAILED",
    };
  }
}

/** Helpers for gated public-read assembly (also used by tests). */
export async function loadProjectionInputs(
  db: GatedDb,
  topic: TopicRecord,
): Promise<{
  claims: Array<
    ClaimRecord & {
      workflowPublicRationale: string | null;
      conflictPublicSummary: string | null;
      revisionSummary: PublicRevisionSummaryProjection | null;
    }
  >;
  evidence: Array<
    EvidenceSubmissionRecord & {
      qualityPublicRationale: string | null;
      workflowPublicRationale: string | null;
      revisionSummary: PublicRevisionSummaryProjection | null;
    }
  >;
  links: Awaited<ReturnType<typeof listClaimEvidenceLinks>>;
}> {
  const claimsResult = await listClaims(db, { topicId: topic.id });
  const evidenceResult = await listEvidenceSubmissions(db, {
    topicId: topic.id,
  });
  const links = await listClaimEvidenceLinks(db, { topicId: topic.id });

  const claimRows = claimsResult.ok ? claimsResult.value : [];
  const evidenceRows = evidenceResult.ok ? evidenceResult.value : [];

  const revisionCounts = await countContentRevisionsForSubjects(db, {
    claimIds: claimRows.map((row) => row.id),
    evidenceSubmissionIds: evidenceRows.map((row) => row.id),
  });
  const claimRevisionMap = revisionCounts.ok
    ? revisionCounts.value.byClaimId
    : new Map();
  const evidenceRevisionMap = revisionCounts.ok
    ? revisionCounts.value.byEvidenceId
    : new Map();

  const claims = [];
  for (const claim of claimRows) {
    const reviews = await listClaimReviews(db, claim.id);
    const disclosures = await listConflictDisclosuresForClaim(db, claim.id);
    const rev = claimRevisionMap.get(claim.id);
    claims.push({
      ...claim,
      workflowPublicRationale: reviews.ok
        ? latestWorkflowRationale(reviews.value, "accepted")
        : null,
      conflictPublicSummary: disclosures.ok
        ? (disclosures.value[0]?.publicSummary ?? null)
        : null,
      revisionSummary: rev
        ? toPublicRevisionSummary({
            count: rev.count,
            latestAt: rev.latestAt,
            changedFields: rev.changedFieldUnion,
          })
        : null,
    });
  }

  const evidence = [];
  for (const row of evidenceRows) {
    const reviews = await listEvidenceReviews(db, row.id);
    const rev = evidenceRevisionMap.get(row.id);
    evidence.push({
      ...row,
      qualityPublicRationale: reviews.ok
        ? latestQualityRationale(reviews.value)
        : null,
      workflowPublicRationale: reviews.ok
        ? latestWorkflowRationale(reviews.value, "accepted")
        : null,
      revisionSummary: rev
        ? toPublicRevisionSummary({
            count: rev.count,
            latestAt: rev.latestAt,
            changedFields: rev.changedFieldUnion,
          })
        : null,
    });
  }

  return { claims, evidence, links };
}
