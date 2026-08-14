import { and, eq } from "drizzle-orm";

import { publicInputProviderModerationRecords } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type ProviderModerationStatus = "pending" | "accepted" | "rejected";

/**
 * Provider-side moderation shadow record (ADR 0020). `opaqueStatementRef` is
 * a protected fingerprint — never the statement text itself, never public.
 * This table is intentionally mutable (unlike the institutional
 * `public_input_report_moderation_actions` append-only log): it tracks the
 * *current* observed provider-side status for a statement, not a decision
 * history.
 */
export type ProviderModerationRecord = {
  id: string;
  conversationId: string;
  opaqueStatementRef: string;
  status: ProviderModerationStatus;
  reasonCode: string;
  privateNote: string | null;
  actorAccountId: string;
  synthetic: boolean;
  recordedAt: Date;
  updatedAt: Date;
};

function mapRecord(
  row: typeof publicInputProviderModerationRecords.$inferSelect,
): ProviderModerationRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    opaqueStatementRef: row.opaqueStatementRef,
    status: row.status,
    reasonCode: row.reasonCode,
    privateNote: row.privateNote,
    actorAccountId: row.actorAccountId,
    synthetic: row.synthetic,
    recordedAt: row.recordedAt,
    updatedAt: row.updatedAt,
  };
}

export async function getProviderModerationRecord(
  db: GatedDb,
  input: { conversationId: string; opaqueStatementRef: string },
): Promise<AdapterResult<ProviderModerationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputProviderModerationRecords)
    .where(
      and(
        eq(
          publicInputProviderModerationRecords.conversationId,
          input.conversationId,
        ),
        eq(
          publicInputProviderModerationRecords.opaqueStatementRef,
          input.opaqueStatementRef,
        ),
      ),
    )
    .limit(1);
  return { ok: true, value: row ? mapRecord(row) : null };
}

/**
 * Insert-or-update the current observed status for an opaque statement
 * reference. Never inserts the underlying statement text (there is no
 * column for it) — see ADR 0020.
 */
export async function upsertProviderModerationRecord(
  db: GatedDb,
  input: {
    conversationId: string;
    opaqueStatementRef: string;
    status: ProviderModerationStatus;
    reasonCode: string;
    privateNote: string | null;
    actorAccountId: string;
    synthetic: boolean;
  },
): Promise<AdapterResult<ProviderModerationRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .insert(publicInputProviderModerationRecords)
    .values({
      id: newEntityId("pinprov"),
      conversationId: input.conversationId,
      opaqueStatementRef: input.opaqueStatementRef,
      status: input.status,
      reasonCode: input.reasonCode,
      privateNote: input.privateNote,
      actorAccountId: input.actorAccountId,
      synthetic: input.synthetic,
    })
    .onConflictDoUpdate({
      target: [
        publicInputProviderModerationRecords.conversationId,
        publicInputProviderModerationRecords.opaqueStatementRef,
      ],
      set: {
        status: input.status,
        reasonCode: input.reasonCode,
        privateNote: input.privateNote,
        actorAccountId: input.actorAccountId,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to record provider moderation status",
      code: "PROVIDER_MODERATION_RECORD_UPSERT_FAILED",
    };
  }
  return { ok: true, value: mapRecord(row) };
}
