import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { containsNotLegallyReviewedMarker } from "@/lib/assent/legal-review";

export type DocumentKind =
  | "conduct"
  | "participation"
  | "privacy_notice"
  | "other_legal";

export type DocumentState =
  | "draft"
  | "counsel_reviewed"
  | "published"
  | "superseded"
  | "withdrawn";

export function hashDocumentBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function createDraftDocument(
  db: FoundationDb,
  input: {
    kind: DocumentKind;
    versionLabel: string;
    title: string;
    body: string;
    actorAccountId?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ id: string; contentHash: string }>> {
  const id = newEntityId("doc");
  const contentHash = hashDocumentBody(input.body);
  await db.insert(documentVersions).values({
    id,
    kind: input.kind,
    versionLabel: input.versionLabel,
    contentHash,
    title: input.title,
    body: input.body,
    state: "draft",
  });
  await appendAuthAudit(db, {
    actorRole: "document_steward",
    actorAccountId: input.actorAccountId ?? null,
    action: "assent.document_draft_created",
    subjectType: "document_version",
    subjectId: id,
    summary: `Draft ${input.kind} document created.`,
    privatePayload: { kind: input.kind, versionLabel: input.versionLabel },
    synthetic: input.synthetic,
  });
  return { ok: true, value: { id, contentHash } };
}

export async function markCounselReviewed(
  db: FoundationDb,
  input: {
    documentVersionId: string;
    actorAccountId?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<true>> {
  const [doc] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, input.documentVersionId))
    .limit(1);
  if (!doc) {
    return { ok: false, error: "Document not found", code: "ASSENT_DOC_MISSING" };
  }
  if (doc.state !== "draft") {
    return {
      ok: false,
      error: "Only draft documents can move to counsel_reviewed.",
      code: "ASSENT_DOC_STATE",
    };
  }
  await db
    .update(documentVersions)
    .set({ state: "counsel_reviewed", updatedAt: new Date() })
    .where(eq(documentVersions.id, doc.id));
  await appendAuthAudit(db, {
    actorRole: "document_steward",
    actorAccountId: input.actorAccountId ?? null,
    action: "assent.document_counsel_reviewed",
    subjectType: "document_version",
    subjectId: doc.id,
    summary: "Document marked counsel_reviewed (not an approval claim).",
    synthetic: input.synthetic,
  });
  return { ok: true, value: true };
}

/**
 * Publish a document version. Supersedes any currently published version of the
 * same kind in the same transaction. Rejects “not legally reviewed” placeholders.
 */
export async function publishDocument(
  db: FoundationDb,
  input: {
    documentVersionId: string;
    actorAccountId?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<true>> {
  try {
    await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, input.documentVersionId))
        .limit(1);
      if (!doc) {
        throw new Error("ASSENT_DOC_MISSING");
      }
      if (doc.state !== "draft" && doc.state !== "counsel_reviewed") {
        throw new Error("ASSENT_DOC_STATE");
      }
      if (containsNotLegallyReviewedMarker(doc.title, doc.body)) {
        throw new Error("ASSENT_NOT_LEGALLY_REVIEWED");
      }

      const now = new Date();
      const currentPublished = await tx
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.kind, doc.kind),
            eq(documentVersions.state, "published"),
          ),
        );

      for (const prior of currentPublished) {
        await tx
          .update(documentVersions)
          .set({
            state: "superseded",
            supersededAt: now,
            updatedAt: now,
          })
          .where(eq(documentVersions.id, prior.id));
      }

      await tx
        .update(documentVersions)
        .set({
          state: "published",
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(documentVersions.id, doc.id));

      await appendAuthAudit(tx, {
        actorRole: "document_steward",
        actorAccountId: input.actorAccountId ?? null,
        action: "assent.document_published",
        subjectType: "document_version",
        subjectId: doc.id,
        summary: `Document published for kind ${doc.kind}.`,
        privatePayload: {
          kind: doc.kind,
          supersededIds: currentPublished.map((row) => row.id),
        },
        synthetic: input.synthetic,
      });
    });
    return { ok: true, value: true };
  } catch (error) {
    if (error instanceof Error && error.message === "ASSENT_DOC_MISSING") {
      return { ok: false, error: "Document not found", code: error.message };
    }
    if (error instanceof Error && error.message === "ASSENT_DOC_STATE") {
      return {
        ok: false,
        error: "Document cannot be published from its current state.",
        code: error.message,
      };
    }
    if (
      error instanceof Error &&
      error.message === "ASSENT_NOT_LEGALLY_REVIEWED"
    ) {
      return {
        ok: false,
        error:
          "Documents marked “not legally reviewed” cannot become published assent documents.",
        code: error.message,
      };
    }
    throw error;
  }
}

export async function listPublishedDocuments(db: FoundationDb) {
  return db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.state, "published"));
}

export async function getDocumentVersion(
  db: FoundationDb,
  documentVersionId: string,
) {
  const [doc] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, documentVersionId))
    .limit(1);
  return doc ?? null;
}
