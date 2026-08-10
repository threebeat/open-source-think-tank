import type { auditEvents } from "@/db/schema";
import { getAuditActionDefinition } from "@/lib/audit/registry";
import { assertNoSensitivePublicContent } from "@/lib/audit/sensitive";

type AuditRow = typeof auditEvents.$inferSelect;

export type PublicAuditSummary = {
  id: string;
  at: string;
  action: string;
  subjectType: string;
  summary: string;
  continuityPrevHash: string | null;
  continuityHash: string;
};

/**
 * Project a ledger row to the public feed using a registry-owned template only.
 * Never republishes the private/caller-authored summary or privatePayload.
 */
export function projectAuditEventPublic(
  row: AuditRow,
  continuity: { prevHash: string | null; hash: string },
): PublicAuditSummary | null {
  const definition = getAuditActionDefinition(row.action);
  if (!definition?.publicProject) {
    return null;
  }

  const payload =
    row.privatePayload && typeof row.privatePayload === "object"
      ? (row.privatePayload as Record<string, unknown>)
      : {};

  let summary: string;
  try {
    summary = definition.publicProject(payload);
  } catch {
    return null;
  }

  const projection: PublicAuditSummary = {
    id: row.id,
    at: row.at.toISOString(),
    action: row.action,
    subjectType: row.subjectType,
    summary,
    continuityPrevHash: continuity.prevHash,
    continuityHash: continuity.hash,
  };

  try {
    assertNoSensitivePublicContent(projection);
  } catch {
    return null;
  }

  return projection;
}

export function assertNoProhibitedPublicFields(
  projection: PublicAuditSummary,
): void {
  assertNoSensitivePublicContent(projection);
}
