import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { auditEvents } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { computeContinuityDigest } from "@/lib/audit/continuity";
import {
  assertNoProhibitedPublicFields,
  projectAuditEventPublic,
  type PublicAuditSummary,
} from "@/lib/audit/project-public";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";

export type ContinuityVerifyResult = {
  ok: boolean;
  checked: number;
  breakAtId: string | null;
  reason: string | null;
};

type ContinuityRow = {
  id: string;
  at: Date;
  actorRole: string;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  actorAccountId: string | null;
  reason: string | null;
  requestCorrelationId: string | null;
  privatePayload: Record<string, unknown> | null;
  synthetic: boolean;
  continuityPrevHash: string | null;
  continuityHash: string | null;
};

/**
 * Continuity check — recomputes digests, detects forks, and paginates the full
 * requested range (not absolute tamper-proof).
 */
export async function verifyAuditContinuity(
  db: FoundationDb,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<ContinuityVerifyResult> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 200, 1), 500);
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;

  let prevHash: string | null = null;
  let checked = 0;
  let cursorAt: Date | null = null;
  let cursorId: string | null = null;
  const childrenByPrev = new Map<string, string[]>();

  while (checked < maxRows) {
    const remaining = Math.min(pageSize, maxRows - checked);
    const rows: ContinuityRow[] = await db
      .select({
        id: auditEvents.id,
        at: auditEvents.at,
        actorRole: auditEvents.actorRole,
        action: auditEvents.action,
        subjectType: auditEvents.subjectType,
        subjectId: auditEvents.subjectId,
        summary: auditEvents.summary,
        actorAccountId: auditEvents.actorAccountId,
        reason: auditEvents.reason,
        requestCorrelationId: auditEvents.requestCorrelationId,
        privatePayload: auditEvents.privatePayload,
        synthetic: auditEvents.synthetic,
        continuityPrevHash: auditEvents.continuityPrevHash,
        continuityHash: auditEvents.continuityHash,
      })
      .from(auditEvents)
      .where(
        cursorAt && cursorId
          ? sql`(${auditEvents.at}, ${auditEvents.id}) > (${cursorAt.toISOString()}::timestamptz, ${cursorId})`
          : sql`true`,
      )
      .orderBy(asc(auditEvents.at), asc(auditEvents.id))
      .limit(remaining);

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      checked += 1;
      const result = checkContinuityRow(row, prevHash, childrenByPrev);
      if (!result.ok) {
        return {
          ok: false,
          checked,
          breakAtId: row.id,
          reason: result.reason,
        };
      }
      prevHash = result.nextPrevHash;
      cursorAt = row.at;
      cursorId = row.id;
    }

    if (rows.length < remaining) {
      break;
    }
  }

  return { ok: true, checked, breakAtId: null, reason: null };
}

function checkContinuityRow(
  row: ContinuityRow,
  prevHash: string | null,
  childrenByPrev: Map<string, string[]>,
): { ok: true; nextPrevHash: string | null } | { ok: false; reason: string } {
  // Legacy rows without hashes (pre-2.9) bootstrap the walk.
  if (row.continuityHash == null && row.continuityPrevHash == null) {
    return { ok: true, nextPrevHash: prevHash };
  }

  const prevKey = row.continuityPrevHash ?? "__genesis__";
  const siblings = childrenByPrev.get(prevKey) ?? [];
  siblings.push(row.id);
  childrenByPrev.set(prevKey, siblings);
  if (siblings.length > 1) {
    return { ok: false, reason: "fork_detected" };
  }

  if ((row.continuityPrevHash ?? null) !== prevHash) {
    return {
      ok: false,
      reason: "prev_hash_mismatch",
    };
  }

  if (!row.continuityHash) {
    return { ok: false, reason: "missing_hash" };
  }

  const expected = computeContinuityDigest({
    id: row.id,
    prevHash: row.continuityPrevHash,
    at: row.at.toISOString(),
    actorRole: row.actorRole,
    actorAccountId: row.actorAccountId,
    action: row.action,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    summary: row.summary,
    reason: row.reason,
    requestCorrelationId: row.requestCorrelationId,
    privatePayload: row.privatePayload ?? null,
    synthetic: row.synthetic,
  });

  if (expected !== row.continuityHash) {
    return { ok: false, reason: "digest_mismatch" };
  }

  return { ok: true, nextPrevHash: row.continuityHash };
}

export async function listPublicAuditFeed(
  db: FoundationDb,
  limit = 50,
): Promise<PublicAuditSummary[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.at))
    .limit(Math.min(limit, 200));

  const projected: PublicAuditSummary[] = [];
  for (const row of rows) {
    const summary = projectAuditEventPublic(row, {
      prevHash: row.continuityPrevHash,
      hash: row.continuityHash ?? "",
    });
    if (!summary) {
      continue;
    }
    assertNoProhibitedPublicFields(summary);
    projected.push(summary);
  }
  return projected;
}

export async function searchRestrictedAudit(
  db: FoundationDb,
  actorAccountId: string,
  input: { query?: string; action?: string; limit?: number },
): Promise<
  AdapterResult<
    Array<{
      id: string;
      at: string;
      action: string;
      actorRole: string;
      subjectType: string;
      subjectId: string;
      summary: string;
      reason: string | null;
      synthetic: boolean;
    }>
  >
> {
  const actor = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "audit.read_restricted",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const limit = Math.min(input.limit ?? 50, 200);
  const filters = [];
  if (input.action?.trim()) {
    filters.push(eq(auditEvents.action, input.action.trim()));
  }
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    filters.push(
      or(
        ilike(auditEvents.summary, q),
        ilike(auditEvents.action, q),
        ilike(auditEvents.subjectType, q),
      )!,
    );
  }

  const rows = await db
    .select({
      id: auditEvents.id,
      at: auditEvents.at,
      action: auditEvents.action,
      actorRole: auditEvents.actorRole,
      subjectType: auditEvents.subjectType,
      subjectId: auditEvents.subjectId,
      summary: auditEvents.summary,
      reason: auditEvents.reason,
      synthetic: auditEvents.synthetic,
      privatePayload: auditEvents.privatePayload,
    })
    .from(auditEvents)
    .where(filters.length ? and(...filters) : sql`true`)
    .orderBy(desc(auditEvents.at))
    .limit(limit);

  // Staff search returns metadata but never privatePayload / artifacts.
  return {
    ok: true,
    value: rows.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      action: row.action,
      actorRole: row.actorRole,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      summary: row.summary,
      reason: row.reason,
      synthetic: row.synthetic,
    })),
  };
}
