import { and, asc, eq, isNotNull } from "drizzle-orm";

import { moderationActions } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import type {
  ModerationActionKind,
  ModerationVisibility,
} from "@/lib/moderation/schemas";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type ModerationActionRecord = {
  id: string;
  topicId: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  actorAccountId: string;
  action: ModerationActionKind;
  fromVisibility: ModerationVisibility;
  toVisibility: ModerationVisibility;
  publicRationale: string;
  privateNotes: string | null;
  synthetic: boolean;
  createdAt: Date;
};

function mapAction(
  row: typeof moderationActions.$inferSelect,
): ModerationActionRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    actorAccountId: row.actorAccountId,
    action: row.action,
    fromVisibility: row.fromVisibility,
    toVisibility: row.toVisibility,
    publicRationale: row.publicRationale,
    privateNotes: row.privateNotes,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
  };
}

export async function appendModerationAction(
  db: GatedDb,
  input: {
    topicId: string;
    claimId?: string | null;
    evidenceSubmissionId?: string | null;
    actorAccountId: string;
    action: ModerationActionKind;
    fromVisibility: ModerationVisibility;
    toVisibility: ModerationVisibility;
    publicRationale: string;
    privateNotes?: string | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<ModerationActionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }

  const claimId = input.claimId ?? null;
  const evidenceSubmissionId = input.evidenceSubmissionId ?? null;
  if (
    (claimId === null && evidenceSubmissionId === null) ||
    (claimId !== null && evidenceSubmissionId !== null)
  ) {
    return {
      ok: false,
      error: "Moderation action must attach to exactly one subject",
      code: "MODERATION_SUBJECT_INVALID",
    };
  }

  const id = newEntityId("modact");
  const [row] = await db
    .insert(moderationActions)
    .values({
      id,
      topicId: input.topicId,
      claimId,
      evidenceSubmissionId,
      actorAccountId: input.actorAccountId,
      action: input.action,
      fromVisibility: input.fromVisibility,
      toVisibility: input.toVisibility,
      publicRationale: input.publicRationale,
      privateNotes: input.privateNotes ?? null,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to append moderation action",
      code: "MODERATION_ACTION_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapAction(row) };
}

export async function listModerationActionsForClaim(
  db: GatedDb,
  claimId: string,
): Promise<AdapterResult<ModerationActionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(moderationActions)
    .where(
      and(
        eq(moderationActions.claimId, claimId),
        isNotNull(moderationActions.claimId),
      ),
    )
    .orderBy(asc(moderationActions.createdAt));
  return { ok: true, value: rows.map(mapAction) };
}

export async function listModerationActionsForEvidence(
  db: GatedDb,
  evidenceSubmissionId: string,
): Promise<AdapterResult<ModerationActionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(moderationActions)
    .where(
      and(
        eq(moderationActions.evidenceSubmissionId, evidenceSubmissionId),
        isNotNull(moderationActions.evidenceSubmissionId),
      ),
    )
    .orderBy(asc(moderationActions.createdAt));
  return { ok: true, value: rows.map(mapAction) };
}

export async function listModerationActionsForTopic(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<ModerationActionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) {
    return denied;
  }
  const rows = await db
    .select()
    .from(moderationActions)
    .where(eq(moderationActions.topicId, topicId))
    .orderBy(asc(moderationActions.createdAt));
  return { ok: true, value: rows.map(mapAction) };
}

/** Staff DTO — includes private notes; never send to anonymous clients. */
export type StaffModerationActionDto = {
  id: string;
  action: ModerationActionKind;
  fromVisibility: ModerationVisibility;
  toVisibility: ModerationVisibility;
  publicRationale: string;
  privateNotes: string | null;
  createdAt: string;
};

export function toStaffModerationActionDto(
  row: ModerationActionRecord,
): StaffModerationActionDto {
  return {
    id: row.id,
    action: row.action,
    fromVisibility: row.fromVisibility,
    toVisibility: row.toVisibility,
    publicRationale: row.publicRationale,
    privateNotes: row.privateNotes,
    createdAt: row.createdAt.toISOString(),
  };
}
