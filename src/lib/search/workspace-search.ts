import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";

import {
  claimEvidenceLinks,
  claims,
  evidenceSubmissions,
  topics,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal, PlatformRole } from "@/lib/authz/types";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  ilikeContainsPattern,
  type WorkspaceSearchEntity,
  type WorkspaceSearchQuery,
} from "@/lib/search/schemas";

export type WorkspaceSearchResult = {
  entityType: "topic" | "claim" | "evidence";
  id: string;
  title: string;
  topicTitle: string | null;
  topicSlug: string | null;
  workflowLabel: string | null;
  qualityLabel: string | null;
  visibilityLabel: string | null;
  updatedAt: string;
  href: string;
};

export type WorkspaceSearchPage = {
  query: string;
  entities: WorkspaceSearchEntity[];
  page: number;
  pageSize: number;
  total: number;
  results: WorkspaceSearchResult[];
};

type SearchAudience = {
  isParticipant: boolean;
  isReviewer: boolean;
  isModerator: boolean;
  isAdministrator: boolean;
};

const FORBIDDEN_RESULT_KEYS = [
  "accountId",
  "authorAccountId",
  "submitterAccountId",
  "createdByAccountId",
  "contactChannel",
  "privateDetail",
  "privateNote",
  "privateNotes",
  "verification",
  "invite",
  "pseudonym",
  "rawAudit",
  "beforeSnapshot",
  "afterSnapshot",
] as const;

function hasRole(principal: AuthzPrincipal, role: PlatformRole): boolean {
  return principal.platformRoles.includes(role);
}

function audienceOf(principal: AuthzPrincipal): SearchAudience {
  return {
    // Administrator must not inherit participant “own submission” semantics.
    isParticipant: hasRole(principal, "participant"),
    isReviewer: hasRole(principal, "reviewer") || hasRole(principal, "administrator"),
    isModerator:
      hasRole(principal, "moderator") || hasRole(principal, "administrator"),
    isAdministrator: hasRole(principal, "administrator"),
  };
}

function workflowLabel(state: string | null | undefined): string | null {
  if (!state) return null;
  return state.replaceAll("_", " ");
}

function assertSafeResult(result: WorkspaceSearchResult): void {
  const blob = JSON.stringify(result);
  for (const key of FORBIDDEN_RESULT_KEYS) {
    if (blob.includes(`"${key}"`)) {
      throw new Error(`SEARCH_DTO_FORBIDDEN_KEY:${key}`);
    }
  }
  if (/account-ostt-/i.test(blob)) {
    throw new Error("SEARCH_DTO_ACCOUNT_ID_LEAK");
  }
}

function topicHref(
  audience: SearchAudience,
  slug: string,
  publicationStatus: string,
  workflowState: string,
): string {
  if (audience.isAdministrator) {
    return `/workspace/topics/${slug}`;
  }
  if (publicationStatus === "published") {
    return `/topics/${slug}`;
  }
  if (
    audience.isParticipant &&
    workflowState === "open_for_submissions"
  ) {
    return `/workspace/topics/${slug}/submit`;
  }
  // Reviewer/moderator may still see topic metadata when reviewing; link to
  // public published surface only when published, else workspace review home.
  if (audience.isReviewer || audience.isModerator) {
    return publicationStatus === "published"
      ? `/topics/${slug}`
      : "/workspace/review";
  }
  return `/topics/${slug}`;
}

function claimHref(audience: SearchAudience, claimId: string): string {
  if (audience.isReviewer) {
    return `/workspace/review/claims/${claimId}`;
  }
  if (audience.isModerator) {
    return `/workspace/moderation/claims/${claimId}`;
  }
  return `/workspace/submissions/${claimId}`;
}

function evidenceHref(
  audience: SearchAudience,
  evidenceId: string,
  linkedClaimId: string | null,
): string {
  if (audience.isReviewer) {
    return `/workspace/review/evidence/${evidenceId}`;
  }
  if (audience.isModerator) {
    return `/workspace/moderation/evidence/${evidenceId}`;
  }
  if (linkedClaimId) {
    return `/workspace/submissions/${linkedClaimId}`;
  }
  return "/workspace/submissions";
}

/**
 * Gated workspace search — ACL applied in SQL; allowlisted DTOs only.
 */
