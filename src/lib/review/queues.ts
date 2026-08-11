import { and, asc, eq } from "drizzle-orm";

import { accounts, claims, evidenceSubmissions, persons, topics } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  getClaimById,
  listClaimEvidenceLinks,
  listClaimReviews,
  type SubmissionWorkflowState,
} from "@/lib/claims/repository";
import { listConflictDisclosuresForClaim } from "@/lib/conflicts/repository";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  getEvidenceSubmissionById,
  listEvidenceReviews,
  type EvidenceQualityStatus,
} from "@/lib/evidence/repository";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

export type ClaimQueueItem = {
  claimId: string;
  topicId: string;
  topicSlug: string;
  topicTitle: string;
  title: string;
  summary: string;
  approachLabel: string;
  workflowState: SubmissionWorkflowState;
  moderationVisibility: string;
  submittedAt: string;
  submitterDisplayLabel: string;
  conflictPublicSummary: string | null;
};

export type EvidenceQueueItem = {
  evidenceSubmissionId: string;
  topicId: string;
  topicSlug: string;
  topicTitle: string;
  title: string;
  organization: string;
  sourceUrl: string;
  authorType: string;
  sourceType: string;
  limitations: string;
  workflowState: SubmissionWorkflowState;
  qualityStatus: EvidenceQualityStatus;
  moderationVisibility: string;
  submittedAt: string;
  submitterDisplayLabel: string;
};

export type ClaimReviewDetail = {
  claim: ClaimQueueItem;
  topic: {
    slug: string;
    title: string;
    question: string;
    background: string;
    scope: string;
    workflowState: string;
    publicationStatus: string;
  };
  links: Array<{
    evidenceSubmissionId: string;
    relationship: "supporting" | "counterevidence";
    evidenceTitle: string;
    organization: string;
    authorType: string;
    sourceType: string;
    limitations: string;
    qualityStatus: string;
    workflowState: string;
    sourceUrl: string;
  }>;
  reviews: Array<{
    id: string;
    decision: string;
    publicRationale: string;
    privateNotes: string | null;
    decidedAt: string;
  }>;
};

export type EvidenceReviewDetail = {
  evidence: EvidenceQueueItem;
  topic: {
    slug: string;
    title: string;
    question: string;
    background: string;
    scope: string;
    workflowState: string;
    publicationStatus: string;
  };
  linkedClaims: Array<{
    claimId: string;
    title: string;
    relationship: "supporting" | "counterevidence";
  }>;
  reviews: Array<{
    id: string;
    decision: string;
    qualityStatus: string | null;
    workflowDecision: string | null;
    publicRationale: string;
    privateNotes: string | null;
    decidedAt: string;
  }>;
};

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Review queues unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_REVIEW",
    };
  }
  return null;
}

export async function listClaimReviewQueue(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId?: string;
    workflowState?: SubmissionWorkflowState;
  },
): Promise<AdapterResult<ClaimQueueItem[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(db, principal, "claims.review");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const workflowState = input.workflowState ?? "submitted";
  const conditions = [eq(claims.workflowState, workflowState)];
  if (input.topicId) {
    conditions.push(eq(claims.topicId, input.topicId));
  }

  const rows = await db
    .select({
      claimId: claims.id,
      topicId: claims.topicId,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      title: claims.title,
      summary: claims.summary,
      approachLabel: claims.approachLabel,
      workflowState: claims.workflowState,
      moderationVisibility: claims.moderationVisibility,
      submittedAt: claims.createdAt,
      submitterDisplayLabel: persons.displayLabel,
    })
    .from(claims)
    .innerJoin(topics, eq(topics.id, claims.topicId))
    .innerJoin(accounts, eq(accounts.id, claims.authorAccountId))
    .innerJoin(persons, eq(persons.id, accounts.personId))
    .where(and(...conditions))
    .orderBy(asc(claims.createdAt), asc(claims.id));

  const items: ClaimQueueItem[] = [];
  for (const row of rows) {
    const disclosures = await listConflictDisclosuresForClaim(db, row.claimId);
    items.push({
      claimId: row.claimId,
      topicId: row.topicId,
      topicSlug: row.topicSlug,
      topicTitle: row.topicTitle,
      title: row.title,
      summary: row.summary,
      approachLabel: row.approachLabel,
      workflowState: row.workflowState as SubmissionWorkflowState,
      moderationVisibility: row.moderationVisibility,
      submittedAt: row.submittedAt.toISOString(),
      submitterDisplayLabel: row.submitterDisplayLabel,
      conflictPublicSummary: disclosures.ok
        ? (disclosures.value[0]?.publicSummary ?? null)
        : null,
    });
  }

  return { ok: true, value: items };
}

