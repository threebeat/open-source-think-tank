import { and, eq } from "drizzle-orm";

import { evidenceReviews, evidenceSubmissions } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import type {
  ModerationVisibility,
  SubmissionWorkflowState,
} from "@/lib/claims/repository";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type EvidenceQualityStatus =
  | "pending"
  | "accepted"
  | "limited"
  | "disputed"
  | "rejected";

export type EvidenceAuthorType =
  | "agency"
  | "researcher"
  | "journalist"
  | "civil_society"
  | "industry"
  | "other";

export type EvidenceSourceType =
  | "report"
  | "dataset"
  | "peer_reviewed"
  | "news"
  | "memo"
  | "other";

export type EvidenceReviewDecision =
  | "changes_requested"
  | "accepted"
  | "rejected"
  | "quality_decided";

/** Evidence submission without account contact/verification joins. */
export type EvidenceSubmissionRecord = {
  id: string;
  topicId: string;
  submitterAccountId: string;
  sourceUrl: string;
  title: string;
  organization: string;
  authorType: EvidenceAuthorType;
  sourceType: EvidenceSourceType;
  limitations: string;
  workflowState: SubmissionWorkflowState;
  qualityStatus: EvidenceQualityStatus;
  moderationVisibility: ModerationVisibility;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EvidenceReviewRecord = {
  id: string;
  evidenceSubmissionId: string;
  reviewerAccountId: string;
  decision: EvidenceReviewDecision;
  qualityStatus: EvidenceQualityStatus | null;
  workflowDecision: SubmissionWorkflowState | null;
  publicRationale: string;
  privateNotes: string | null;
  synthetic: boolean;
  decidedAt: Date;
  createdAt: Date;
};

function mapEvidence(
  row: typeof evidenceSubmissions.$inferSelect,
): EvidenceSubmissionRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    submitterAccountId: row.submitterAccountId,
    sourceUrl: row.sourceUrl,
    title: row.title,
    organization: row.organization,
    authorType: row.authorType,
    sourceType: row.sourceType,
    limitations: row.limitations,
    workflowState: row.workflowState,
    qualityStatus: row.qualityStatus,
    moderationVisibility: row.moderationVisibility,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapReview(
  row: typeof evidenceReviews.$inferSelect,
): EvidenceReviewRecord {
  return {
    id: row.id,
    evidenceSubmissionId: row.evidenceSubmissionId,
    reviewerAccountId: row.reviewerAccountId,
    decision: row.decision,
    qualityStatus: row.qualityStatus,
    workflowDecision: row.workflowDecision,
    publicRationale: row.publicRationale,
    privateNotes: row.privateNotes,
    synthetic: row.synthetic,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

export async function insertEvidenceSubmission(
  db: GatedDb,
  input: {
    topicId: string;
    submitterAccountId: string;
    sourceUrl: string;
    title: string;
    organization: string;
    authorType: EvidenceAuthorType;
    sourceType: EvidenceSourceType;
    limitations: string;
    synthetic: boolean;
    workflowState?: SubmissionWorkflowState;
    qualityStatus?: EvidenceQualityStatus;
    moderationVisibility?: ModerationVisibility;
  },
): Promise<AdapterResult<EvidenceSubmissionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("evsub");
  const [row] = await db
    .insert(evidenceSubmissions)
    .values({
      id,
      topicId: input.topicId,
      submitterAccountId: input.submitterAccountId,
      sourceUrl: input.sourceUrl,
      title: input.title,
      organization: input.organization,
      authorType: input.authorType,
      sourceType: input.sourceType,
      limitations: input.limitations,
      synthetic: input.synthetic,
      workflowState: input.workflowState ?? "draft",
      qualityStatus: input.qualityStatus ?? "pending",
      moderationVisibility: input.moderationVisibility ?? "visible",
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert evidence submission",
      code: "EVIDENCE_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapEvidence(row) };
}

export async function getEvidenceSubmissionById(
  db: GatedDb,
  id: string,
): Promise<AdapterResult<EvidenceSubmissionRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const [row] = await db
    .select()
    .from(evidenceSubmissions)
    .where(eq(evidenceSubmissions.id, id))
    .limit(1);
  return { ok: true, value: row ? mapEvidence(row) : null };
}

export async function listEvidenceSubmissions(
  db: GatedDb,
  filters: {
    topicId: string;
    workflowState?: SubmissionWorkflowState;
    qualityStatus?: EvidenceQualityStatus;
    moderationVisibility?: ModerationVisibility;
  },
): Promise<AdapterResult<EvidenceSubmissionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const conditions = [eq(evidenceSubmissions.topicId, filters.topicId)];
  if (filters.workflowState) {
    conditions.push(eq(evidenceSubmissions.workflowState, filters.workflowState));
  }
  if (filters.qualityStatus) {
    conditions.push(eq(evidenceSubmissions.qualityStatus, filters.qualityStatus));
  }
  if (filters.moderationVisibility) {
    conditions.push(
      eq(
        evidenceSubmissions.moderationVisibility,
        filters.moderationVisibility,
      ),
    );
  }

  const rows = await db
    .select()
    .from(evidenceSubmissions)
    .where(and(...conditions));
  return { ok: true, value: rows.map(mapEvidence) };
}

/**
 * Expected-state workflow update. Does not change quality_status.
 */
export async function updateEvidenceWorkflow(
  db: GatedDb,
  input: {
    evidenceSubmissionId: string;
    expectedWorkflowState: SubmissionWorkflowState;
    nextWorkflowState: SubmissionWorkflowState;
  },
): Promise<AdapterResult<EvidenceSubmissionRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(evidenceSubmissions)
    .set({
      workflowState: input.nextWorkflowState,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(evidenceSubmissions.id, input.evidenceSubmissionId),
        eq(evidenceSubmissions.workflowState, input.expectedWorkflowState),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapEvidence(row) : null };
}

/**
 * Expected-state quality update. Does not change workflow_state.
 */
export async function updateEvidenceQuality(
  db: GatedDb,
  input: {
    evidenceSubmissionId: string;
    expectedQualityStatus: EvidenceQualityStatus;
    nextQualityStatus: EvidenceQualityStatus;
  },
): Promise<AdapterResult<EvidenceSubmissionRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(evidenceSubmissions)
    .set({
      qualityStatus: input.nextQualityStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(evidenceSubmissions.id, input.evidenceSubmissionId),
        eq(evidenceSubmissions.qualityStatus, input.expectedQualityStatus),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapEvidence(row) : null };
}

/** Append-only review provenance insert (UPDATE/DELETE blocked by DB trigger). */
export async function appendEvidenceReview(
  db: GatedDb,
  input: {
    evidenceSubmissionId: string;
    reviewerAccountId: string;
    decision: EvidenceReviewDecision;
    publicRationale: string;
    qualityStatus?: EvidenceQualityStatus | null;
    workflowDecision?: SubmissionWorkflowState | null;
    privateNotes?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<EvidenceReviewRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("erev");
  const [row] = await db
    .insert(evidenceReviews)
    .values({
      id,
      evidenceSubmissionId: input.evidenceSubmissionId,
      reviewerAccountId: input.reviewerAccountId,
      decision: input.decision,
      qualityStatus: input.qualityStatus ?? null,
      workflowDecision: input.workflowDecision ?? null,
      publicRationale: input.publicRationale,
      privateNotes: input.privateNotes ?? null,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to append evidence review",
      code: "EVIDENCE_REVIEW_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapReview(row) };
}

export async function listEvidenceReviews(
  db: GatedDb,
  evidenceSubmissionId: string,
): Promise<AdapterResult<EvidenceReviewRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(evidenceReviews)
    .where(eq(evidenceReviews.evidenceSubmissionId, evidenceSubmissionId));
  return { ok: true, value: rows.map(mapReview) };
}
