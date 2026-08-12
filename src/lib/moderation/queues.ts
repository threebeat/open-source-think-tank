import { asc, desc, eq, ne } from "drizzle-orm";

import {
  accounts,
  claims,
  evidenceSubmissions,
  persons,
  topics,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import {
  getClaimById,
  type SubmissionWorkflowState,
} from "@/lib/claims/repository";
import {
  getConflictDisclosureForClaim,
  getConflictDisclosureForEvidence,
} from "@/lib/conflicts/repository";
import {
  toOwnerOrReviewerConflictDisclosure,
  toPublicSummaryConflictDisclosure,
  type OwnerOrReviewerConflictDisclosure,
  type PublicSummaryConflictDisclosure,
} from "@/lib/conflicts/audiences";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  getEvidenceSubmissionById,
  type EvidenceQualityStatus,
} from "@/lib/evidence/repository";
import {
  listModerationActionsForClaim,
  listModerationActionsForEvidence,
  toStaffModerationActionDto,
  type StaffModerationActionDto,
} from "@/lib/moderation/repository";
import type { ModerationVisibility } from "@/lib/moderation/schemas";
import type { GatedDb } from "@/lib/persistence/gated";
import { getTopicById } from "@/lib/topics/repository";

export type ModerationQueueItem = {
  subjectType: "claim" | "evidence";
  subjectId: string;
  topicId: string;
  topicSlug: string;
  topicTitle: string;
  title: string;
  workflowState: SubmissionWorkflowState;
  qualityStatus: EvidenceQualityStatus | null;
  moderationVisibility: ModerationVisibility;
  submitterDisplayLabel: string;
  updatedAt: string;
  latestActionSummary: {
    action: string;
    publicRationale: string;
    createdAt: string;
  } | null;
  conflictPublicSummary: string | null;
};

export type ClaimModerationDetail = {
  subjectType: "claim";
  claim: ModerationQueueItem;
  topic: {
    slug: string;
    title: string;
    question: string;
    workflowState: string;
    publicationStatus: string;
  };
  expectedUpdatedAt: string;
  history: StaffModerationActionDto[];
  conflictDisclosure:
    OwnerOrReviewerConflictDisclosure | PublicSummaryConflictDisclosure | null;
  canSeePrivateDetail: boolean;
};

export type EvidenceModerationDetail = {
  subjectType: "evidence";
  evidence: ModerationQueueItem & {
    sourceUrl: string;
    organization: string;
    limitations: string;
  };
  topic: {
    slug: string;
    title: string;
    question: string;
    workflowState: string;
    publicationStatus: string;
  };
  expectedUpdatedAt: string;
  history: StaffModerationActionDto[];
  conflictDisclosure:
    OwnerOrReviewerConflictDisclosure | PublicSummaryConflictDisclosure | null;
  canSeePrivateDetail: boolean;
};

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Moderation queues unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_MODERATION",
    };
  }
  return null;
}

async function requireModerator(
  db: GatedDb,
  actorAccountId: string,
): Promise<AdapterResult<AuthzPrincipal>> {
  const principal = await loadPrincipal(db, actorAccountId);
  if (!principal) {
    return {
      ok: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    };
  }
  const decision = await authorizeCapability(
    db,
    principal,
    "moderation.review_submission",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }
  return { ok: true, value: decision.principal };
}

async function submitterLabel(db: GatedDb, accountId: string): Promise<string> {
  const [row] = await db
    .select({ displayLabel: persons.displayLabel })
    .from(accounts)
    .innerJoin(persons, eq(persons.id, accounts.personId))
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row?.displayLabel ?? "Community participant";
}

/**
 * Queue of claims and evidence for moderators. Includes currently non-visible
 * rows and recent visible rows with history.
 */
