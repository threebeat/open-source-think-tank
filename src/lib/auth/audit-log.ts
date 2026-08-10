import { desc, eq, sql } from "drizzle-orm";

import { auditEvents, auditLedgerHead } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import { computeContinuityDigest } from "@/lib/audit/continuity";
import {
  isHighImpactAction,
  validateAuditAppend,
} from "@/lib/audit/registry";
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
  /** Private institutional summary — never used as a public projection. */
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
  /** Optional explicit timestamp; assigned before hashing when omitted. */
  at?: Date;
};

const LEDGER_HEAD_ID = "default";

async function runInTransaction<T>(
  db: AuthAuditDb,
  fn: (tx: DrizzleTx) => Promise<T>,
): Promise<T> {
  // Nested calls (already inside a tx) use a SAVEPOINT; FOR UPDATE still serializes.
  return (db as FoundationDb).transaction(async (tx) => fn(tx));
}

/**
 * Append an immutable audit row with continuity hash.
 * Appends are serialized via a locked ledger-head row.
 * Failures throw — high-impact callers must not swallow errors (fail closed).
 */
export async function appendAuthAudit(db: AuthAuditDb, input: AuthAuditInput) {
  if (typeof input.synthetic !== "boolean") {
    throw new Error("appendAuthAudit requires an explicit synthetic boolean");
  }

  const { privatePayload: validatedPayload } = validateAuditAppend({
    action: input.action,
    actorAccountId: input.actorAccountId,
    reason: input.reason,
    privatePayload: input.privatePayload,
  });

  const secrets = input.forbidSecrets ?? [];
  assertNoSecretsInText(input.summary, secrets);
  if (input.reason) {
    assertNoSecretsInText(input.reason, secrets);
  }
  const privatePayload = redactSensitiveFields(validatedPayload) ?? null;
  if (privatePayload) {
    assertNoSecretsInText(JSON.stringify(privatePayload), secrets);
  }

  const id = newEntityId("audit");
  const actorAccountId = input.actorAccountId ?? null;
  const reason = input.reason ?? null;
  const requestCorrelationId = input.requestCorrelationId ?? null;

  try {
    return await runInTransaction(db, async (tx) => {
      await tx.execute(
        sql`SELECT id FROM audit_ledger_head WHERE id = ${LEDGER_HEAD_ID} FOR UPDATE`,
      );

      const [head] = await tx
        .select()
        .from(auditLedgerHead)
        .where(eq(auditLedgerHead.id, LEDGER_HEAD_ID))
        .limit(1);

      if (!head) {
        throw new Error("AUDIT_LEDGER_HEAD_MISSING");
      }

      // Keep (at, id) order aligned with the hash chain under concurrency.
      const [latest] = await tx
        .select({ at: auditEvents.at })
        .from(auditEvents)
        .orderBy(desc(auditEvents.at), desc(auditEvents.id))
        .limit(1);
      let at = input.at ?? new Date();
      if (latest && at.getTime() <= latest.at.getTime()) {
        at = new Date(latest.at.getTime() + 1);
      }
      const atIso = at.toISOString();

      const continuityPrevHash = head.headHash ?? null;
      const continuityHash = computeContinuityDigest({
        id,
        prevHash: continuityPrevHash,
        at: atIso,
        actorRole: input.actorRole,
        actorAccountId,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        summary: input.summary,
        reason,
        requestCorrelationId,
        privatePayload,
        synthetic: input.synthetic,
      });

      await tx.insert(auditEvents).values({
        id,
        at,
        actorRole: input.actorRole,
        actorAccountId,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        summary: input.summary,
        reason: reason ?? undefined,
        privatePayload: privatePayload ?? undefined,
        requestCorrelationId,
        continuityPrevHash,
        continuityHash,
        synthetic: input.synthetic,
      });

      await tx
        .update(auditLedgerHead)
        .set({
          headEventId: id,
          headHash: continuityHash,
          updatedAt: new Date(),
        })
        .where(eq(auditLedgerHead.id, LEDGER_HEAD_ID));

      return { id, continuityHash, continuityPrevHash, at };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("AUDIT_UNREGISTERED_ACTION:") ||
        error.message.startsWith("AUDIT_ACTOR_REQUIRED:") ||
        error.message.startsWith("AUDIT_REASON_REQUIRED:") ||
        error.message.startsWith("AUDIT_PAYLOAD_INVALID:") ||
        error.message === "AUDIT_LEDGER_HEAD_MISSING" ||
        error.message === "appendAuthAudit requires an explicit synthetic boolean")
    ) {
      throw error;
    }
    if (isHighImpactAction(input.action)) {
      throw new Error(
        `AUDIT_FAIL_CLOSED:${input.action}:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    throw error;
  }
}