export async function listEvidenceReviewQueue(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId?: string;
    workflowState?: SubmissionWorkflowState;
    qualityStatus?: EvidenceQualityStatus;
  },
): Promise<AdapterResult<EvidenceQueueItem[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(db, principal, "evidence.review");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const workflowState = input.workflowState ?? "submitted";
  const conditions = [eq(evidenceSubmissions.workflowState, workflowState)];
  if (input.topicId) {
    conditions.push(eq(evidenceSubmissions.topicId, input.topicId));
  }
  if (input.qualityStatus) {
    conditions.push(eq(evidenceSubmissions.qualityStatus, input.qualityStatus));
  }

  const rows = await db
    .select({
      evidenceSubmissionId: evidenceSubmissions.id,
      topicId: evidenceSubmissions.topicId,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      title: evidenceSubmissions.title,
      organization: evidenceSubmissions.organization,
      sourceUrl: evidenceSubmissions.sourceUrl,
      authorType: evidenceSubmissions.authorType,
      sourceType: evidenceSubmissions.sourceType,
      limitations: evidenceSubmissions.limitations,
      workflowState: evidenceSubmissions.workflowState,
      qualityStatus: evidenceSubmissions.qualityStatus,
      moderationVisibility: evidenceSubmissions.moderationVisibility,
      submittedAt: evidenceSubmissions.createdAt,
      submitterDisplayLabel: persons.displayLabel,
    })
    .from(evidenceSubmissions)
    .innerJoin(topics, eq(topics.id, evidenceSubmissions.topicId))
    .innerJoin(accounts, eq(accounts.id, evidenceSubmissions.submitterAccountId))
    .innerJoin(persons, eq(persons.id, accounts.personId))
    .where(and(...conditions))
    .orderBy(asc(evidenceSubmissions.createdAt), asc(evidenceSubmissions.id));

  return {
    ok: true,
    value: rows.map((row) => ({
      evidenceSubmissionId: row.evidenceSubmissionId,
      topicId: row.topicId,
      topicSlug: row.topicSlug,
      topicTitle: row.topicTitle,
      title: row.title,
      organization: row.organization,
      sourceUrl: row.sourceUrl,
      authorType: row.authorType,
      sourceType: row.sourceType,
      limitations: row.limitations,
      workflowState: row.workflowState as SubmissionWorkflowState,
      qualityStatus: row.qualityStatus as EvidenceQualityStatus,
      moderationVisibility: row.moderationVisibility,
      submittedAt: row.submittedAt.toISOString(),
      submitterDisplayLabel: row.submitterDisplayLabel,
    })),
  };
}

export async function getClaimReviewDetail(
  db: GatedDb,
  input: { actorAccountId: string; claimId: string },
): Promise<AdapterResult<ClaimReviewDetail>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(db, principal, "claims.review");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const claim = await getClaimById(db, input.claimId);
  if (!claim.ok || !claim.value) {
    return { ok: false, error: "Claim not found", code: "CLAIM_NOT_FOUND" };
  }
  const topic = await getTopicById(db, claim.value.topicId);
  if (!topic.ok || !topic.value) {
    return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
  }

  const [personRow] = await db
    .select({ displayLabel: persons.displayLabel })
    .from(accounts)
    .innerJoin(persons, eq(persons.id, accounts.personId))
    .where(eq(accounts.id, claim.value.authorAccountId))
    .limit(1);

  const disclosures = await listConflictDisclosuresForClaim(db, claim.value.id);
  const links = await listClaimEvidenceLinks(db, { claimId: claim.value.id });
  const reviews = await listClaimReviews(db, claim.value.id);

  const linkRows = [];
  for (const link of links.ok ? links.value : []) {
    const evidence = await getEvidenceSubmissionById(
      db,
      link.evidenceSubmissionId,
    );
    if (!evidence.ok || !evidence.value) continue;
    linkRows.push({
      evidenceSubmissionId: evidence.value.id,
      relationship: link.relationship,
      evidenceTitle: evidence.value.title,
      organization: evidence.value.organization,
      authorType: evidence.value.authorType,
      sourceType: evidence.value.sourceType,
      limitations: evidence.value.limitations,
      qualityStatus: evidence.value.qualityStatus,
      workflowState: evidence.value.workflowState,
      sourceUrl: evidence.value.sourceUrl,
    });
  }

  return {
    ok: true,
    value: {
      claim: {
        claimId: claim.value.id,
        topicId: claim.value.topicId,
        topicSlug: topic.value.slug,
        topicTitle: topic.value.title,
        title: claim.value.title,
        summary: claim.value.summary,
        approachLabel: claim.value.approachLabel,
        workflowState: claim.value.workflowState,
        moderationVisibility: claim.value.moderationVisibility,
        submittedAt: claim.value.createdAt.toISOString(),
        submitterDisplayLabel: personRow?.displayLabel ?? "Community participant",
        conflictPublicSummary: disclosures.ok
          ? (disclosures.value[0]?.publicSummary ?? null)
          : null,
      },
      topic: {
        slug: topic.value.slug,
        title: topic.value.title,
        question: topic.value.question,
        background: topic.value.background,
        scope: topic.value.scope,
        workflowState: topic.value.workflowState,
        publicationStatus: topic.value.publicationStatus,
      },
      links: linkRows,
      reviews: (reviews.ok ? reviews.value : [])
        .slice()
        .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
        .map((row) => ({
          id: row.id,
          decision: row.decision,
          publicRationale: row.publicRationale,
          privateNotes: row.privateNotes,
          decidedAt: row.decidedAt.toISOString(),
        })),
    },
  };
}

