import { and, eq, sql } from "drizzle-orm";

import {
  claimEvidenceLinks,
  claimReviews,
  claims,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type SubmissionWorkflowState =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type ModerationVisibility = "visible" | "held" | "hidden";

export type ClaimEvidenceRelationship = "supporting" | "counterevidence";

export type ClaimReviewDecision =
  | "changes_requested"
  | "accepted"
  | "rejected";

/** Claim row without account contact/verification joins. */
export type ClaimRecord = {
  id: string;
  topicId: string;
  authorAccountId: string;
  title: string;
  summary: string;
  approachLabel: string;
  workflowState: SubmissionWorkflowState;
  moderationVisibility: ModerationVisibility;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimEvidenceLinkRecord = {
  id: string;
  topicId: string;
  claimId: string;
  evidenceSubmissionId: string;
  relationship: ClaimEvidenceRelationship;
  createdAt: Date;
};

export type ClaimReviewRecord = {
  id: string;
  claimId: string;
  reviewerAccountId: string;
  decision: ClaimReviewDecision;
  publicRationale: string;
  privateNotes: string | null;
  synthetic: boolean;
  decidedAt: Date;
  createdAt: Date;
};

function mapClaim(row: typeof claims.$inferSelect): ClaimRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    authorAccountId: row.authorAccountId,
    title: row.title,
    summary: row.summary,
    approachLabel: row.approachLabel,
    workflowState: row.workflowState,
    moderationVisibility: row.moderationVisibility,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLink(
  row: typeof claimEvidenceLinks.$inferSelect,
): ClaimEvidenceLinkRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    relationship: row.relationship,
    createdAt: row.createdAt,
  };
}

function mapReview(row: typeof claimReviews.$inferSelect): ClaimReviewRecord {
  return {
    id: row.id,
    claimId: row.claimId,
    reviewerAccountId: row.reviewerAccountId,
    decision: row.decision,
    publicRationale: row.publicRationale,
    privateNotes: row.privateNotes,
    synthetic: row.synthetic,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

export async function insertClaim(
  db: GatedDb,
  input: {
    topicId: string;
    authorAccountId: string;
    title: string;
    summary: string;
    approachLabel: string;
    synthetic: boolean;
    workflowState?: SubmissionWorkflowState;
    moderationVisibility?: ModerationVisibility;
  },
): Promise<AdapterResult<ClaimRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("claim");
  const [row] = await db
    .insert(claims)
    .values({
      id,
      topicId: input.topicId,
      authorAccountId: input.authorAccountId,
      title: input.title,
      summary: input.summary,
      approachLabel: input.approachLabel,
      synthetic: input.synthetic,
      workflowState: input.workflowState ?? "draft",
      moderationVisibility: input.moderationVisibility ?? "visible",
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert claim",
      code: "CLAIM_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapClaim(row) };
}

/**
 * Expected-state content update. Does not change workflow.
 * Returns null when expectedUpdatedAt no longer matches.
 */
export async function updateClaimContent(
  db: GatedDb,
  input: {
    claimId: string;
    expectedUpdatedAt: Date;
    title: string;
    summary: string;
    approachLabel: string;
  },
): Promise<AdapterResult<ClaimRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const [row] = await db
    .update(claims)
    .set({
      title: input.title,
      summary: input.summary,
      approachLabel: input.approachLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(claims.id, input.claimId),
        eq(claims.updatedAt, input.expectedUpdatedAt),
      ),
    )
    .returning();
  return { ok: true, value: row ? mapClaim(row) : null };
}

export async function getClaimById(
  db: GatedDb,
  id: string,
): Promise<AdapterResult<ClaimRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const [row] = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  return { ok: true, value: row ? mapClaim(row) : null };
}

export async function listClaims(
  db: GatedDb,
  filters: {
    topicId: string;
    workflowState?: SubmissionWorkflowState;
    moderationVisibility?: ModerationVisibility;
  },
): Promise<AdapterResult<ClaimRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const conditions = [eq(claims.topicId, filters.topicId)];
  if (filters.workflowState) {
    conditions.push(eq(claims.workflowState, filters.workflowState));
  }
  if (filters.moderationVisibility) {
    conditions.push(
      eq(claims.moderationVisibility, filters.moderationVisibility),
    );
  }

  const rows = await db
    .select()
    .from(claims)
    .where(and(...conditions));
  return { ok: true, value: rows.map(mapClaim) };
}

