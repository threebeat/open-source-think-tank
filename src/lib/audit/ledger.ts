import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { auditEvents } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import {
  assertNoProhibitedPublicFields,
  projectAuditEventPublic,
  type PublicAuditSummary,
} from "@/lib/audit/project-public";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";

/** Continuity check — detects broken hash chains (not absolute tamper-proof). */
export async function verifyAuditContinuity(
  db: FoundationDb,
  limit = 500,
): Promise<{ ok: boolean; checked: number; breakAtId: string | null }> {
  const rows = await db
    .select()
    .from(auditEvents)
    .orderBy(auditEvents.at, auditEvents.id)
    .limit(limit);

  let prevHash: string | null = null;
  for (const row of rows) {
    if ((row.continuityPrevHash ?? null) !== prevHash) {
      // Allow legacy rows without hashes (pre-2.9) to bootstrap.
      if (row.continuityHash == null && row.continuityPrevHash == null) {
        prevHash = null;
        continue;
      }
      return { ok: false, checked: rows.length, breakAtId: row.id };
    }
    prevHash = row.continuityHash;
  }
  return { ok: true, checked: rows.length, breakAtId: null };
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
