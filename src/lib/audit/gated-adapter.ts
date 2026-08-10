import type { FoundationDb } from "@/db/types";
import type {
  AuditEventInput,
  AuditPublishAdapter,
  PublicAuditProjection,
} from "@/lib/adapters/audit-publish";
import type { AdapterResult } from "@/lib/adapters/types";
import { listPublicAuditFeed } from "@/lib/audit/ledger";
import { appendAuthAudit } from "@/lib/auth/audit-log";

/** First-party gated ledger adapter backed by immutable audit_events. */
export class GatedAuditPublishAdapter implements AuditPublishAdapter {
  readonly name = "audit-publish" as const;

  constructor(private readonly db: FoundationDb) {}

  async append(
    event: AuditEventInput,
  ): Promise<AdapterResult<{ id: string }>> {
    try {
      if (typeof event.synthetic !== "boolean") {
        return {
          ok: false,
          error: "Audit append requires an explicit synthetic boolean",
          code: "AUDIT_SYNTHETIC_REQUIRED",
        };
      }
      const result = await appendAuthAudit(this.db, {
        actorRole: event.actorRole,
        actorAccountId: event.actorAccountId,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        summary: event.summary,
        reason: event.reason,
        privatePayload: event.privatePayload,
        requestCorrelationId: event.requestCorrelationId,
        synthetic: event.synthetic,
      });
      return { ok: true, value: { id: result.id } };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Audit append failed",
        code: "AUDIT_APPEND_FAILED",
      };
    }
  }

  async listPublic(
    limit: number,
  ): Promise<AdapterResult<PublicAuditProjection[]>> {
    const rows = await listPublicAuditFeed(this.db, limit);
    return {
      ok: true,
      value: rows.map((row) => ({
        at: row.at,
        action: row.action,
        subjectType: row.subjectType,
        summary: row.summary,
      })),
    };
  }
}
