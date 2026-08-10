import type { auditEvents } from "@/db/schema";
import {
  AUDIT_EVENT_REGISTRY,
  PROHIBITED_PUBLIC_PAYLOAD_KEYS,
} from "@/lib/audit/registry";

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

function containsProhibited(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return PROHIBITED_PUBLIC_PAYLOAD_KEYS.some((key) =>
      value.toLowerCase().includes(key.toLowerCase()),
    );
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (
        PROHIBITED_PUBLIC_PAYLOAD_KEYS.includes(
          key as (typeof PROHIBITED_PUBLIC_PAYLOAD_KEYS)[number],
        )
      ) {
        return true;
      }
      if (containsProhibited(nested)) {
        return true;
      }
    }
  }
  return false;
}

/** Redact a ledger row into a public summary, or null if not projectable. */
export function projectAuditEventPublic(
  row: AuditRow,
  continuity: { prevHash: string | null; hash: string },
): PublicAuditSummary | null {
  const schema = AUDIT_EVENT_REGISTRY[row.action];
  if (!schema?.publicProjectionAllowed) {
    return null;
  }
  if (row.privatePayload && containsProhibited(row.privatePayload)) {
    // Fail closed for public projection — never emit a contradictory public row.
    return null;
  }
  if (containsProhibited(row.summary) || containsProhibited(row.subjectId)) {
    return null;
  }

  return {
    id: row.id,
    at: row.at.toISOString(),
    action: row.action,
    subjectType: row.subjectType,
    summary: row.summary,
    continuityPrevHash: continuity.prevHash,
    continuityHash: continuity.hash,
  };
}

export function assertNoProhibitedPublicFields(
  projection: PublicAuditSummary,
): void {
  const blob = JSON.stringify(projection);
  for (const key of PROHIBITED_PUBLIC_PAYLOAD_KEYS) {
    if (blob.includes(`"${key}"`)) {
      throw new Error(`Public audit projection contains prohibited field ${key}`);
    }
  }
}
