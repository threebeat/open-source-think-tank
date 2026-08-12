import { sql } from "drizzle-orm";

import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal, PlatformRole } from "@/lib/authz/types";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  ilikeContainsPattern,
  WORKSPACE_SEARCH_PAGE_MAX,
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
  /** 1-based inclusive index of first result on this page (0 when empty). */
  rangeFrom: number;
  /** 1-based inclusive index of last result on this page (0 when empty). */
  rangeTo: number;
  hasPrevious: boolean;
  hasNext: boolean;
  results: WorkspaceSearchResult[];
};

/**
 * Internal admission class used only to pick an authorized href.
 * Never serialized into visitor/search DTOs.
 */
type AdmissionClass =
  | "owner"
  | "participant-topic"
  | "reviewer"
  | "moderator"
  | "administrator"
  | "published";

type SearchAudience = {
  isParticipant: boolean;
  isReviewer: boolean;
  isModerator: boolean;
  isAdministrator: boolean;
};

type HitRow = {
  entity_type: "topic" | "claim" | "evidence";
  id: string;
  title: string;
  topic_title: string | null;
  topic_slug: string | null;
  workflow_state: string | null;
  quality_status: string | null;
  moderation_visibility: string | null;
  publication_status: string | null;
  updated_at: Date | string;
  linked_claim_id: string | null;
  admission_class: AdmissionClass;
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
  "admissionClass",
  "admission_class",
] as const;

function hasRole(principal: AuthzPrincipal, role: PlatformRole): boolean {
  return principal.platformRoles.includes(role);
}

