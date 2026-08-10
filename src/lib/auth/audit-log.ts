import { createHash } from "node:crypto";

import { desc } from "drizzle-orm";

import { auditEvents } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import { isHighImpactAction } from "@/lib/audit/registry";
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
  requestCorrelationId?: string | null;
  /** Raw secrets that must not appear in summary or payload. */
  forbidSecrets?: string[];
  /**
   * Required. Must match the account when an account is involved; never defaulted
   * to true (real events must not enter the ledger as synthetic).
   */
  synthetic: boolean;
};

function continuityDigest(input: {
  id: string;
  prevHash: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  actorAccountId: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: input.id,
        prev: input.prevHash,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        summary: input.summary,
        actorAccountId: input.actorAccountId,
      }),
    )
    .digest("hex");
}

/**
 * Append an immutable audit row with continuity hash.
 * Failures throw — high-impact callers must not swallow errors (fail closed).
 */
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

  const id = newEntityId("audit");
  const [prev] = await db
    .select({
      continuityHash: auditEvents.continuityHash,
    })
    .from(auditEvents)
    .orderBy(desc(auditEvents.at), desc(auditEvents.id))
    .limit(1);
  const continuityPrevHash = prev?.continuityHash ?? null;
  const continuityHash = continuityDigest({
    id,
    prevHash: continuityPrevHash,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    summary: input.summary,
    actorAccountId: input.actorAccountId ?? null,
  });

  try {
    await db.insert(auditEvents).values({
      id,
      actorRole: input.actorRole,
      actorAccountId: input.actorAccountId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      summary: input.summary,
      reason: input.reason,
      privatePayload,
      requestCorrelationId: input.requestCorrelationId ?? null,
      continuityPrevHash,
      continuityHash,
      synthetic: input.synthetic,
    });
  } catch (error) {
    if (isHighImpactAction(input.action)) {
      throw new Error(
        `AUDIT_FAIL_CLOSED:${input.action}:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    throw error;
  }

  return { id, continuityHash, continuityPrevHash };
}