export async function getEvidenceReviewDetail(
  db: GatedDb,
  input: { actorAccountId: string; evidenceSubmissionId: string },
): Promise<AdapterResult<EvidenceReviewDetail>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(db, principal, "evidence.review");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const evidence = await getEvidenceSubmissionById(
    db,
    input.evidenceSubmissionId,
  );
  if (!evidence.ok || !evidence.value) {
    return {
      ok: false,
      error: "Evidence submission not found",
      code: "EVIDENCE_NOT_FOUND",
    };
  }
  const topic = await getTopicById(db, evidence.value.topicId);
  if (!topic.ok || !topic.value) {
    return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
  }

  const [personRow] = await db
    .select({ displayLabel: persons.displayLabel })
    .from(accounts)
    .innerJoin(persons, eq(persons.id, accounts.personId))
    .where(eq(accounts.id, evidence.value.submitterAccountId))
    .limit(1);

  const links = await listClaimEvidenceLinks(db, {
    evidenceSubmissionId: evidence.value.id,
  });
  const reviews = await listEvidenceReviews(db, evidence.value.id);

  const linkedClaims = [];
  for (const link of links.ok ? links.value : []) {
    const claim = await getClaimById(db, link.claimId);
    if (!claim.ok || !claim.value) continue;
    linkedClaims.push({
      claimId: claim.value.id,
      title: claim.value.title,
      relationship: link.relationship,
    });
  }

  return {
    ok: true,
    value: {
      evidence: {
        evidenceSubmissionId: evidence.value.id,
        topicId: evidence.value.topicId,
        topicSlug: topic.value.slug,
        topicTitle: topic.value.title,
        title: evidence.value.title,
        organization: evidence.value.organization,
        sourceUrl: evidence.value.sourceUrl,
        authorType: evidence.value.authorType,
        sourceType: evidence.value.sourceType,
        limitations: evidence.value.limitations,
        workflowState: evidence.value.workflowState,
        qualityStatus: evidence.value.qualityStatus,
        moderationVisibility: evidence.value.moderationVisibility,
        submittedAt: evidence.value.createdAt.toISOString(),
        submitterDisplayLabel:
          personRow?.displayLabel ?? "Community participant",
      },
      topic: {
        slug: topic.value.slug,
        title: topic.value.title,
        question: topic.value.question,
        background: topic.value.background,
        scope: topic.value.scope,
        workflowState: topic.value.workflowState,
        publicationStatus: topic.value.publicationStatus,
      },
      linkedClaims,
      reviews: (reviews.ok ? reviews.value : [])
        .slice()
        .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
        .map((row) => ({
          id: row.id,
          decision: row.decision,
          qualityStatus: row.qualityStatus,
          workflowDecision: row.workflowDecision,
          publicRationale: row.publicRationale,
          privateNotes: row.privateNotes,
          decidedAt: row.decidedAt.toISOString(),
        })),
    },
  };
}
