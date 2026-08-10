import { and, eq } from "drizzle-orm";

import {
  accounts,
  assentOutcomes,
  assentRecords,
  documentVersions,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";

/** Decline a published document without creating an assent record. */
export async function declineDocument(
  db: FoundationDb,
  input: {
    accountId: string;
    documentVersionId: string;
    presentedContentHash: string;
    reason?: string;
  },
): Promise<AdapterResult<{ outcomeId: string }>> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "ASSENT_ACCOUNT_MISSING" };
  }

  const [doc] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, input.documentVersionId))
    .limit(1);
  if (!doc || doc.state !== "published") {
    return {
      ok: false,
      error: "Only published documents can be declined.",
      code: "ASSENT_DOC_NOT_PUBLISHED",
    };
  }
  if (doc.contentHash !== input.presentedContentHash) {
    return {
      ok: false,
      error: "Presented document hash does not match the published version.",
      code: "ASSENT_HASH_MISMATCH",
    };
  }

  const outcomeId = newEntityId("outcome");
  await db.transaction(async (tx) => {
    await tx.insert(assentOutcomes).values({
      id: outcomeId,
      accountId: input.accountId,
      documentVersionId: doc.id,
      contentHash: doc.contentHash,
      outcome: "declined",
      reason: input.reason?.trim() || null,
      synthetic: account.synthetic,
    });
    await appendAuthAudit(tx, {
      actorRole: "account_holder",
      actorAccountId: input.accountId,
      action: "assent.declined",
      subjectType: "assent_outcome",
      subjectId: outcomeId,
      summary: `Document decline recorded for ${doc.kind}.`,
      reason: input.reason?.trim(),
      privatePayload: { documentVersionId: doc.id },
      synthetic: account.synthetic,
    });
  });

  return { ok: true, value: { outcomeId } };
}

/**
 * Withdraw prior assent. The original assent row remains immutable for retention;
 * a withdrawn outcome is appended.
 */
export async function withdrawAssent(
  db: FoundationDb,
  input: {
    accountId: string;
    assentId: string;
    reason?: string;
  },
): Promise<AdapterResult<{ outcomeId: string }>> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "ASSENT_ACCOUNT_MISSING" };
  }

  const [assent] = await db
    .select()
    .from(assentRecords)
    .where(
      and(
        eq(assentRecords.id, input.assentId),
        eq(assentRecords.accountId, input.accountId),
      ),
    )
    .limit(1);
  if (!assent) {
    return {
      ok: false,
      error: "Assent record not found for this account.",
      code: "ASSENT_MISSING",
    };
  }

  const outcomeId = newEntityId("outcome");
  await db.transaction(async (tx) => {
    await tx.insert(assentOutcomes).values({
      id: outcomeId,
      accountId: input.accountId,
      documentVersionId: assent.documentVersionId,
      contentHash: assent.contentHash,
      outcome: "withdrawn",
      priorAssentId: assent.id,
      reason: input.reason?.trim() || null,
      synthetic: account.synthetic,
    });

    // Prove the prior assent row still exists after withdrawal.
    const [retained] = await tx
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.id, assent.id))
      .limit(1);
    if (!retained) {
      throw new Error("ASSENT_RETENTION_VIOLATION");
    }

    await appendAuthAudit(tx, {
      actorRole: "account_holder",
      actorAccountId: input.accountId,
      action: "assent.withdrawn",
      subjectType: "assent_outcome",
      subjectId: outcomeId,
      summary: "Assent withdrawal recorded; prior assent retained.",
      reason: input.reason?.trim(),
      privatePayload: {
        priorAssentId: assent.id,
        documentVersionId: assent.documentVersionId,
      },
      synthetic: account.synthetic,
    });
  });

  return { ok: true, value: { outcomeId } };
}
