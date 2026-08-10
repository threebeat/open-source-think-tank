import { and, eq, gt, isNull } from "drizzle-orm";

import { accounts, assentPresentations, documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";

const PRESENTATION_TTL_MS = 60 * 60 * 1000;

/**
 * Open a gated presentation of the full published document for an account.
 * Assent/decline require consuming this presentation.
 */
export async function openDocumentPresentation(
  db: FoundationDb,
  input: { accountId: string; documentVersionId: string },
): Promise<
  AdapterResult<{
    presentationId: string;
    documentVersionId: string;
    contentHash: string;
    title: string;
    body: string;
    kind: string;
    versionLabel: string;
    requiredNotices: string[];
    expiresAt: string;
  }>
> {
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
      error: "Only published documents can be presented for assent.",
      code: "ASSENT_DOC_NOT_PUBLISHED",
    };
  }

  const now = new Date();
  const presentationId = newEntityId("present");
  const expiresAt = new Date(now.getTime() + PRESENTATION_TTL_MS);

  await db.insert(assentPresentations).values({
    id: presentationId,
    accountId: input.accountId,
    documentVersionId: doc.id,
    contentHash: doc.contentHash,
    presentedAt: now,
    expiresAt,
  });

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId: input.accountId,
    action: "assent.document_presented",
    subjectType: "assent_presentation",
    subjectId: presentationId,
    summary: `Full document presented for ${doc.kind}.`,
    privatePayload: { documentVersionId: doc.id, contentHash: doc.contentHash },
    synthetic: account.synthetic,
  });

  return {
    ok: true,
    value: {
      presentationId,
      documentVersionId: doc.id,
      contentHash: doc.contentHash,
      title: doc.title,
      body: doc.body,
      kind: doc.kind,
      versionLabel: doc.versionLabel,
      requiredNotices: doc.requiredNotices,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

/** Claim a presentation for assent/decline (single-use). */
export async function consumePresentation(
  db: FoundationDb,
  input: {
    presentationId: string;
    accountId: string;
    documentVersionId: string;
    contentHash: string;
  },
): Promise<AdapterResult<{ presentationId: string }>> {
  const now = new Date();
  const [claimed] = await db
    .update(assentPresentations)
    .set({ consumedAt: now })
    .where(
      and(
        eq(assentPresentations.id, input.presentationId),
        eq(assentPresentations.accountId, input.accountId),
        eq(assentPresentations.documentVersionId, input.documentVersionId),
        eq(assentPresentations.contentHash, input.contentHash),
        isNull(assentPresentations.consumedAt),
        gt(assentPresentations.expiresAt, now),
      ),
    )
    .returning();

  if (!claimed) {
    return {
      ok: false,
      error: "Document presentation is missing, expired, or already used.",
      code: "ASSENT_PRESENTATION_INVALID",
    };
  }

  return { ok: true, value: { presentationId: claimed.id } };
}
