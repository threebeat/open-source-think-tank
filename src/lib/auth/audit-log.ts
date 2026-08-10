import { auditEvents } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import {
  assertNoSecretsInText,
  redactSensitiveFields,
} from "@/lib/auth/redact";
import { newEntityId } from "@/lib/auth/tokens";

/** Outer DB or in-transaction executor. */
export type AuthAuditDb = FoundationDb | DrizzleTx;

export type AuthAuditInput = {
  actorRole: string;
  actorAccountId?: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  reason?: string;
  privatePayload?: Record<string, unknown>;
  /** Raw secrets that must not appear in summary or payload. */
  forbidSecrets?: string[];
  /**
   * Required. Must match the account when an account is involved; never defaulted
   * to true (real events must not enter the ledger as synthetic).
   */
  synthetic: boolean;
};

export async function appendAuthAudit(db: AuthAuditDb, input: AuthAuditInput) {
  if (typeof input.synthetic !== "boolean") {
    throw new Error("appendAuthAudit requires an explicit synthetic boolean");
  }

  const secrets = input.forbidSecrets ?? [];
  assertNoSecretsInText(input.summary, secrets);
  if (input.reason) {
    assertNoSecretsInText(input.reason, secrets);
  }
  const privatePayload = redactSensitiveFields(input.privatePayload);
  if (privatePayload) {
    assertNoSecretsInText(JSON.stringify(privatePayload), secrets);
  }

  await db.insert(auditEvents).values({
    id: newEntityId("audit"),
    actorRole: input.actorRole,
    actorAccountId: input.actorAccountId ?? null,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    summary: input.summary,
    reason: input.reason,
    privatePayload,
    synthetic: input.synthetic,
  });
}
