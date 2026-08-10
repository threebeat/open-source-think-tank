import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { documentVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { containsNotLegallyReviewedMarker } from "@/lib/assent/legal-review";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";

export type DocumentKind =
  | "conduct"
  | "participation"
  | "privacy_notice"
  | "other_legal";

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
    requiredNotices: string[];
    actorAccountId: string;
  },
): Promise<AdapterResult<{ id: string; contentHash: string }>> {
  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "documents.publish",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

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
    requiredNotices: input.requiredNotices,
  });
  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "assent.document_draft_created",
    subjectType: "document_version",
    subjectId: id,
    summary: `Draft ${input.kind} document created.`,
    privatePayload: {
      kind: input.kind,
      versionLabel: input.versionLabel,
      requiredNotices: input.requiredNotices,
    },
    synthetic: decision.principal.synthetic,
  });
  return { ok: true, value: { id, contentHash } };
}

export async function markCounselReviewed(
  db: FoundationDb,
  input: {
    documentVersionId: string;
    actorAccountId: string;
  },
): Promise<AdapterResult<true>> {
  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "documents.publish",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

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

  const now = new Date();
  await db
    .update(documentVersions)
    .set({
      state: "counsel_reviewed",
      counselReviewedAt: now,
      counselReviewedByAccountId: input.actorAccountId,
      updatedAt: now,
    })
    .where(eq(documentVersions.id, doc.id));

  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "assent.document_counsel_reviewed",
    subjectType: "document_version",
    subjectId: doc.id,
    summary:
      "Document marked counsel_reviewed (engineering provenance; not a counsel clearance claim).",
    privatePayload: { counselReviewedAt: now.toISOString() },
    synthetic: decision.principal.synthetic,
  });
  return { ok: true, value: true };
}

/**
 * Publish only from counsel_reviewed. Publisher and synthetic classification are
 * derived from the authorized actor — never caller-supplied.
 */
export async function publishDocument(
  db: FoundationDb,
  input: {
    documentVersionId: string;
    actorAccountId: string;
  },
): Promise<AdapterResult<true>> {
  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "documents.publish",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

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
      if (doc.state !== "counsel_reviewed") {
        throw new Error("ASSENT_DOC_STATE");
      }
      if (!doc.counselReviewedAt) {
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
          publishedByAccountId: input.actorAccountId,
          updatedAt: now,
        })
        .where(eq(documentVersions.id, doc.id));

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "assent.document_published",
        subjectType: "document_version",
        subjectId: doc.id,
        summary: `Document published for kind ${doc.kind}.`,
        privatePayload: {
          kind: doc.kind,
          supersededIds: currentPublished.map((row) => row.id),
          counselReviewedAt: doc.counselReviewedAt?.toISOString(),
          counselReviewedByAccountId: doc.counselReviewedByAccountId,
        },
        synthetic: decision.principal.synthetic,
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
        error: "Document must be counsel_reviewed before publication.",
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