export async function updateClaimWorkflow(
  db: GatedDb,
  input: {
    claimId: string;
    expectedWorkflowState: SubmissionWorkflowState;
    nextWorkflowState: SubmissionWorkflowState;
  },
): Promise<AdapterResult<ClaimRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(claims)
    .set({
      workflowState: input.nextWorkflowState,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(claims.id, input.claimId),
        eq(claims.workflowState, input.expectedWorkflowState),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapClaim(row) : null };
}

/**
 * Expected-state moderation visibility update. Does not change workflow.
 * Returns null when expected visibility or updatedAt no longer matches.
 */
export async function updateClaimModerationVisibility(
  db: GatedDb,
  input: {
    claimId: string;
    expectedVisibility: ModerationVisibility;
    expectedUpdatedAt: Date;
    nextVisibility: ModerationVisibility;
  },
): Promise<AdapterResult<ClaimRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(claims)
    .set({
      moderationVisibility: input.nextVisibility,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(claims.id, input.claimId),
        eq(claims.moderationVisibility, input.expectedVisibility),
        // Match ISO/JS millisecond tokens against Postgres now() microseconds.
        sql`date_trunc('milliseconds', ${claims.updatedAt}) = date_trunc('milliseconds', ${input.expectedUpdatedAt}::timestamptz)`,
      ),
    )
    .returning();

  return { ok: true, value: row ? mapClaim(row) : null };
}

export async function insertClaimEvidenceLink(
  db: GatedDb,
  input: {
    topicId: string;
    claimId: string;
    evidenceSubmissionId: string;
    relationship: ClaimEvidenceRelationship;
  },
): Promise<AdapterResult<ClaimEvidenceLinkRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("celink");
  const [row] = await db
    .insert(claimEvidenceLinks)
    .values({
      id,
      topicId: input.topicId,
      claimId: input.claimId,
      evidenceSubmissionId: input.evidenceSubmissionId,
      relationship: input.relationship,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert claim–evidence link",
      code: "CLAIM_EVIDENCE_LINK_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapLink(row) };
}

export async function listClaimEvidenceLinks(
  db: GatedDb,
  filters: {
    topicId?: string;
    claimId?: string;
    evidenceSubmissionId?: string;
    relationship?: ClaimEvidenceRelationship;
  },
): Promise<AdapterResult<ClaimEvidenceLinkRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const conditions = [];
  if (filters.topicId) {
    conditions.push(eq(claimEvidenceLinks.topicId, filters.topicId));
  }
  if (filters.claimId) {
    conditions.push(eq(claimEvidenceLinks.claimId, filters.claimId));
  }
  if (filters.evidenceSubmissionId) {
    conditions.push(
      eq(
        claimEvidenceLinks.evidenceSubmissionId,
        filters.evidenceSubmissionId,
      ),
    );
  }
  if (filters.relationship) {
    conditions.push(eq(claimEvidenceLinks.relationship, filters.relationship));
  }

  const rows =
    conditions.length === 0
      ? await db.select().from(claimEvidenceLinks)
      : await db
          .select()
          .from(claimEvidenceLinks)
          .where(conditions.length === 1 ? conditions[0]! : and(...conditions));

  return { ok: true, value: rows.map(mapLink) };
}

/** Append-only review provenance insert (UPDATE/DELETE blocked by DB trigger). */
export async function appendClaimReview(
  db: GatedDb,
  input: {
    claimId: string;
    reviewerAccountId: string;
    decision: ClaimReviewDecision;
    publicRationale: string;
    privateNotes?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<ClaimReviewRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("crev");
  const [row] = await db
    .insert(claimReviews)
    .values({
      id,
      claimId: input.claimId,
      reviewerAccountId: input.reviewerAccountId,
      decision: input.decision,
      publicRationale: input.publicRationale,
      privateNotes: input.privateNotes ?? null,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to append claim review",
      code: "CLAIM_REVIEW_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapReview(row) };
}

export async function listClaimReviews(
  db: GatedDb,
  claimId: string,
): Promise<AdapterResult<ClaimReviewRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(claimReviews)
    .where(eq(claimReviews.claimId, claimId));
  return { ok: true, value: rows.map(mapReview) };
}
