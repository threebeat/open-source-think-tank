import { and, desc, eq } from "drizzle-orm";

import { accounts, assentRecords, documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { containsNotLegallyReviewedMarker } from "@/lib/assent/legal-review";

/**
 * Record assent only after the caller presents the complete published document.
 * Uses “assent” vocabulary — not a claim that processing is legal “consent”.
 */
export async function recordAssent(
  db: FoundationDb,
  input: {
    accountId: string;
    documentVersionId: string;
    /** Must match the published document hash the account holder was shown. */
    presentedContentHash: string;
    method: string;
    noticesAcknowledged: string[];
  },
): Promise<AdapterResult<{ assentId: string }>> {
  if (!input.method.trim()) {
    return {
      ok: false,
      error: "Assent method is required.",
      code: "ASSENT_METHOD_REQUIRED",
    };
  }
  if (!Array.isArray(input.noticesAcknowledged)) {
    return {
      ok: false,
      error: "noticesAcknowledged must be an array.",
      code: "ASSENT_NOTICES_REQUIRED",
    };
  }

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
  if (!doc) {
    return { ok: false, error: "Document not found", code: "ASSENT_DOC_MISSING" };
  }
  if (doc.state !== "published") {
    return {
      ok: false,
      error: "Assent is only allowed for currently published documents.",
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
  if (containsNotLegallyReviewedMarker(doc.title, doc.body)) {
    return {
      ok: false,
      error:
        "Documents marked “not legally reviewed” cannot receive active assent.",
      code: "ASSENT_NOT_LEGALLY_REVIEWED",
    };
  }

  const assentId = newEntityId("assent");
  await db.transaction(async (tx) => {
    await tx.insert(assentRecords).values({
      id: assentId,
      accountId: input.accountId,
      documentVersionId: doc.id,
      contentHash: doc.contentHash,
      method: input.method.trim(),
      noticesAcknowledged: input.noticesAcknowledged,
      synthetic: account.synthetic,
    });

    await appendAuthAudit(tx, {
      actorRole: "account_holder",
      actorAccountId: input.accountId,
      action: "assent.recorded",
      subjectType: "assent_record",
      subjectId: assentId,
      summary: `Assent recorded for ${doc.kind} ${doc.versionLabel}.`,
      privatePayload: {
        documentVersionId: doc.id,
        contentHash: doc.contentHash,
        method: input.method.trim(),
      },
      synthetic: account.synthetic,
    });
  });

  return { ok: true, value: { assentId } };
}

export async function listAssentHistory(db: FoundationDb, accountId: string) {
  const assents = await db
    .select({
      assent: assentRecords,
      document: documentVersions,
    })
    .from(assentRecords)
    .innerJoin(
      documentVersions,
      eq(assentRecords.documentVersionId, documentVersions.id),
    )
    .where(eq(assentRecords.accountId, accountId))
    .orderBy(desc(assentRecords.assentedAt));

  return assents.map((row) => ({
    assentId: row.assent.id,
    documentVersionId: row.document.id,
    kind: row.document.kind,
    versionLabel: row.document.versionLabel,
    title: row.document.title,
    contentHash: row.assent.contentHash,
    method: row.assent.method,
    assentedAt: row.assent.assentedAt.toISOString(),
    noticesAcknowledged: row.assent.noticesAcknowledged,
    documentState: row.document.state,
    /** Prior assents remain visible even when the document is no longer current. */
    isCurrentPublished:
      row.document.state === "published" &&
      row.assent.contentHash === row.document.contentHash,
  }));
}

export async function mapActiveAccountToApplicableDocuments(
  db: FoundationDb,
  accountId: string,
) {
  const published = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.state, "published"));

  const result = [];
  for (const doc of published) {
    const [latestAssent] = await db
      .select()
      .from(assentRecords)
      .where(
        and(
          eq(assentRecords.accountId, accountId),
          eq(assentRecords.documentVersionId, doc.id),
          eq(assentRecords.contentHash, doc.contentHash),
        ),
      )
      .orderBy(desc(assentRecords.assentedAt))
      .limit(1);

    result.push({
      documentVersionId: doc.id,
      kind: doc.kind,
      versionLabel: doc.versionLabel,
      title: doc.title,
      contentHash: doc.contentHash,
      body: doc.body,
      requiresAssent: !latestAssent,
      latestAssentId: latestAssent?.id ?? null,
      latestAssentedAt: latestAssent?.assentedAt.toISOString() ?? null,
    });
  }
  return result;
}