export async function searchWorkspace(
  db: GatedDb,
  actorAccountId: string,
  input: WorkspaceSearchQuery,
): Promise<AdapterResult<WorkspaceSearchPage>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Workspace search unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_SEARCH",
    };
  }

  const principal = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(db, principal, "workspace.search");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const audience = audienceOf(decision.principal);
  const pattern = ilikeContainsPattern(input.q);
  const offset = (input.page - 1) * input.pageSize;

  try {
    const collected: WorkspaceSearchResult[] = [];

    if (input.entities.includes("topics")) {
      collected.push(...(await searchTopics(db, decision.principal, audience, pattern)));
    }
    if (input.entities.includes("claims")) {
      collected.push(...(await searchClaims(db, decision.principal, audience, pattern)));
    }
    if (input.entities.includes("evidence")) {
      collected.push(
        ...(await searchEvidence(db, decision.principal, audience, pattern)),
      );
    }

    // Deterministic ordering across entity union: updatedAt desc, entityType, id.
    collected.sort((a, b) => {
      const byTime = b.updatedAt.localeCompare(a.updatedAt);
      if (byTime !== 0) return byTime;
      const byType = a.entityType.localeCompare(b.entityType);
      if (byType !== 0) return byType;
      return a.id.localeCompare(b.id);
    });

    for (const row of collected) {
      assertSafeResult(row);
    }

    const total = collected.length;
    const results = collected.slice(offset, offset + input.pageSize);

    return {
      ok: true,
      value: {
        query: input.q,
        entities: input.entities,
        page: input.page,
        pageSize: input.pageSize,
        total,
        results,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Workspace search temporarily unavailable",
      code: "WORKSPACE_SEARCH_UNAVAILABLE",
    };
  }
}

async function searchTopics(
  db: GatedDb,
  principal: AuthzPrincipal,
  audience: SearchAudience,
  pattern: string,
): Promise<WorkspaceSearchResult[]> {
  const visibility = topicVisibilitySql(principal, audience);
  if (!visibility) return [];

  const rows = await db
    .select({
      id: topics.id,
      title: topics.title,
      slug: topics.slug,
      workflowState: topics.workflowState,
      publicationStatus: topics.publicationStatus,
      updatedAt: topics.updatedAt,
    })
    .from(topics)
    .where(
      and(
        visibility,
        or(
          sql`${topics.title} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${topics.slug} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${topics.question} ILIKE ${pattern} ESCAPE '\\'`,
        )!,
      ),
    )
    .orderBy(desc(topics.updatedAt), asc(topics.slug));

  return rows.map((row) => ({
    entityType: "topic" as const,
    id: row.id,
    title: row.title,
    topicTitle: row.title,
    topicSlug: row.slug,
    workflowLabel: workflowLabel(row.workflowState),
    qualityLabel: null,
    visibilityLabel:
      row.publicationStatus === "published" ? "published" : "unpublished",
    updatedAt: row.updatedAt.toISOString(),
    href: topicHref(
      audience,
      row.slug,
      row.publicationStatus,
      row.workflowState,
    ),
  }));
}

function topicVisibilitySql(
  principal: AuthzPrincipal,
  audience: SearchAudience,
): SQL | undefined {
  const clauses: SQL[] = [];

  if (audience.isParticipant) {
    // Open for submissions, published metadata, or topics tied to own submissions.
    clauses.push(
      or(
        eq(topics.workflowState, "open_for_submissions"),
        eq(topics.publicationStatus, "published"),
        sql`${topics.id} IN (
          SELECT ${claims.topicId} FROM ${claims}
          WHERE ${claims.authorAccountId} = ${principal.accountId}
          UNION
          SELECT ${evidenceSubmissions.topicId} FROM ${evidenceSubmissions}
          WHERE ${evidenceSubmissions.submitterAccountId} = ${principal.accountId}
        )`,
      )!,
    );
  }

  if (audience.isReviewer || audience.isModerator || audience.isAdministrator) {
    // Staff may search administrative / reviewable topic metadata (not drafts-only
    // enumeration beyond what review workflows need). Include all non-empty topics
    // that have workflow activity or publication — still no account IDs in DTO.
    clauses.push(sql`true`);
  }

  if (clauses.length === 0) return undefined;
  return or(...clauses);
}

async function searchClaims(
  db: GatedDb,
  principal: AuthzPrincipal,
  audience: SearchAudience,
  pattern: string,
): Promise<WorkspaceSearchResult[]> {
  const visibility = claimVisibilitySql(principal, audience);
  if (!visibility) return [];

  const rows = await db
    .select({
      id: claims.id,
      title: claims.title,
      workflowState: claims.workflowState,
      moderationVisibility: claims.moderationVisibility,
      updatedAt: claims.updatedAt,
      topicTitle: topics.title,
      topicSlug: topics.slug,
    })
    .from(claims)
    .innerJoin(topics, eq(claims.topicId, topics.id))
    .where(
      and(
        visibility,
        or(
          sql`${claims.title} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${claims.summary} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${claims.approachLabel} ILIKE ${pattern} ESCAPE '\\'`,
        )!,
      ),
    )
    .orderBy(desc(claims.updatedAt), asc(claims.id));

  return rows.map((row) => ({
    entityType: "claim" as const,
    id: row.id,
    title: row.title,
    topicTitle: row.topicTitle,
    topicSlug: row.topicSlug,
    workflowLabel: workflowLabel(row.workflowState),
    qualityLabel: null,
    visibilityLabel: workflowLabel(row.moderationVisibility),
    updatedAt: row.updatedAt.toISOString(),
    href: claimHref(audience, row.id),
  }));
}