function audienceOf(principal: AuthzPrincipal): SearchAudience {
  return {
    isParticipant: hasRole(principal, "participant"),
    isReviewer:
      hasRole(principal, "reviewer") || hasRole(principal, "administrator"),
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

function hrefForHit(row: HitRow): string {
  switch (row.admission_class) {
    case "owner":
      if (row.entity_type === "claim") {
        return `/workspace/submissions/${row.id}`;
      }
      if (row.entity_type === "evidence") {
        return row.linked_claim_id
          ? `/workspace/submissions/${row.linked_claim_id}`
          : "/workspace/submissions";
      }
      return row.topic_slug
        ? `/workspace/topics/${row.topic_slug}/submit`
        : "/workspace/submissions";
    case "participant-topic":
      return `/workspace/topics/${row.topic_slug}/submit`;
    case "published":
      return `/topics/${row.topic_slug}`;
    case "administrator":
      return `/workspace/topics/${row.topic_slug}`;
    case "reviewer":
      if (row.entity_type === "claim") {
        return `/workspace/review/claims/${row.id}`;
      }
      if (row.entity_type === "evidence") {
        return `/workspace/review/evidence/${row.id}`;
      }
      return row.publication_status === "published"
        ? `/topics/${row.topic_slug}`
        : "/workspace/review";
    case "moderator":
      if (row.entity_type === "claim") {
        return `/workspace/moderation/claims/${row.id}`;
      }
      if (row.entity_type === "evidence") {
        return `/workspace/moderation/evidence/${row.id}`;
      }
      return row.publication_status === "published"
        ? `/topics/${row.topic_slug}`
        : "/workspace/moderation";
    default: {
      const _exhaustive: never = row.admission_class;
      return _exhaustive;
    }
  }
}

function mapHit(row: HitRow): WorkspaceSearchResult {
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date(row.updated_at).toISOString();
  return {
    entityType: row.entity_type,
    id: row.id,
    title: row.title,
    topicTitle: row.topic_title,
    topicSlug: row.topic_slug,
    workflowLabel: workflowLabel(row.workflow_state),
    qualityLabel: workflowLabel(row.quality_status),
    visibilityLabel:
      row.entity_type === "topic"
        ? row.publication_status === "published"
          ? "published"
          : "unpublished"
        : workflowLabel(row.moderation_visibility),
    updatedAt,
    href: hrefForHit(row),
  };
}

function unavailable(): AdapterResult<never> {
  return {
    ok: false,
    error: "Workspace search temporarily unavailable",
    code: "WORKSPACE_SEARCH_UNAVAILABLE",
  };
}

/**
 * Gated workspace search — ACL, count, order, and page bounds applied in SQL.
 */
export async function searchWorkspace(
  db: GatedDb,
  actorAccountId: string,
  input: WorkspaceSearchQuery,
): Promise<AdapterResult<WorkspaceSearchPage>> {
  if (process.env.APP_MODE === "public-demo") {
    return {
      ok: false,
      error: "Workspace search unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_SEARCH",
    };
  }

  try {
    if (assertEnvironmentSafe() !== "gated") {
      return {
        ok: false,
        error: "Workspace search unavailable in public-demo mode",
        code: "PUBLIC_DEMO_NO_SEARCH",
      };
    }

    if (input.page > WORKSPACE_SEARCH_PAGE_MAX) {
      return {
        ok: false,
        error: "Invalid search query",
        code: "SEARCH_VALIDATION_FAILED",
      };
    }

    let principal: AuthzPrincipal | null;
    try {
      principal = await loadPrincipal(db, actorAccountId);
    } catch {
      return unavailable();
    }

    let decision: Awaited<ReturnType<typeof authorizeCapability>>;
    try {
      decision = await authorizeCapability(db, principal, "workspace.search");
    } catch {
      return unavailable();
    }
    if (!decision.ok) {
      return { ok: false, error: decision.error, code: decision.code };
    }

    const audience = audienceOf(decision.principal);
    const pattern = ilikeContainsPattern(input.q);
    const offset = (input.page - 1) * input.pageSize;
    const actorId = decision.principal.accountId;

    const unionSql = buildUnionSql(audience, actorId, pattern, input.entities);
    if (!unionSql) {
      return {
        ok: true,
        value: emptyPage(input),
      };
    }

    const countResult = await db.execute<{ total: string | number }>(sql`
      SELECT COUNT(*)::int AS total
      FROM (${unionSql}) AS search_hits
    `);
    const countRows =
      "rows" in countResult
        ? (countResult.rows as Array<{ total: string | number }>)
        : (countResult as unknown as Array<{ total: string | number }>);
    const total = Number(countRows[0]?.total ?? 0);

    const hitResult = await db.execute<HitRow>(sql`
      SELECT *
      FROM (${unionSql}) AS search_hits
      ORDER BY updated_at DESC, entity_type ASC, id ASC
      LIMIT ${input.pageSize}
      OFFSET ${offset}
    `);
    const rows =
      "rows" in hitResult
        ? (hitResult.rows as HitRow[])
        : (hitResult as unknown as HitRow[]);
    const results = rows.map(mapHit);
    for (const row of results) {
      assertSafeResult(row);
    }

    const rangeFrom = total === 0 || results.length === 0 ? 0 : offset + 1;
    const rangeTo =
      total === 0 || results.length === 0 ? 0 : offset + results.length;

    return {
      ok: true,
      value: {
        query: input.q,
        entities: input.entities,
        page: input.page,
        pageSize: input.pageSize,
        total,
        rangeFrom,
        rangeTo,
        hasPrevious: input.page > 1 && total > 0,
        hasNext: offset + results.length < total,
        results,
      },
    };
  } catch {
    return unavailable();
  }
}

function emptyPage(input: WorkspaceSearchQuery): WorkspaceSearchPage {
  return {
    query: input.q,
    entities: input.entities,
    page: input.page,
    pageSize: input.pageSize,
    total: 0,
    rangeFrom: 0,
    rangeTo: 0,
    hasPrevious: false,
    hasNext: false,
    results: [],
  };
}

function buildUnionSql(
  audience: SearchAudience,
  actorId: string,
  pattern: string,
  entities: WorkspaceSearchEntity[],
) {
  const parts: ReturnType<typeof sql>[] = [];

  if (entities.includes("topics")) {
    const topicVis = topicVisibilityPredicate(audience, actorId);
    if (topicVis) {
      parts.push(sql`
        SELECT
          'topic'::text AS entity_type,
          t.id AS id,
          t.title AS title,
          t.title AS topic_title,
          t.slug AS topic_slug,
          t.workflow_state::text AS workflow_state,
          NULL::text AS quality_status,
          NULL::text AS moderation_visibility,
          t.publication_status::text AS publication_status,
          t.updated_at AS updated_at,
          NULL::text AS linked_claim_id,
          CASE
            WHEN t.publication_status = 'published' THEN 'published'
            WHEN ${audience.isAdministrator} THEN 'administrator'
            WHEN ${audience.isParticipant} AND t.workflow_state = 'open_for_submissions'
              THEN 'participant-topic'
            WHEN ${audience.isReviewer} THEN 'reviewer'
            WHEN ${audience.isModerator} THEN 'moderator'
            ELSE 'published'
          END::text AS admission_class
        FROM topics t
        WHERE (${topicVis})
          AND (
            t.title ILIKE ${pattern} ESCAPE '\\'
            OR t.slug ILIKE ${pattern} ESCAPE '\\'
            OR t.question ILIKE ${pattern} ESCAPE '\\'
          )
      `);
    }
  }

  if (entities.includes("claims")) {
    const claimVis = claimVisibilityPredicate(audience, actorId);
    if (claimVis) {
      parts.push(sql`
        SELECT
          'claim'::text AS entity_type,
          c.id AS id,
          c.title AS title,
          top.title AS topic_title,
          top.slug AS topic_slug,
          c.workflow_state::text AS workflow_state,
          NULL::text AS quality_status,
          c.moderation_visibility::text AS moderation_visibility,
          top.publication_status::text AS publication_status,
          c.updated_at AS updated_at,
          NULL::text AS linked_claim_id,
          CASE
            WHEN c.author_account_id = ${actorId} THEN 'owner'
            WHEN ${audience.isReviewer} AND c.workflow_state <> 'draft' THEN 'reviewer'
            WHEN ${audience.isModerator} AND c.workflow_state <> 'draft' THEN 'moderator'
            ELSE 'owner'
          END::text AS admission_class
        FROM claims c
        INNER JOIN topics top ON top.id = c.topic_id
        WHERE (${claimVis})
          AND (
            c.title ILIKE ${pattern} ESCAPE '\\'
            OR c.summary ILIKE ${pattern} ESCAPE '\\'
            OR c.approach_label ILIKE ${pattern} ESCAPE '\\'
          )
      `);
    }
  }

  if (entities.includes("evidence")) {
    const evidenceVis = evidenceVisibilityPredicate(audience, actorId);
    if (evidenceVis) {
      parts.push(sql`
        SELECT
          'evidence'::text AS entity_type,
          e.id AS id,
          e.title AS title,
          top.title AS topic_title,
          top.slug AS topic_slug,
          e.workflow_state::text AS workflow_state,
          e.quality_status::text AS quality_status,
          e.moderation_visibility::text AS moderation_visibility,
          top.publication_status::text AS publication_status,
          e.updated_at AS updated_at,
          (
            SELECT cel.claim_id
            FROM claim_evidence_links cel
            WHERE cel.evidence_submission_id = e.id
            ORDER BY cel.created_at ASC
            LIMIT 1
          ) AS linked_claim_id,
          CASE
            WHEN e.submitter_account_id = ${actorId} THEN 'owner'
            WHEN ${audience.isReviewer} AND e.workflow_state <> 'draft' THEN 'reviewer'
            WHEN ${audience.isModerator} AND e.workflow_state <> 'draft' THEN 'moderator'
            ELSE 'owner'
          END::text AS admission_class
        FROM evidence_submissions e
        INNER JOIN topics top ON top.id = e.topic_id
        WHERE (${evidenceVis})
          AND (
            e.title ILIKE ${pattern} ESCAPE '\\'
            OR e.organization ILIKE ${pattern} ESCAPE '\\'
            OR e.limitations ILIKE ${pattern} ESCAPE '\\'
          )
      `);
    }
  }

  if (parts.length === 0) return null;
  let combined = parts[0]!;
  for (let i = 1; i < parts.length; i += 1) {
    combined = sql`${combined} UNION ALL ${parts[i]!}`;
  }
  return combined;
}

function topicVisibilityPredicate(
  audience: SearchAudience,
  actorId: string,
) {
  const clauses: ReturnType<typeof sql>[] = [];
  if (audience.isParticipant) {
    clauses.push(sql`(
      t.workflow_state = 'open_for_submissions'
      OR t.publication_status = 'published'
      OR t.id IN (
        SELECT c2.topic_id FROM claims c2 WHERE c2.author_account_id = ${actorId}
        UNION
        SELECT e2.topic_id FROM evidence_submissions e2
        WHERE e2.submitter_account_id = ${actorId}
      )
    )`);
  }
  if (audience.isReviewer || audience.isModerator || audience.isAdministrator) {
    clauses.push(sql`TRUE`);
  }
  if (clauses.length === 0) return null;
  let combined = clauses[0]!;
  for (let i = 1; i < clauses.length; i += 1) {
    combined = sql`(${combined}) OR (${clauses[i]!})`;
  }
  return combined;
}

function claimVisibilityPredicate(
  audience: SearchAudience,
  actorId: string,
) {
  const clauses: ReturnType<typeof sql>[] = [];
  if (audience.isParticipant) {
    clauses.push(sql`c.author_account_id = ${actorId}`);
  }
  if (audience.isReviewer) {
    clauses.push(sql`c.workflow_state <> 'draft'`);
  }
  if (audience.isModerator && !audience.isReviewer) {
    clauses.push(sql`c.workflow_state IN ('submitted', 'accepted', 'changes_requested', 'rejected')`);
  }
  if (clauses.length === 0) return null;
  let combined = clauses[0]!;
  for (let i = 1; i < clauses.length; i += 1) {
    combined = sql`(${combined}) OR (${clauses[i]!})`;
  }
  return combined;
}

function evidenceVisibilityPredicate(
  audience: SearchAudience,
  actorId: string,
) {
  const clauses: ReturnType<typeof sql>[] = [];
  if (audience.isParticipant) {
    clauses.push(sql`e.submitter_account_id = ${actorId}`);
  }
  if (audience.isReviewer) {
    clauses.push(sql`e.workflow_state <> 'draft'`);
  }
  if (audience.isModerator && !audience.isReviewer) {
    clauses.push(sql`e.workflow_state IN ('submitted', 'accepted', 'changes_requested', 'rejected')`);
  }
  if (clauses.length === 0) return null;
  let combined = clauses[0]!;
  for (let i = 1; i < clauses.length; i += 1) {
    combined = sql`(${combined}) OR (${clauses[i]!})`;
  }
  return combined;
}

/** Test helper — exposed forbidden-key list for sentinel assertions. */
export const WORKSPACE_SEARCH_FORBIDDEN_KEYS = FORBIDDEN_RESULT_KEYS;

/** Test helper — resolve href from admission class without exposing it in DTOs. */
export function resolveSearchHrefForTests(input: {
  entityType: "topic" | "claim" | "evidence";
  id: string;
  topicSlug: string | null;
  linkedClaimId: string | null;
  publicationStatus: string | null;
  admissionClass: AdmissionClass;
}): string {
  return hrefForHit({
    entity_type: input.entityType,
    id: input.id,
    title: "t",
    topic_title: null,
    topic_slug: input.topicSlug,
    workflow_state: null,
    quality_status: null,
    moderation_visibility: null,
    publication_status: input.publicationStatus,
    updated_at: new Date(),
    linked_claim_id: input.linkedClaimId,
    admission_class: input.admissionClass,
  });
}
