import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  isValidOpaqueConversationRef,
} from "@/lib/public-input/lifecycle/embed-url";
import {
  getCurrentConversationByTopicId,
  insertConversation,
  insertConversationTransition,
  isOperationalProviderKind,
  updateConversationProviderAvailability,
  updateConversationProviderMapping,
  updateConversationWorkflow,
  type ConversationRecord,
  type PublicInputProviderAvailability,
  type PublicInputProviderKind,
  type PublicInputWorkflowState,
} from "@/lib/public-input/lifecycle/repository";
import { assertNoProviderRefInText } from "@/lib/public-input/lifecycle/sanitize-log";
import {
  findForwardTransitionRule,
  findRecoveryTransitionRule,
  isSubstantiveReason,
  type PublicInputTransitionAction,
} from "@/lib/public-input/lifecycle/transitions";
import {
  toPublicConsultationView,
  toStaffConsultationSummary,
  type PublicConsultationView,
  type StaffConsultationSummary,
} from "@/lib/public-input/lifecycle/types";

const MAX_TITLE = 200;
const MAX_PROMPT = 2000;
const MIN_REASON = 8;

export const createConversationInputSchema = z.object({
  topicId: z.string().trim().min(1),
  publicTitle: z.string().trim().min(1).max(MAX_TITLE),
  publicPrompt: z.string().trim().min(1).max(MAX_PROMPT),
  opensAt: z.string().datetime({ offset: true }).nullable().optional(),
  closesAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const transitionConversationInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(MIN_REASON).max(2000).optional(),
});

export const setProviderAvailabilityInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  availability: z.enum(["not_configured", "available", "degraded", "unavailable"]),
  reason: z.string().trim().min(MIN_REASON).max(2000).optional(),
});

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Public Input conversation lifecycle unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_CONSULTATIONS",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }>,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function withDecisionThrow<T>(
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}

/**
 * Create a topic's conversation. Fails with `TOPIC_ALREADY_HAS_CURRENT_CONVERSATION`
 * if a `designation = 'current'` row already exists (also enforced by the DB
 * unique partial index as the authoritative guard under races).
 */
export async function createConversation(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId: string;
    publicTitle: string;
    publicPrompt: string;
    opensAt?: string | null;
    closesAt?: string | null;
  },
): Promise<AdapterResult<ConversationRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = createConversationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid Public Input conversation input",
      code: "CONSULTATION_INPUT_INVALID",
    };
  }

  try {
    return await withDecisionThrow(() =>
      db.transaction(async (tx) => {
        const principal = await loadPrincipal(tx, input.actorAccountId);
        const decision = await authorizeCapability(
          tx,
          principal,
          "consultations.create",
        );
        if (!decision.ok) {
          throw Object.assign(new Error(decision.code), { decision });
        }

        const existing = await getCurrentConversationByTopicId(
          tx,
          parsed.data.topicId,
        );
        if (!existing.ok) {
          throw new Error(existing.code);
        }
        if (existing.value) {
          throw new Error("TOPIC_ALREADY_HAS_CURRENT_CONVERSATION");
        }

        const inserted = await insertConversation(tx, {
          topicId: parsed.data.topicId,
          publicTitle: parsed.data.publicTitle,
          publicPrompt: parsed.data.publicPrompt,
          createdByAccountId: decision.principal.accountId,
          synthetic: decision.principal.synthetic,
          opensAt: parsed.data.opensAt ? new Date(parsed.data.opensAt) : null,
          closesAt: parsed.data.closesAt
            ? new Date(parsed.data.closesAt)
            : null,
        });
        if (!inserted.ok) {
          throw new Error(inserted.code);
        }

        const transition = await insertConversationTransition(tx, {
          conversationId: inserted.value.id,
          fromState: null,
          toState: "draft",
          reason: null,
          actorAccountId: decision.principal.accountId,
          isRecovery: false,
          synthetic: decision.principal.synthetic,
        });
        if (!transition.ok) {
          throw new Error(transition.code);
        }

        await appendAuthAudit(tx, {
          actorRole: "administrator",
          actorAccountId: decision.principal.accountId,
          action: "consultations.created",
          subjectType: "public_input_conversation",
          subjectId: inserted.value.id,
          summary: "Public Input conversation draft created.",
          privatePayload: {
            conversationId: inserted.value.id,
            topicId: inserted.value.topicId,
            capability: "consultations.create",
            actorAccountId: decision.principal.accountId,
          },
          synthetic: decision.principal.synthetic,
        });

        return { ok: true as const, value: inserted.value };
      }),
    );
  } catch (error) {
    return mapServiceError(error, "CONSULTATION_CREATE_FAILED");
  }
}