function claimVisibilitySql(
  principal: AuthzPrincipal,
  audience: SearchAudience,
): SQL | undefined {
  const clauses: SQL[] = [];

  if (audience.isParticipant) {
    // Own authored claims only — never another participant’s drafts/private rows.
    clauses.push(eq(claims.authorAccountId, principal.accountId));
  }

  if (audience.isReviewer) {
    // Metadata needed by claims.review — submitted+ and accepted/rejected etc.
    // Exclude nothing by ownership; DTO stays metadata-only.
    clauses.push(sql`${claims.workflowState} <> 'draft'`);
  }

  if (audience.isModerator && !audience.isReviewer) {
    // Moderator without reviewer: moderation queue-relevant metadata.
    clauses.push(
      sql`${claims.workflowState} IN ('submitted', 'accepted', 'changes_requested', 'rejected')`,
    );
  }

  if (clauses.length === 0) return undefined;
  return or(...clauses);
}

async function searchEvidence(
  db: GatedDb,
  principal: AuthzPrincipal,
  audience: SearchAudience,
  pattern: string,
): Promise<WorkspaceSearchResult[]> {
  const visibility = evidenceVisibilitySql(principal, audience);
  if (!visibility) return [];

  const rows = await db
    .select({
      id: evidenceSubmissions.id,
      title: evidenceSubmissions.title,
      workflowState: evidenceSubmissions.workflowState,
      qualityStatus: evidenceSubmissions.qualityStatus,
      moderationVisibility: evidenceSubmissions.moderationVisibility,
      updatedAt: evidenceSubmissions.updatedAt,
      topicTitle: topics.title,
      topicSlug: topics.slug,
      linkedClaimId: sql<string | null>`(
        SELECT ${claimEvidenceLinks.claimId}
        FROM ${claimEvidenceLinks}
        WHERE ${claimEvidenceLinks.evidenceSubmissionId} = ${evidenceSubmissions.id}
        ORDER BY ${claimEvidenceLinks.createdAt} ASC
        LIMIT 1
      )`.as("linked_claim_id"),
    })
    .from(evidenceSubmissions)
    .innerJoin(topics, eq(evidenceSubmissions.topicId, topics.id))
    .where(
      and(
        visibility,
        or(
          sql`${evidenceSubmissions.title} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${evidenceSubmissions.organization} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${evidenceSubmissions.limitations} ILIKE ${pattern} ESCAPE '\\'`,
        )!,
      ),
    )
    .orderBy(desc(evidenceSubmissions.updatedAt), asc(evidenceSubmissions.id));

  return rows.map((row) => ({
    entityType: "evidence" as const,
    id: row.id,
    title: row.title,
    topicTitle: row.topicTitle,
    topicSlug: row.topicSlug,
    workflowLabel: workflowLabel(row.workflowState),
    qualityLabel: workflowLabel(row.qualityStatus),
    visibilityLabel: workflowLabel(row.moderationVisibility),
    updatedAt: row.updatedAt.toISOString(),
    href: evidenceHref(audience, row.id, row.linkedClaimId),
  }));
}

function evidenceVisibilitySql(
  principal: AuthzPrincipal,
  audience: SearchAudience,
): SQL | undefined {
  const clauses: SQL[] = [];

  if (audience.isParticipant) {
    clauses.push(eq(evidenceSubmissions.submitterAccountId, principal.accountId));
  }

  if (audience.isReviewer) {
    clauses.push(sql`${evidenceSubmissions.workflowState} <> 'draft'`);
  }

  if (audience.isModerator && !audience.isReviewer) {
    clauses.push(
      sql`${evidenceSubmissions.workflowState} IN ('submitted', 'accepted', 'changes_requested', 'rejected')`,
    );
  }

  if (clauses.length === 0) return undefined;
  return or(...clauses);
}

/** Test helper — exposed forbidden-key list for sentinel assertions. */
export const WORKSPACE_SEARCH_FORBIDDEN_KEYS = FORBIDDEN_RESULT_KEYS;
