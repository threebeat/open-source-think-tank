import { asc, eq } from "drizzle-orm";

import { topics } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { type GatedDb, requireGatedPersistence } from "@/lib/persistence/gated";
import { loadProjectionInputs } from "@/lib/topics/publish";
import {
  buildPublicTopicProjection,
  type PublicTopicProjection,
} from "@/lib/topics/public-projection";
import { getTopicBySlug, type TopicRecord } from "@/lib/topics/repository";

export type PublishedTopicListItem = {
  slug: string;
  title: string;
  question: string;
  publishedAt: string;
  geography: {
    jurisdictionLevel: "statewide" | "county";
    stateCode: string;
    countyFips: string | null;
  };
};

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Gated public reads unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_GATED_PUBLIC",
    };
  }
  return null;
}

/**
 * Gated anonymous published-topic list (minimal, deterministic).
 * Repository boundary filters publication_status = published.
 */
export async function listPublishedTopicsForPublic(
  db: GatedDb,
): Promise<AdapterResult<PublishedTopicListItem[]>> {
  const denied = gatedOrDeny();
  if (denied) return denied;
  const persistence = requireGatedPersistence();
  if (persistence) return persistence;

  const rows = await db
    .select()
    .from(topics)
    .where(eq(topics.publicationStatus, "published"))
    .orderBy(asc(topics.publishedAt), asc(topics.slug));

  return {
    ok: true,
    value: rows
      .filter((row) => row.publishedAt != null)
      .map((row) => ({
        slug: row.slug,
        title: row.title,
        question: row.question,
        publishedAt: row.publishedAt!.toISOString(),
        geography: {
          jurisdictionLevel: row.jurisdictionLevel as "statewide" | "county",
          stateCode: row.stateCode,
          countyFips: row.countyFips,
        },
      })),
  };
}

/**
 * Load allowlisted projection for a published slug, or null when missing/unpublished
 * /not projection-eligible. Callers should map null to a generic 404.
 */
export async function getPublishedTopicProjection(
  db: GatedDb,
  slug: string,
): Promise<AdapterResult<PublicTopicProjection | null>> {
  const denied = gatedOrDeny();
  if (denied) return denied;
  const persistence = requireGatedPersistence();
  if (persistence) return persistence;

  const topicResult = await getTopicBySlug(db, slug);
  if (!topicResult.ok) return topicResult;
  const topic = topicResult.value;
  if (!topic || topic.publicationStatus !== "published") {
    return { ok: true, value: null };
  }

  return buildProjectionForTopic(db, topic);
}

async function buildProjectionForTopic(
  db: GatedDb,
  topic: TopicRecord,
): Promise<AdapterResult<PublicTopicProjection | null>> {
  const loaded = await loadProjectionInputs(db, topic);
  const projection = buildPublicTopicProjection({
    topic: {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      question: topic.question,
      background: topic.background,
      scope: topic.scope,
      workflowState: topic.workflowState,
      publicationStatus: topic.publicationStatus,
      jurisdictionLevel: topic.jurisdictionLevel,
      stateCode: topic.stateCode,
      countyFips: topic.countyFips,
      publishedAt: topic.publishedAt,
    },
    claims: loaded.claims.map((claim) => ({
      id: claim.id,
      title: claim.title,
      summary: claim.summary,
      approachLabel: claim.approachLabel,
      workflowState: claim.workflowState,
      moderationVisibility: claim.moderationVisibility,
      workflowPublicRationale: claim.workflowPublicRationale,
      conflictPublicSummary: claim.conflictPublicSummary,
      revisionSummary: claim.revisionSummary,
      latestModerationNotice: claim.latestModerationNotice,
    })),
    evidence: loaded.evidence.map((row) => ({
      id: row.id,
      sourceUrl: row.sourceUrl,
      title: row.title,
      organization: row.organization,
      authorType: row.authorType,
      sourceType: row.sourceType,
      limitations: row.limitations,
      workflowState: row.workflowState,
      qualityStatus: row.qualityStatus,
      moderationVisibility: row.moderationVisibility,
      qualityPublicRationale: row.qualityPublicRationale,
      workflowPublicRationale: row.workflowPublicRationale,
      revisionSummary: row.revisionSummary,
      latestModerationNotice: row.latestModerationNotice,
    })),
    links: (loaded.links.ok ? loaded.links.value : []).map((link) => ({
      topicId: link.topicId,
      claimId: link.claimId,
      evidenceSubmissionId: link.evidenceSubmissionId,
      relationship: link.relationship,
    })),
  });

  return { ok: true, value: projection };
}
