import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { contentRevisions } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";
import {
  claimChangedFieldsSchema,
  claimContentSnapshotSchema,
  evidenceChangedFieldsSchema,
  evidenceContentSnapshotSchema,
  type ClaimContentSnapshot,
  type EvidenceContentSnapshot,
} from "@/lib/revisions/schemas";

export type ContentRevisionRecord = {
  id: string;
  topicId: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  revisionNumber: number;
  editorAccountId: string;
  changedFields: string[];
  beforeSnapshot: ClaimContentSnapshot | EvidenceContentSnapshot;
  afterSnapshot: ClaimContentSnapshot | EvidenceContentSnapshot;
  synthetic: boolean;
  createdAt: Date;
};

function mapRevision(
  row: typeof contentRevisions.$inferSelect,
): ContentRevisionRecord {
  const isClaim = row.claimId !== null;
  const before = isClaim
    ? claimContentSnapshotSchema.parse(row.beforeSnapshot)
    : evidenceContentSnapshotSchema.parse(row.beforeSnapshot);
  const after = isClaim
    ? claimContentSnapshotSchema.parse(row.afterSnapshot)
    : evidenceContentSnapshotSchema.parse(row.afterSnapshot);
  const changedFields = isClaim
    ? claimChangedFieldsSchema.parse(row.changedFields)
    : evidenceChangedFieldsSchema.parse(row.changedFields);

  return {
    id: row.id,
    topicId: row.topicId,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    revisionNumber: row.revisionNumber,
    editorAccountId: row.editorAccountId,
    changedFields: [...changedFields],
    beforeSnapshot: before,
    afterSnapshot: after,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
  };
}

