import { auditEvents } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import {
  assertNoSecretsInText,
  redactSensitiveFields,
} from "@/lib/auth/redact";
import { newEntityId } from "@/lib/auth/tokens";

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
  synthetic?: boolean;
};

export async function appendAuthAudit(db: FoundationDb, input: AuthAuditInput) {
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
    synthetic: input.synthetic ?? true,
  });
}
