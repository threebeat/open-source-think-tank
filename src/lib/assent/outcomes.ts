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
import { consumePresentation } from "@/lib/assent/presentation";
import { latestAssentStillCurrent } from "@/lib/assent/status";

/** Decline a published document after a full presentation. */
export async function declineDocument(
  db: FoundationDb,
  input: {
    accountId: string;
    documentVersionId: string;
    presentationId: string;
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

  const presentation = await consumePresentation(db, {
    presentationId: input.presentationId,
    accountId: input.accountId,
    documentVersionId: doc.id,
    contentHash: doc.contentHash,
  });
  if (!presentation.ok) {
    return presentation;
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
      privatePayload: {
        documentVersionId: doc.id,
        presentationId: input.presentationId,
      },
      synthetic: account.synthetic,
    });
  });

  return { ok: true, value: { outcomeId } };
}

/**
 * Withdraw prior assent. The original assent row remains immutable;
 * repeated withdrawals of the same assent are rejected.
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

  const stillCurrent = await latestAssentStillCurrent(
    db,
    input.accountId,
    input.assentId,
  );
  if (!stillCurrent) {
    return {
      ok: false,
      error: "Assent is not current or was already withdrawn.",
      code: "ASSENT_NOT_CURRENT",
    };
  }

  const [existingWithdrawal] = await db
    .select()
    .from(assentOutcomes)
    .where(
      and(
        eq(assentOutcomes.priorAssentId, assent.id),
        eq(assentOutcomes.outcome, "withdrawn"),
      ),
    )
    .limit(1);
  if (existingWithdrawal) {
    return {
      ok: false,
      error: "This assent has already been withdrawn.",
      code: "ASSENT_ALREADY_WITHDRAWN",
    };
  }

  const outcomeId = newEntityId("outcome");
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("assent_outcomes_one_withdrawn_per_assent")) {
      return {
        ok: false,
        error: "This assent has already been withdrawn.",
        code: "ASSENT_ALREADY_WITHDRAWN",
      };
    }
    throw error;
  }

  return { ok: true, value: { outcomeId } };
}