/** Ordinary forward-pipeline transition (never touches provider fields). */
export async function transitionConversation(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    action: PublicInputTransitionAction;
    expectedWorkflowState: PublicInputWorkflowState;
    expectedVersion: number;
    reason?: string;
  },
): Promise<AdapterResult<ConversationRecord>> {
  return applyTransition(db, {
    actorAccountId: input.actorAccountId,
    conversationId: input.conversationId,
    expectedWorkflowState: input.expectedWorkflowState,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
    isRecovery: false,
    rule: findForwardTransitionRule(input.action, input.expectedWorkflowState),
  });
}

/**
 * Out-of-pipeline recovery transition. Always requires a substantive reason
 * and is always recorded with `isRecovery = true` under the distinct
 * `consultations.recovery_transition` audit action.
 */
export async function recoverConversation(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedWorkflowState: PublicInputWorkflowState;
    targetWorkflowState: PublicInputWorkflowState;
    expectedVersion: number;
    reason: string;
  },
): Promise<AdapterResult<ConversationRecord>> {
  return applyTransition(db, {
    actorAccountId: input.actorAccountId,
    conversationId: input.conversationId,
    expectedWorkflowState: input.expectedWorkflowState,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
    isRecovery: true,
    rule: findRecoveryTransitionRule(
      input.expectedWorkflowState,
      input.targetWorkflowState,
    ),
  });
}