export async function listModerationQueue(
  db: GatedDb,
  input: { actorAccountId: string },
): Promise<AdapterResult<ModerationQueueItem[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const authz = await requireModerator(db, input.actorAccountId);
  if (!authz.ok) return authz;

  const claimRows = await db
    .select({
      id: claims.id,
      topicId: claims.topicId,
      title: claims.title,
      workflowState: claims.workflowState,
      moderationVisibility: claims.moderationVisibility,
      authorAccountId: claims.authorAccountId,
      updatedAt: claims.updatedAt,
      topicSlug: topics.slug,
      topicTitle: topics.title,
    })
    .from(claims)
    .innerJoin(topics, eq(topics.id, claims.topicId))
    .where(ne(claims.workflowState, "draft"))
    .orderBy(desc(claims.updatedAt), asc(claims.id));

  const evidenceRows = await db
    .select({
      id: evidenceSubmissions.id,
      topicId: evidenceSubmissions.topicId,
      title: evidenceSubmissions.title,
      workflowState: evidenceSubmissions.workflowState,
      qualityStatus: evidenceSubmissions.qualityStatus,
      moderationVisibility: evidenceSubmissions.moderationVisibility,
      submitterAccountId: evidenceSubmissions.submitterAccountId,
      updatedAt: evidenceSubmissions.updatedAt,
      topicSlug: topics.slug,
      topicTitle: topics.title,
    })
    .from(evidenceSubmissions)
    .innerJoin(topics, eq(topics.id, evidenceSubmissions.topicId))
    .where(ne(evidenceSubmissions.workflowState, "draft"))
    .orderBy(desc(evidenceSubmissions.updatedAt), asc(evidenceSubmissions.id));

  const items: ModerationQueueItem[] = [];

  for (const row of claimRows) {
    const history = await listModerationActionsForClaim(db, row.id);
    const latest = history.ok ? history.value.at(-1) : null;
    const disclosure = await getConflictDisclosureForClaim(db, row.id);
    items.push({
      subjectType: "claim",
      subjectId: row.id,
      topicId: row.topicId,
      topicSlug: row.topicSlug,
      topicTitle: row.topicTitle,
      title: row.title,
      workflowState: row.workflowState,
      qualityStatus: null,
      moderationVisibility: row.moderationVisibility,
      submitterDisplayLabel: await submitterLabel(db, row.authorAccountId),
      updatedAt: row.updatedAt.toISOString(),
      latestActionSummary: latest
        ? {
            action: latest.action,
            publicRationale: latest.publicRationale,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
      conflictPublicSummary: disclosure.ok
        ? (disclosure.value?.publicSummary ?? null)
        : null,
    });
  }

  for (const row of evidenceRows) {
    const history = await listModerationActionsForEvidence(db, row.id);
    const latest = history.ok ? history.value.at(-1) : null;
    const disclosure = await getConflictDisclosureForEvidence(db, row.id);
    items.push({
      subjectType: "evidence",
      subjectId: row.id,
      topicId: row.topicId,
      topicSlug: row.topicSlug,
      topicTitle: row.topicTitle,
      title: row.title,
      workflowState: row.workflowState,
      qualityStatus: row.qualityStatus,
      moderationVisibility: row.moderationVisibility,
      submitterDisplayLabel: await submitterLabel(db, row.submitterAccountId),
      updatedAt: row.updatedAt.toISOString(),
      latestActionSummary: latest
        ? {
            action: latest.action,
            publicRationale: latest.publicRationale,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
      conflictPublicSummary: disclosure.ok
        ? (disclosure.value?.publicSummary ?? null)
        : null,
    });
  }

  items.sort((a, b) => {
    if (a.moderationVisibility !== b.moderationVisibility) {
      const rank = { held: 0, hidden: 1, visible: 2 } as const;
      return rank[a.moderationVisibility] - rank[b.moderationVisibility];
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return { ok: true, value: items };
}

export async function getClaimModerationDetail(
  db: GatedDb,
  input: { actorAccountId: string; claimId: string },
): Promise<AdapterResult<ClaimModerationDetail>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const authz = await requireModerator(db, input.actorAccountId);
  if (!authz.ok) return authz;

  const claim = await getClaimById(db, input.claimId);
  if (!claim.ok || !claim.value) {
    return { ok: false, error: "Claim not found", code: "CLAIM_NOT_FOUND" };
  }

  const topic = await getTopicById(db, claim.value.topicId);
  if (!topic.ok || !topic.value) {
    return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
  }

  const history = await listModerationActionsForClaim(db, claim.value.id);
  const disclosure = await getConflictDisclosureForClaim(db, claim.value.id);

  const reviewCap = await authorizeCapability(db, authz.value, "claims.review");
  const canSeePrivateDetail = reviewCap.ok;
  const disclosureRow = disclosure.ok ? disclosure.value : null;

  const latest = history.ok ? history.value.at(-1) : null;

  return {
    ok: true,
    value: {
      subjectType: "claim",
      claim: {
        subjectType: "claim",
        subjectId: claim.value.id,
        topicId: claim.value.topicId,
        topicSlug: topic.value.slug,
        topicTitle: topic.value.title,
        title: claim.value.title,
        workflowState: claim.value.workflowState,
        qualityStatus: null,
        moderationVisibility: claim.value.moderationVisibility,
        submitterDisplayLabel: await submitterLabel(
          db,
          claim.value.authorAccountId,
        ),
        updatedAt: claim.value.updatedAt.toISOString(),
        latestActionSummary: latest
          ? {
              action: latest.action,
              publicRationale: latest.publicRationale,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
        conflictPublicSummary: disclosureRow?.publicSummary ?? null,
      },
      topic: {
        slug: topic.value.slug,
        title: topic.value.title,
        question: topic.value.question,
        workflowState: topic.value.workflowState,
        publicationStatus: topic.value.publicationStatus,
      },
      expectedUpdatedAt: claim.value.updatedAt.toISOString(),
      history: history.ok ? history.value.map(toStaffModerationActionDto) : [],
      conflictDisclosure: disclosureRow
        ? canSeePrivateDetail
          ? toOwnerOrReviewerConflictDisclosure(disclosureRow)
          : toPublicSummaryConflictDisclosure(disclosureRow)
        : null,
      canSeePrivateDetail,
    },
  };
}

export async function getEvidenceModerationDetail(
  db: GatedDb,
  input: { actorAccountId: string; evidenceSubmissionId: string },
): Promise<AdapterResult<EvidenceModerationDetail>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const authz = await requireModerator(db, input.actorAccountId);
  if (!authz.ok) return authz;

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

  const history = await listModerationActionsForEvidence(db, evidence.value.id);
  const disclosure = await getConflictDisclosureForEvidence(
    db,
    evidence.value.id,
  );

  const reviewCap = await authorizeCapability(
    db,
    authz.value,
    "evidence.review",
  );
  const canSeePrivateDetail = reviewCap.ok;
  const disclosureRow = disclosure.ok ? disclosure.value : null;
  const latest = history.ok ? history.value.at(-1) : null;

  return {
    ok: true,
    value: {
      subjectType: "evidence",
      evidence: {
        subjectType: "evidence",
        subjectId: evidence.value.id,
        topicId: evidence.value.topicId,
        topicSlug: topic.value.slug,
        topicTitle: topic.value.title,
        title: evidence.value.title,
        workflowState: evidence.value.workflowState,
        qualityStatus: evidence.value.qualityStatus,
        moderationVisibility: evidence.value.moderationVisibility,
        submitterDisplayLabel: await submitterLabel(
          db,
          evidence.value.submitterAccountId,
        ),
        updatedAt: evidence.value.updatedAt.toISOString(),
        latestActionSummary: latest
          ? {
              action: latest.action,
              publicRationale: latest.publicRationale,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
        conflictPublicSummary: disclosureRow?.publicSummary ?? null,
        sourceUrl: evidence.value.sourceUrl,
        organization: evidence.value.organization,
        limitations: evidence.value.limitations,
      },
      topic: {
        slug: topic.value.slug,
        title: topic.value.title,
        question: topic.value.question,
        workflowState: topic.value.workflowState,
        publicationStatus: topic.value.publicationStatus,
      },
      expectedUpdatedAt: evidence.value.updatedAt.toISOString(),
      history: history.ok ? history.value.map(toStaffModerationActionDto) : [],
      conflictDisclosure: disclosureRow
        ? canSeePrivateDetail
          ? toOwnerOrReviewerConflictDisclosure(disclosureRow)
          : toPublicSummaryConflictDisclosure(disclosureRow)
        : null,
      canSeePrivateDetail,
    },
  };
}
