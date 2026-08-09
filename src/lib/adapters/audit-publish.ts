import type { AdapterResult } from "@/lib/adapters/types";

export type AuditEventInput = {
  actorRole: string;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  /** Private payload — never projected to the public feed. */
  privatePayload?: Record<string, unknown>;
};

export type PublicAuditProjection = {
  at: string;
  action: string;
  subjectType: string;
  summary: string;
};

/**
 * First-party audit ledger write + allowlisted public projection (package 2.9).
 */
export interface AuditPublishAdapter {
  readonly name: "audit-publish";
  append(event: AuditEventInput): Promise<AdapterResult<{ id: string }>>;
  listPublic(limit: number): Promise<AdapterResult<PublicAuditProjection[]>>;
}

export class InMemoryDeniedAuditAdapter implements AuditPublishAdapter {
  readonly name = "audit-publish" as const;

  async append(
    _event: AuditEventInput,
  ): Promise<AdapterResult<{ id: string }>> {
    return {
      ok: false,
      error: "Gated audit ledger is not available in public-demo mode",
      code: "PUBLIC_DEMO_NO_AUDIT_LEDGER",
    };
  }

  async listPublic(
    _limit: number,
  ): Promise<AdapterResult<PublicAuditProjection[]>> {
    return { ok: true, value: [] };
  }
}
