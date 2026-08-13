import { and, desc, eq, sql } from "drizzle-orm";

import {
  publicInputConversations,
  publicInputConversationTransitions,
} from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import {
  type GatedDb,
  requireGatedPersistence,
} from "@/lib/persistence/gated";

export type PublicInputWorkflowState =
  | "draft"
  | "ready"
  | "open"
  | "commenting_closed"
  | "voting_closed"
  | "closed"
  | "archived";

export type PublicInputProviderAvailability =
  | "not_configured"
  | "available"
  | "degraded"
  | "unavailable";

/** `polis_hosted` / `polis_self_hosted` exist for forward compatibility only — never operational in 4.3. */
export type PublicInputProviderKind =
  | "none"
  | "fixture"
  | "polis_hosted"
  | "polis_self_hosted";

/** Kinds the service layer and DB CHECK constraint currently allow. */
export const OPERATIONAL_PROVIDER_KINDS = ["none", "fixture"] as const;

export type OperationalProviderKind = (typeof OPERATIONAL_PROVIDER_KINDS)[number];

export function isOperationalProviderKind(
  kind: PublicInputProviderKind,
): kind is OperationalProviderKind {
  return (OPERATIONAL_PROVIDER_KINDS as readonly string[]).includes(kind);
}

export type PublicInputConversationDesignation = "current" | "historical";

/**
 * Internal record shape. `providerConversationRef` is protected — callers must
 * route it through `toPublicConsultationView` / staff summaries before it can
 * leave the service layer. Never log or serialize this record directly.
 */
export type ConversationRecord = {
  id: string;
  topicId: string;
  providerKind: PublicInputProviderKind;
  providerConversationRef: string | null;
  workflowState: PublicInputWorkflowState;
  providerAvailability: PublicInputProviderAvailability;
  publicTitle: string;
  publicPrompt: string;
  configurationVersion: number;
  opensAt: Date | null;
  closesAt: Date | null;
  version: number;
  createdByAccountId: string;
  lastTransitionByAccountId: string | null;
  designation: PublicInputConversationDesignation;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationTransitionRecord = {
  id: string;
  conversationId: string;
  fromState: PublicInputWorkflowState | null;
  toState: PublicInputWorkflowState;
  reason: string | null;
  actorAccountId: string;
  isRecovery: boolean;
  synthetic: boolean;
  createdAt: Date;
};

function mapConversation(
  row: typeof publicInputConversations.$inferSelect,
): ConversationRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    providerKind: row.providerKind,
    providerConversationRef: row.providerConversationRef,
    workflowState: row.workflowState,
    providerAvailability: row.providerAvailability,
    publicTitle: row.publicTitle,
    publicPrompt: row.publicPrompt,
    configurationVersion: row.configurationVersion,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    version: row.version,
    createdByAccountId: row.createdByAccountId,
    lastTransitionByAccountId: row.lastTransitionByAccountId,
    designation: row.designation,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTransition(
  row: typeof publicInputConversationTransitions.$inferSelect,
): ConversationTransitionRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    fromState: row.fromState,
    toState: row.toState,
    reason: row.reason,
    actorAccountId: row.actorAccountId,
    isRecovery: row.isRecovery,
    synthetic: row.synthetic,
    createdAt: row.createdAt,
  };
}

export async function insertConversation(
  db: GatedDb,
  input: {
    topicId: string;
    publicTitle: string;
    publicPrompt: string;
    createdByAccountId: string;
    synthetic: boolean;
    opensAt?: Date | null;
    closesAt?: Date | null;
  },
): Promise<AdapterResult<ConversationRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const id = newEntityId("pinconv");
  const [row] = await db
    .insert(publicInputConversations)
    .values({
      id,
      topicId: input.topicId,
      providerKind: "none",
      providerConversationRef: null,
      workflowState: "draft",
      providerAvailability: "not_configured",
      publicTitle: input.publicTitle,
      publicPrompt: input.publicPrompt,
      configurationVersion: 1,
      opensAt: input.opensAt ?? null,
      closesAt: input.closesAt ?? null,
      version: 1,
      createdByAccountId: input.createdByAccountId,
      lastTransitionByAccountId: null,
      designation: "current",
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to insert Public Input conversation",
      code: "PUBLIC_INPUT_CONVERSATION_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapConversation(row) };
}

export async function getConversationById(
  db: GatedDb,
  id: string,
): Promise<AdapterResult<ConversationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputConversations)
    .where(eq(publicInputConversations.id, id))
    .limit(1);
  return { ok: true, value: row ? mapConversation(row) : null };
}