async function applyTransition(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedWorkflowState: PublicInputWorkflowState;
    expectedVersion: number;
    reason?: string;
    isRecovery: boolean;
    rule: ReturnType<typeof findForwardTransitionRule>;
  },
): Promise<AdapterResult<ConversationRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = transitionConversationInputSchema.safeParse({
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid Public Input transition input",
      code: "CONSULTATION_INPUT_INVALID",
    };
  }

  const rule = input.rule;
  if (!rule) {
    return {
      ok: false,
      error: "Transition not allowed from the expected workflow state",
      code: "CONSULTATION_TRANSITION_DENIED",
    };
  }
  if (input.isRecovery && !isSubstantiveReason(input.reason)) {
    return {
      ok: false,
      error: "A substantive reason is required for a recovery transition",
      code: "CONSULTATION_REASON_REQUIRED",
    };
  }
  if (rule.reasonRequired && !isSubstantiveReason(parsed.data.reason)) {
    return {
      ok: false,
      error: "A substantive reason is required for this transition",
      code: "CONSULTATION_REASON_REQUIRED",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(tx, principal, rule.capability);
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getConversationOrThrow(tx, input.conversationId);
      if (current.workflowState === "archived") {
        throw new Error("CONSULTATION_ARCHIVED_TERMINAL");
      }
      if (
        current.workflowState !== rule.from ||
        current.workflowState !== input.expectedWorkflowState ||
        current.version !== parsed.data.expectedVersion
      ) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }

      const priorAvailability = current.providerAvailability;
      const priorProviderKind = current.providerKind;
      const priorRef = current.providerConversationRef;

      const updated = await updateConversationWorkflow(tx, {
        conversationId: input.conversationId,
        expectedVersion: parsed.data.expectedVersion,
        nextWorkflowState: rule.to,
        lastTransitionByAccountId: decision.principal.accountId,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }
      if (
        updated.value.providerAvailability !== priorAvailability ||
        updated.value.providerKind !== priorProviderKind ||
        updated.value.providerConversationRef !== priorRef
      ) {
        throw new Error("CONSULTATION_PROVIDER_FIELD_MUTATION_FORBIDDEN");
      }

      const transitionInserted = await insertConversationTransition(tx, {
        conversationId: input.conversationId,
        fromState: rule.from,
        toState: rule.to,
        reason: parsed.data.reason?.trim() ?? null,
        actorAccountId: decision.principal.accountId,
        isRecovery: input.isRecovery,
        synthetic: decision.principal.synthetic,
      });
      if (!transitionInserted.ok) {
        throw new Error(transitionInserted.code);
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: rule.auditAction,
        subjectType: "public_input_conversation",
        subjectId: updated.value.id,
        summary: `Public Input conversation ${rule.from} → ${rule.to}.`,
        reason: parsed.data.reason?.trim(),
        privatePayload: {
          conversationId: updated.value.id,
          topicId: updated.value.topicId,
          capability: rule.capability,
          previousWorkflowState: rule.from,
          nextWorkflowState: rule.to,
          actorAccountId: decision.principal.accountId,
          isRecovery: input.isRecovery,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "CONSULTATION_TRANSITION_FAILED");
  }
}

/**
 * Independent axis: provider availability. Never changes `workflowState`,
 * `providerKind`, or `providerConversationRef`.
 */
export async function setProviderAvailability(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedVersion: number;
    availability: PublicInputProviderAvailability;
    reason?: string;
  },
): Promise<AdapterResult<ConversationRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = setProviderAvailabilityInputSchema.safeParse({
    expectedVersion: input.expectedVersion,
    availability: input.availability,
    reason: input.reason,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid provider availability input",
      code: "CONSULTATION_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.set_availability",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getConversationOrThrow(tx, input.conversationId);
      if (current.version !== parsed.data.expectedVersion) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }
      const priorWorkflow = current.workflowState;

      const updated = await updateConversationProviderAvailability(tx, {
        conversationId: input.conversationId,
        expectedVersion: parsed.data.expectedVersion,
        nextAvailability: parsed.data.availability,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }
      if (updated.value.workflowState !== priorWorkflow) {
        throw new Error("CONSULTATION_WORKFLOW_MUTATION_FORBIDDEN");
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "consultations.provider_availability_changed",
        subjectType: "public_input_conversation",
        subjectId: updated.value.id,
        summary: `Public Input provider availability → ${updated.value.providerAvailability}.`,
        reason: parsed.data.reason?.trim(),
        privatePayload: {
          conversationId: updated.value.id,
          topicId: updated.value.topicId,
          capability: "consultations.set_availability",
          previousAvailability: current.providerAvailability,
          nextAvailability: updated.value.providerAvailability,
          unchangedWorkflowState: updated.value.workflowState,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "CONSULTATION_AVAILABILITY_UPDATE_FAILED");
  }
}

type MappingChangeKind = "attach" | "rotate" | "remove";

async function changeProviderMapping(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedVersion: number;
    kind: MappingChangeKind;
    nextProviderKind?: PublicInputProviderKind;
  },
): Promise<AdapterResult<ConversationRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  if (
    input.kind !== "remove" &&
    input.nextProviderKind &&
    !isOperationalProviderKind(input.nextProviderKind)
  ) {
    return {
      ok: false,
      error: "Live provider kinds are not operational; mapping refused",
      code: "LIVE_PROVIDER_KIND_FORBIDDEN",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(
        tx,
        principal,
        "consultations.manage_provider_mapping",
      );
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getConversationOrThrow(tx, input.conversationId);
      if (current.version !== input.expectedVersion) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }

      let nextKind: PublicInputProviderKind;
      let nextRef: string | null;
      let auditAction:
        | "consultations.mapping_attached"
        | "consultations.mapping_rotated"
        | "consultations.mapping_removed";

      if (input.kind === "remove") {
        nextKind = "none";
        nextRef = null;
        auditAction = "consultations.mapping_removed";
      } else {
        if (input.kind === "attach" && current.providerConversationRef) {
          throw new Error("CONSULTATION_MAPPING_ALREADY_ATTACHED");
        }
        if (input.kind === "rotate" && !current.providerConversationRef) {
          throw new Error("CONSULTATION_MAPPING_NOT_ATTACHED");
        }
        nextKind = input.nextProviderKind ?? "fixture";
        nextRef = `fixture-conv:${generateOpaqueToken(16)}`;
        auditAction =
          input.kind === "attach"
            ? "consultations.mapping_attached"
            : "consultations.mapping_rotated";
      }

      if (!isValidOpaqueConversationRef(nextRef ?? "fixture-conv:placeholder") && nextRef) {
        throw new Error("CONSULTATION_INVALID_GENERATED_REF");
      }

      const priorWorkflow = current.workflowState;
      const priorAvailability = current.providerAvailability;

      const updated = await updateConversationProviderMapping(tx, {
        conversationId: input.conversationId,
        expectedVersion: input.expectedVersion,
        nextKind,
        nextRef,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("CONSULTATION_STATE_CONFLICT");
      }
      if (
        updated.value.workflowState !== priorWorkflow ||
        updated.value.providerAvailability !== priorAvailability
      ) {
        throw new Error("CONSULTATION_WORKFLOW_MUTATION_FORBIDDEN");
      }

      const summary = `Public Input provider mapping ${input.kind}d.`;
      assertNoProviderRefInText(summary, nextRef);
      assertNoProviderRefInText(summary, current.providerConversationRef);

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: auditAction,
        subjectType: "public_input_conversation",
        subjectId: updated.value.id,
        summary,
        privatePayload: {
          conversationId: updated.value.id,
          topicId: updated.value.topicId,
          capability: "consultations.manage_provider_mapping",
          providerKind: updated.value.providerKind,
          hasProviderMapping: Boolean(updated.value.providerConversationRef),
          configurationVersion: updated.value.configurationVersion,
          actorAccountId: decision.principal.accountId,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    return mapServiceError(error, "CONSULTATION_MAPPING_UPDATE_FAILED");
  }
}

export function attachProviderMapping(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedVersion: number;
    providerKind?: PublicInputProviderKind;
  },
): Promise<AdapterResult<ConversationRecord>> {
  return changeProviderMapping(db, {
    ...input,
    kind: "attach",
    nextProviderKind: input.providerKind,
  });
}

