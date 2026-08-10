import { eq } from "drizzle-orm";

import { accounts, assentRecords, documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { containsNotLegallyReviewedMarker } from "@/lib/assent/legal-review";
import { consumePresentation } from "@/lib/assent/presentation";

function noticesSatisfied(
  required: string[],
  acknowledged: string[],
): boolean {
  const set = new Set(acknowledged);
  return required.every((notice) => set.has(notice));
}

/**
 * Record assent only after a server-issued presentation of the complete document
 * and acknowledgment of every required notice on that version.
 */
export async function recordAssent(
  db: FoundationDb,
  input: {
    accountId: string;
    documentVersionId: string;
    presentationId: string;
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
  if (containsNotLegallyReviewedMarker(doc.title, doc.body)) {
    return {
      ok: false,
      error:
        "Documents marked “not legally reviewed” cannot receive active assent.",
      code: "ASSENT_NOT_LEGALLY_REVIEWED",
    };
  }
  if (!noticesSatisfied(doc.requiredNotices, input.noticesAcknowledged)) {
    return {
      ok: false,
      error: "All required notices for this document version must be acknowledged.",
      code: "ASSENT_NOTICES_INCOMPLETE",
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
        presentationId: input.presentationId,
        noticesAcknowledged: input.noticesAcknowledged,
      },
      synthetic: account.synthetic,
    });
  });

  return { ok: true, value: { assentId } };
}