/** The single `designation = 'current'` conversation for a topic, if any. */
export async function getCurrentConversationByTopicId(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<ConversationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;
  const [row] = await db
    .select()
    .from(publicInputConversations)
    .where(
      and(
        eq(publicInputConversations.topicId, topicId),
        eq(publicInputConversations.designation, "current"),
      ),
    )
    .limit(1);
  return { ok: true, value: row ? mapConversation(row) : null };
}

/**
 * Expected-version workflow transition. Never touches providerAvailability,
 * providerKind, or providerConversationRef (independent axes).
 */
export async function updateConversationWorkflow(
  db: GatedDb,
  input: {
    conversationId: string;
    expectedVersion: number;
    nextWorkflowState: PublicInputWorkflowState;
    lastTransitionByAccountId: string;
  },
): Promise<AdapterResult<ConversationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputConversations)
    .set({
      workflowState: input.nextWorkflowState,
      lastTransitionByAccountId: input.lastTransitionByAccountId,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputConversations.id, input.conversationId),
        eq(publicInputConversations.version, input.expectedVersion),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapConversation(row) : null };
}

/**
 * Expected-version provider-availability update. Never touches workflowState
 * (independent axis) — an unavailable provider does not itself change the
 * conversation's institutional workflow state.
 */
export async function updateConversationProviderAvailability(
  db: GatedDb,
  input: {
    conversationId: string;
    expectedVersion: number;
    nextAvailability: PublicInputProviderAvailability;
  },
): Promise<AdapterResult<ConversationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputConversations)
    .set({
      providerAvailability: input.nextAvailability,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputConversations.id, input.conversationId),
        eq(publicInputConversations.version, input.expectedVersion),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapConversation(row) : null };
}

/**
 * Expected-version provider-mapping update (attach / rotate / remove).
 * Bumps `configurationVersion` so staff/audit can see mapping changed without
 * ever exposing the ref itself. `nextKind` is re-validated by the service
 * layer against {@link isOperationalProviderKind} before this is called.
 */
export async function updateConversationProviderMapping(
  db: GatedDb,
  input: {
    conversationId: string;
    expectedVersion: number;
    nextKind: PublicInputProviderKind;
    nextRef: string | null;
  },
): Promise<AdapterResult<ConversationRecord | null>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const [row] = await db
    .update(publicInputConversations)
    .set({
      providerKind: input.nextKind,
      providerConversationRef: input.nextRef,
      configurationVersion: sql`${publicInputConversations.configurationVersion} + 1`,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicInputConversations.id, input.conversationId),
        eq(publicInputConversations.version, input.expectedVersion),
      ),
    )
    .returning();

  return { ok: true, value: row ? mapConversation(row) : null };
}

export async function insertConversationTransition(
  db: GatedDb,
  input: {
    conversationId: string;
    fromState: PublicInputWorkflowState | null;
    toState: PublicInputWorkflowState;
    reason: string | null;
    actorAccountId: string;
    isRecovery: boolean;
    synthetic: boolean;
  },
): Promise<AdapterResult<ConversationTransitionRecord>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const id = newEntityId("pinconvtx");
  const [row] = await db
    .insert(publicInputConversationTransitions)
    .values({
      id,
      conversationId: input.conversationId,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason,
      actorAccountId: input.actorAccountId,
      isRecovery: input.isRecovery,
      synthetic: input.synthetic,
    })
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "Failed to record conversation transition",
      code: "PUBLIC_INPUT_TRANSITION_INSERT_FAILED",
    };
  }
  return { ok: true, value: mapTransition(row) };
}

export async function listConversationTransitions(
  db: GatedDb,
  conversationId: string,
): Promise<AdapterResult<ConversationTransitionRecord[]>> {
  const denied = requireGatedPersistence();
  if (denied) return denied;

  const rows = await db
    .select()
    .from(publicInputConversationTransitions)
    .where(
      eq(publicInputConversationTransitions.conversationId, conversationId),
    )
    .orderBy(desc(publicInputConversationTransitions.createdAt));

  return { ok: true, value: rows.map(mapTransition) };
}