export function rotateProviderMapping(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedVersion: number;
  },
): Promise<AdapterResult<ConversationRecord>> {
  return changeProviderMapping(db, { ...input, kind: "rotate" });
}

export function removeProviderMapping(
  db: GatedDb,
  input: {
    actorAccountId: string;
    conversationId: string;
    expectedVersion: number;
  },
): Promise<AdapterResult<ConversationRecord>> {
  return changeProviderMapping(db, { ...input, kind: "remove" });
}

async function getConversationOrThrow(
  db: GatedDb,
  conversationId: string,
): Promise<ConversationRecord> {
  const current = await getCurrentConversationOrById(db, conversationId);
  if (!current) {
    throw new Error("CONSULTATION_NOT_FOUND");
  }
  return current;
}

async function getCurrentConversationOrById(
  db: GatedDb,
  conversationId: string,
): Promise<ConversationRecord | null> {
  const { getConversationById } = await import(
    "@/lib/public-input/lifecycle/repository"
  );
  const result = await getConversationById(db, conversationId);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.value;
}

function mapServiceError(
  error: unknown,
  fallbackCode: string,
): AdapterResult<never> {
  if (
    typeof error === "object" &&
    error &&
    "decision" in error &&
    (error as { decision: { ok: false } }).decision
  ) {
    return authzFail(
      (error as {
        decision: Exclude<
          Awaited<ReturnType<typeof authorizeCapability>>,
          { ok: true }
        >;
      }).decision,
    );
  }
  const message = error instanceof Error ? error.message : "";
  const KNOWN: Record<string, { error: string; code: string }> = {
    CONSULTATION_NOT_FOUND: {
      error: "Public Input conversation not found",
      code: "CONSULTATION_NOT_FOUND",
    },
    CONSULTATION_STATE_CONFLICT: {
      error: "Conversation changed; reload and retry",
      code: "CONSULTATION_STATE_CONFLICT",
    },
    CONSULTATION_ARCHIVED_TERMINAL: {
      error: "Archived conversations are terminal",
      code: "CONSULTATION_ARCHIVED_TERMINAL",
    },
    CONSULTATION_PROVIDER_FIELD_MUTATION_FORBIDDEN: {
      error: "Workflow transitions must not change provider fields",
      code: "CONSULTATION_PROVIDER_FIELD_MUTATION_FORBIDDEN",
    },
    CONSULTATION_WORKFLOW_MUTATION_FORBIDDEN: {
      error: "This mutation must not change workflow state",
      code: "CONSULTATION_WORKFLOW_MUTATION_FORBIDDEN",
    },
    TOPIC_ALREADY_HAS_CURRENT_CONVERSATION: {
      error: "This topic already has a current Public Input conversation",
      code: "TOPIC_ALREADY_HAS_CURRENT_CONVERSATION",
    },
    CONSULTATION_MAPPING_ALREADY_ATTACHED: {
      error: "A provider mapping is already attached; rotate or remove it first",
      code: "CONSULTATION_MAPPING_ALREADY_ATTACHED",
    },
    CONSULTATION_MAPPING_NOT_ATTACHED: {
      error: "No provider mapping is attached to rotate",
      code: "CONSULTATION_MAPPING_NOT_ATTACHED",
    },
  };
  if (KNOWN[message]) {
    return { ok: false, ...KNOWN[message] };
  }
  return {
    ok: false,
    error: "Public Input conversation operation failed",
    code: fallbackCode,
  };
}

/** Public safe read — never returns `providerConversationRef`. */
export async function getPublicConsultationView(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<PublicConsultationView | null>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const current = await getCurrentConversationByTopicId(db, topicId);
  if (!current.ok) {
    return current;
  }
  if (!current.value) {
    return { ok: true, value: null };
  }
  return { ok: true, value: toPublicConsultationView(current.value) };
}

/** Staff read — still omits the raw provider ref (boolean signal only). */
export async function getStaffConsultationSummary(
  db: GatedDb,
  topicId: string,
): Promise<AdapterResult<StaffConsultationSummary | null>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const current = await getCurrentConversationByTopicId(db, topicId);
  if (!current.ok) {
    return current;
  }
  if (!current.value) {
    return { ok: true, value: null };
  }
  return { ok: true, value: toStaffConsultationSummary(current.value) };
}