async function nextRevisionNumber(
  db: GatedDb,
  subject: { claimId: string } | { evidenceSubmissionId: string },
): Promise<number> {
  if ("claimId" in subject) {
    const [row] = await db
      .select({
        max: sql<number>`coalesce(max(${contentRevisions.revisionNumber}), 0)`,
      })
      .from(contentRevisions)
      .where(eq(contentRevisions.claimId, subject.claimId));
    return Number(row?.max ?? 0) + 1;
  }
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${contentRevisions.revisionNumber}), 0)`,
    })
    .from(contentRevisions)
    .where(
      eq(contentRevisions.evidenceSubmissionId, subject.evidenceSubmissionId),
    );
  return Number(row?.max ?? 0) + 1;
}

export async function insertClaimContentRevision(
  db: GatedDb,
  input: {
    topicId: string;
    claimId: string;
    editorAccountId: string;
    changedFields: string[];
    beforeSnapshot: ClaimContentSnapshot;
    afterSnapshot: ClaimContentSnapshot;
    synthetic: boolean;
  },
): Promise<AdapterResult<ContentRevisionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const before = claimContentSnapshotSchema.parse(input.beforeSnapshot);
  const after = claimContentSnapshotSchema.parse(input.afterSnapshot);
  const changedFields = claimChangedFieldsSchema.parse(input.changedFields);

  const revisionNumber = await nextRevisionNumber(db, {
    claimId: input.claimId,
  });
  const id = newEntityId("crev");

  try {
    const [row] = await db
      .insert(contentRevisions)
      .values({
        id,
        topicId: input.topicId,
        claimId: input.claimId,
        evidenceSubmissionId: null,
        revisionNumber,
        editorAccountId: input.editorAccountId,
        changedFields: [...changedFields],
        beforeSnapshot: before,
        afterSnapshot: after,
        synthetic: input.synthetic,
      })
      .returning();
    if (!row) {
      return { ok: false, error: "Revision insert failed", code: "REVISION_INSERT_FAILED" };
    }
    return { ok: true, value: mapRevision(row) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("content_revisions_claim_revision_uidx")) {
      return {
        ok: false,
        error: "Revision number conflict",
        code: "REVISION_SEQUENCE_CONFLICT",
      };
    }
    throw error;
  }
}

export async function insertEvidenceContentRevision(
  db: GatedDb,
  input: {
    topicId: string;
    evidenceSubmissionId: string;
    editorAccountId: string;
    changedFields: string[];
    beforeSnapshot: EvidenceContentSnapshot;
    afterSnapshot: EvidenceContentSnapshot;
    synthetic: boolean;
  },
): Promise<AdapterResult<ContentRevisionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const before = evidenceContentSnapshotSchema.parse(input.beforeSnapshot);
  const after = evidenceContentSnapshotSchema.parse(input.afterSnapshot);
  const changedFields = evidenceChangedFieldsSchema.parse(input.changedFields);

  const revisionNumber = await nextRevisionNumber(db, {
    evidenceSubmissionId: input.evidenceSubmissionId,
  });
  const id = newEntityId("crev");

  try {
    const [row] = await db
      .insert(contentRevisions)
      .values({
        id,
        topicId: input.topicId,
        claimId: null,
        evidenceSubmissionId: input.evidenceSubmissionId,
        revisionNumber,
        editorAccountId: input.editorAccountId,
        changedFields: [...changedFields],
        beforeSnapshot: before,
        afterSnapshot: after,
        synthetic: input.synthetic,
      })
      .returning();
    if (!row) {
      return { ok: false, error: "Revision insert failed", code: "REVISION_INSERT_FAILED" };
    }
    return { ok: true, value: mapRevision(row) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("content_revisions_evidence_revision_uidx")) {
      return {
        ok: false,
        error: "Revision number conflict",
        code: "REVISION_SEQUENCE_CONFLICT",
      };
    }
    throw error;
  }
}

export async function listClaimContentRevisions(
  db: GatedDb,
  claimId: string,
): Promise<AdapterResult<ContentRevisionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const rows = await db
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.claimId, claimId))
    .orderBy(asc(contentRevisions.revisionNumber));

  return { ok: true, value: rows.map(mapRevision) };
}

export async function listEvidenceContentRevisions(
  db: GatedDb,
  evidenceSubmissionId: string,
): Promise<AdapterResult<ContentRevisionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const rows = await db
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.evidenceSubmissionId, evidenceSubmissionId))
    .orderBy(asc(contentRevisions.revisionNumber));

  return { ok: true, value: rows.map(mapRevision) };
}

/** Batched subject histories for staff topic-scoped reads (deterministic). */
export async function listContentRevisionsForClaims(
  db: GatedDb,
  claimIds: string[],
): Promise<AdapterResult<ContentRevisionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  if (claimIds.length === 0) return { ok: true, value: [] };

  const rows = await db
    .select()
    .from(contentRevisions)
    .where(
      and(
        isNotNull(contentRevisions.claimId),
        inArray(contentRevisions.claimId, claimIds),
      ),
    )
    .orderBy(
      asc(contentRevisions.claimId),
      asc(contentRevisions.revisionNumber),
    );

  return { ok: true, value: rows.map(mapRevision) };
}

export async function listContentRevisionsForEvidence(
  db: GatedDb,
  evidenceSubmissionIds: string[],
): Promise<AdapterResult<ContentRevisionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  if (evidenceSubmissionIds.length === 0) return { ok: true, value: [] };

  const rows = await db
    .select()
    .from(contentRevisions)
    .where(
      and(
        isNotNull(contentRevisions.evidenceSubmissionId),
        inArray(contentRevisions.evidenceSubmissionId, evidenceSubmissionIds),
      ),
    )
    .orderBy(
      asc(contentRevisions.evidenceSubmissionId),
      asc(contentRevisions.revisionNumber),
    );

  return { ok: true, value: rows.map(mapRevision) };
}

export async function countContentRevisionsForSubjects(
  db: GatedDb,
  input: {
    claimIds: string[];
    evidenceSubmissionIds: string[];
  },
): Promise<
  AdapterResult<{
    byClaimId: Map<string, { count: number; latestAt: Date | null; changedFieldUnion: string[] }>;
    byEvidenceId: Map<
      string,
      { count: number; latestAt: Date | null; changedFieldUnion: string[] }
    >;
  }>
> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const byClaimId = new Map<
    string,
    { count: number; latestAt: Date | null; changedFieldUnion: string[] }
  >();
  const byEvidenceId = new Map<
    string,
    { count: number; latestAt: Date | null; changedFieldUnion: string[] }
  >();

  if (input.claimIds.length > 0) {
    const claimRows = await listContentRevisionsForClaims(db, input.claimIds);
    if (!claimRows.ok) return claimRows;
    for (const row of claimRows.value) {
      if (!row.claimId) continue;
      const existing = byClaimId.get(row.claimId) ?? {
        count: 0,
        latestAt: null,
        changedFieldUnion: [],
      };
      existing.count += 1;
      existing.latestAt = row.createdAt;
      for (const field of row.changedFields) {
        if (!existing.changedFieldUnion.includes(field)) {
          existing.changedFieldUnion.push(field);
        }
      }
      byClaimId.set(row.claimId, existing);
    }
  }

  if (input.evidenceSubmissionIds.length > 0) {
    const evidenceRows = await listContentRevisionsForEvidence(
      db,
      input.evidenceSubmissionIds,
    );
    if (!evidenceRows.ok) return evidenceRows;
    for (const row of evidenceRows.value) {
      if (!row.evidenceSubmissionId) continue;
      const existing = byEvidenceId.get(row.evidenceSubmissionId) ?? {
        count: 0,
        latestAt: null,
        changedFieldUnion: [],
      };
      existing.count += 1;
      existing.latestAt = row.createdAt;
      for (const field of row.changedFields) {
        if (!existing.changedFieldUnion.includes(field)) {
          existing.changedFieldUnion.push(field);
        }
      }
      byEvidenceId.set(row.evidenceSubmissionId, existing);
    }
  }

  return { ok: true, value: { byClaimId, byEvidenceId } };
}

/** Latest revision timestamp for chronology comparisons (staff UI). */
export async function getLatestRevisionCreatedAt(
  db: GatedDb,
  subject: { claimId: string } | { evidenceSubmissionId: string },
): Promise<AdapterResult<Date | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const rows =
    "claimId" in subject
      ? await db
          .select({ createdAt: contentRevisions.createdAt })
          .from(contentRevisions)
          .where(eq(contentRevisions.claimId, subject.claimId))
          .orderBy(desc(contentRevisions.revisionNumber))
          .limit(1)
      : await db
          .select({ createdAt: contentRevisions.createdAt })
          .from(contentRevisions)
          .where(
            eq(
              contentRevisions.evidenceSubmissionId,
              subject.evidenceSubmissionId,
            ),
          )
          .orderBy(desc(contentRevisions.revisionNumber))
          .limit(1);

  return { ok: true, value: rows[0]?.createdAt ?? null };
}
