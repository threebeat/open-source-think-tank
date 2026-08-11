import { and, eq } from "drizzle-orm";

import { topics } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type TopicWorkflowState =
  | "draft"
  | "open_for_submissions"
  | "under_review"
  | "paused"
  | "archived";

export type TopicPublicationStatus = "unpublished" | "published";

/** Topic row without account contact/verification joins. */
export type TopicRecord = {
  id: string;
  slug: string;
  title: string;
  question: string;
  background: string;
  scope: string;
  workflowState: TopicWorkflowState;
  publicationStatus: TopicPublicationStatus;
  createdByAccountId: string;
  publishedAt: Date | null;
  publishedByAccountId: string | null;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapTopic(row: typeof topics.$inferSelect): TopicRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    question: row.question,
    background: row.background,
    scope: row.scope,
    workflowState: row.workflowState,
    publicationStatus: row.publicationStatus,
    createdByAccountId: row.createdByAccountId,
    publishedAt: row.publishedAt,
    publishedByAccountId: row.publishedByAccountId,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insertTopic(
  db: GatedDb,
  input: {
    slug: string;
    title: string;
    question: string;
    background: string;
    scope: string;
    createdByAccountId: string;
    synthetic: boolean;
    workflowState?: TopicWorkflowState;
    publicationStatus?: TopicPublicationStatus;
    publishedAt?: Date | null;
    publishedByAccountId?: string | null;
  },
): Promise<AdapterResult<TopicRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const id = newEntityId("topic");
  const [row] = await db
    .insert(topics)
    .values({
      id,
      slug: input.slug,
      title: input.title,
      question: input.question,
      background: input.background,
      scope: input.scope,
      createdByAccountId: input.createdByAccountId,
      synthetic: input.synthetic,
      workflowState: input.workflowState ?? "draft",
      publicationStatus: input.publicationStatus ?? "unpublished",
      publishedAt: input.publishedAt ?? null,
      publishedByAccountId: input.publishedByAccountId ?? null,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert topic",
      code: "TOPIC_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapTopic(row) };
}

export async function getTopicById(
  db: GatedDb,
  id: string,
): Promise<AdapterResult<TopicRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const [row] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  return { ok: true, value: row ? mapTopic(row) : null };
}

export async function getTopicBySlug(
  db: GatedDb,
  slug: string,
): Promise<AdapterResult<TopicRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const [row] = await db
    .select()
    .from(topics)
    .where(eq(topics.slug, slug))
    .limit(1);
  return { ok: true, value: row ? mapTopic(row) : null };
}

export async function listTopics(db: GatedDb, filters?: {
  workflowState?: TopicWorkflowState;
  publicationStatus?: TopicPublicationStatus;
}): Promise<AdapterResult<TopicRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const conditions = [];
  if (filters?.workflowState) {
    conditions.push(eq(topics.workflowState, filters.workflowState));
  }
  if (filters?.publicationStatus) {
    conditions.push(eq(topics.publicationStatus, filters.publicationStatus));
  }

  const rows =
    conditions.length === 0
      ? await db.select().from(topics)
      : await db
          .select()
          .from(topics)
          .where(conditions.length === 1 ? conditions[0]! : and(...conditions));

  return { ok: true, value: rows.map(mapTopic) };
}

/**
 * Expected-state metadata update for draft topics only (enforced by caller).
 * Does not touch workflow_state or publication fields.
 * Returns null value when expectedUpdatedAt no longer matches (stale write).
 */
export async function updateTopicMetadata(
  db: GatedDb,
  input: {
    topicId: string;
    expectedUpdatedAt: Date;
    title: string;
    question: string;
    background: string;
    scope: string;
  },
): Promise<AdapterResult<TopicRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(topics)
    .set({
      title: input.title,
      question: input.question,
      background: input.background,
      scope: input.scope,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(topics.id, input.topicId),
        eq(topics.updatedAt, input.expectedUpdatedAt),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapTopic(row) : null };
}

/**
 * Expected-state workflow update. Does not touch publication_status.
 * Returns null value when the expected workflow no longer matches (lost update).
 */
export async function updateTopicWorkflow(
  db: GatedDb,
  input: {
    topicId: string;
    expectedWorkflowState: TopicWorkflowState;
    nextWorkflowState: TopicWorkflowState;
  },
): Promise<AdapterResult<TopicRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(topics)
    .set({
      workflowState: input.nextWorkflowState,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(topics.id, input.topicId),
        eq(topics.workflowState, input.expectedWorkflowState),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapTopic(row) : null };
}

/**
 * Expected-state publication update. Does not touch workflow_state.
 */
export async function updateTopicPublication(
  db: GatedDb,
  input: {
    topicId: string;
    expectedPublicationStatus: TopicPublicationStatus;
    nextPublicationStatus: TopicPublicationStatus;
    publishedAt: Date | null;
    publishedByAccountId: string | null;
  },
): Promise<AdapterResult<TopicRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const [row] = await db
    .update(topics)
    .set({
      publicationStatus: input.nextPublicationStatus,
      publishedAt: input.publishedAt,
      publishedByAccountId: input.publishedByAccountId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(topics.id, input.topicId),
        eq(topics.publicationStatus, input.expectedPublicationStatus),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapTopic(row) : null };
}
