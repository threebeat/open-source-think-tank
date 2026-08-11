import { z } from "zod";

import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import type { GatedDb } from "@/lib/persistence/gated";
import {
  getTopicById,
  insertTopic,
  type TopicPublicationStatus,
  type TopicRecord,
  type TopicWorkflowState,
  updateTopicMetadata,
  updateTopicWorkflow,
} from "@/lib/topics/repository";
import {
  TOPIC_TRANSITIONS,
  type TopicTransitionAction,
} from "@/lib/topics/transitions";

export type { TopicTransitionAction } from "@/lib/topics/transitions";
export { allowedTopicActions } from "@/lib/topics/transitions";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE = 200;
const MAX_SLUG = 80;
const MAX_QUESTION = 2000;
const MAX_BACKGROUND = 8000;
const MAX_SCOPE = 4000;
const MIN_REASON = 8;

export const createTopicInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(MAX_SLUG)
    .regex(SLUG_RE, "Slug must be lowercase ASCII letters, digits, and hyphens"),
  title: z.string().trim().min(1).max(MAX_TITLE),
  question: z.string().trim().min(1).max(MAX_QUESTION),
  background: z.string().trim().min(1).max(MAX_BACKGROUND),
  scope: z.string().trim().min(1).max(MAX_SCOPE),
});

export const updateTopicMetadataInputSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE),
  question: z.string().trim().min(1).max(MAX_QUESTION),
  background: z.string().trim().min(1).max(MAX_BACKGROUND),
  scope: z.string().trim().min(1).max(MAX_SCOPE),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const topicTransitionInputSchema = z.object({
  expectedWorkflowState: z.enum([
    "draft",
    "open_for_submissions",
    "under_review",
    "paused",
    "archived",
  ]),
  reason: z.string().trim().min(MIN_REASON).max(2000).optional(),
});

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Topic authoring unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_TOPICS",
    };
  }
  return null;
}

function authzFail(
  decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }>,
): AdapterResult<never> {
  return { ok: false, error: decision.error, code: decision.code };
}

function changedFieldNames(
  before: TopicRecord,
  after: {
    title: string;
    question: string;
    background: string;
    scope: string;
  },
): string[] {
  const names: string[] = [];
  if (before.title !== after.title) names.push("title");
  if (before.question !== after.question) names.push("question");
  if (before.background !== after.background) names.push("background");
  if (before.scope !== after.scope) names.push("scope");
  return names;
}

/**
 * Create a topic as draft + unpublished. Actor/creator/synthetic from principal.
 */
export async function createTopic(
  db: GatedDb,
  input: {
    actorAccountId: string;
    slug: string;
    title: string;
    question: string;
    background: string;
    scope: string;
  },
): Promise<AdapterResult<TopicRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = createTopicInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid topic input",
      code: "TOPIC_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(tx, principal, "topics.create");
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const inserted = await insertTopic(tx, {
        slug: parsed.data.slug,
        title: parsed.data.title,
        question: parsed.data.question,
        background: parsed.data.background,
        scope: parsed.data.scope,
        createdByAccountId: decision.principal.accountId,
        synthetic: decision.principal.synthetic,
        workflowState: "draft",
        publicationStatus: "unpublished",
        publishedAt: null,
        publishedByAccountId: null,
      });
      if (!inserted.ok) {
        throw new Error(inserted.code);
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "topics.created",
        subjectType: "topic",
        subjectId: inserted.value.id,
        summary: "Topic draft created.",
        privatePayload: {
          topicId: inserted.value.id,
          capability: "topics.create",
          previousWorkflowState: null,
          nextWorkflowState: "draft",
          actorAccountId: decision.principal.accountId,
          slug: inserted.value.slug,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: inserted.value };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "decision" in error &&
      (error as { decision: { ok: false; error: string; code: string } }).decision
    ) {
      return authzFail(
        (error as { decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }> })
          .decision,
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (/topics_slug_uidx|unique/i.test(message)) {
      return {
        ok: false,
        error: "A topic with this slug already exists",
        code: "TOPIC_SLUG_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Topic creation failed",
      code: "TOPIC_CREATE_FAILED",
    };
  }
}

/**
 * Update draft topic metadata only. Never changes workflow or publication.
 */
export async function updateDraftTopicMetadata(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId: string;
    title: string;
    question: string;
    background: string;
    scope: string;
    expectedUpdatedAt: string;
  },
): Promise<AdapterResult<TopicRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = updateTopicMetadataInputSchema.safeParse({
    title: input.title,
    question: input.question,
    background: input.background,
    scope: input.scope,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid topic metadata",
      code: "TOPIC_INPUT_INVALID",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(tx, principal, "topics.update");
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getTopicById(tx, input.topicId);
      if (!current.ok || !current.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }
      if (current.value.workflowState !== "draft") {
        throw new Error("TOPIC_METADATA_DRAFT_ONLY");
      }

      const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
      const fields = {
        title: parsed.data.title,
        question: parsed.data.question,
        background: parsed.data.background,
        scope: parsed.data.scope,
      };
      const changed = changedFieldNames(current.value, fields);
      if (changed.length === 0) {
        return { ok: true as const, value: current.value };
      }

      const updated = await updateTopicMetadata(tx, {
        topicId: input.topicId,
        expectedUpdatedAt,
        ...fields,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("TOPIC_STATE_CONFLICT");
      }

      // Guard: metadata path must not alter workflow/publication.
      if (
        updated.value.workflowState !== current.value.workflowState ||
        updated.value.publicationStatus !== current.value.publicationStatus ||
        updated.value.publishedAt?.getTime() !==
          current.value.publishedAt?.getTime() ||
        updated.value.publishedByAccountId !==
          current.value.publishedByAccountId
      ) {
        throw new Error("TOPIC_PUBLICATION_MUTATION_FORBIDDEN");
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: "topics.updated",
        subjectType: "topic",
        subjectId: updated.value.id,
        summary: "Topic draft metadata updated.",
        privatePayload: {
          topicId: updated.value.id,
          capability: "topics.update",
          previousWorkflowState: current.value.workflowState,
          nextWorkflowState: updated.value.workflowState,
          changedFields: changed,
          actorAccountId: decision.principal.accountId,
          expectedUpdatedAt: parsed.data.expectedUpdatedAt,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "decision" in error &&
      (error as { decision: { ok: false } }).decision
    ) {
      return authzFail(
        (error as { decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }> })
          .decision,
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "TOPIC_NOT_FOUND") {
      return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
    }
    if (message === "TOPIC_METADATA_DRAFT_ONLY") {
      return {
        ok: false,
        error: "Metadata edits are limited to draft topics in 3.4",
        code: "TOPIC_METADATA_DRAFT_ONLY",
      };
    }
    if (message === "TOPIC_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Topic changed; reload and retry",
        code: "TOPIC_STATE_CONFLICT",
      };
    }
    return {
      ok: false,
      error: "Topic update failed",
      code: "TOPIC_UPDATE_FAILED",
    };
  }
}

/**
 * Apply an allowed operational transition. Never changes publication_status.
 */
export async function transitionTopic(
  db: GatedDb,
  input: {
    actorAccountId: string;
    topicId: string;
    action: TopicTransitionAction;
    expectedWorkflowState: TopicWorkflowState;
    reason?: string;
  },
): Promise<AdapterResult<TopicRecord>> {
  const denied = gatedOrDeny();
  if (denied) return denied;

  const parsed = topicTransitionInputSchema.safeParse({
    expectedWorkflowState: input.expectedWorkflowState,
    reason: input.reason,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid topic transition input",
      code: "TOPIC_INPUT_INVALID",
    };
  }

  const rules = TOPIC_TRANSITIONS[input.action];
  const rule = rules.find((row) => row.from === parsed.data.expectedWorkflowState);
  if (!rule) {
    return {
      ok: false,
      error: "Transition not allowed from the expected workflow state",
      code: "TOPIC_TRANSITION_DENIED",
    };
  }
  if (rule.reasonRequired) {
    const reason = parsed.data.reason?.trim() ?? "";
    if (reason.length < MIN_REASON) {
      return {
        ok: false,
        error: "A substantive reason is required for this transition",
        code: "TOPIC_REASON_REQUIRED",
      };
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const principal = await loadPrincipal(tx, input.actorAccountId);
      const decision = await authorizeCapability(tx, principal, rule.capability);
      if (!decision.ok) {
        throw Object.assign(new Error(decision.code), { decision });
      }

      const current = await getTopicById(tx, input.topicId);
      if (!current.ok || !current.value) {
        throw new Error("TOPIC_NOT_FOUND");
      }
      if (current.value.workflowState === "archived") {
        throw new Error("TOPIC_ARCHIVED_TERMINAL");
      }
      if (current.value.workflowState !== rule.from) {
        throw new Error("TOPIC_STATE_CONFLICT");
      }
      if (current.value.workflowState !== parsed.data.expectedWorkflowState) {
        throw new Error("TOPIC_STATE_CONFLICT");
      }

      const priorPublication: TopicPublicationStatus =
        current.value.publicationStatus;
      const priorPublishedAt = current.value.publishedAt;
      const priorPublishedBy = current.value.publishedByAccountId;

      const updated = await updateTopicWorkflow(tx, {
        topicId: input.topicId,
        expectedWorkflowState: rule.from,
        nextWorkflowState: rule.to,
      });
      if (!updated.ok) {
        throw new Error(updated.code);
      }
      if (!updated.value) {
        throw new Error("TOPIC_STATE_CONFLICT");
      }

      if (
        updated.value.publicationStatus !== priorPublication ||
        updated.value.publishedAt?.getTime() !== priorPublishedAt?.getTime() ||
        updated.value.publishedByAccountId !== priorPublishedBy
      ) {
        throw new Error("TOPIC_PUBLICATION_MUTATION_FORBIDDEN");
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: decision.principal.accountId,
        action: rule.auditAction,
        subjectType: "topic",
        subjectId: updated.value.id,
        summary: `Topic workflow ${rule.from} → ${rule.to}.`,
        reason: parsed.data.reason?.trim(),
        privatePayload: {
          topicId: updated.value.id,
          capability: rule.capability,
          previousWorkflowState: rule.from,
          nextWorkflowState: rule.to,
          actorAccountId: decision.principal.accountId,
          expectedWorkflowState: parsed.data.expectedWorkflowState,
          publicationStatusUnchanged: priorPublication,
        },
        synthetic: decision.principal.synthetic,
      });

      return { ok: true as const, value: updated.value };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "decision" in error &&
      (error as { decision: { ok: false } }).decision
    ) {
      return authzFail(
        (error as { decision: Exclude<Awaited<ReturnType<typeof authorizeCapability>>, { ok: true }> })
          .decision,
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "TOPIC_NOT_FOUND") {
      return { ok: false, error: "Topic not found", code: "TOPIC_NOT_FOUND" };
    }
    if (message === "TOPIC_ARCHIVED_TERMINAL") {
      return {
        ok: false,
        error: "Archived topics are terminal in 3.4",
        code: "TOPIC_ARCHIVED_TERMINAL",
      };
    }
    if (message === "TOPIC_STATE_CONFLICT") {
      return {
        ok: false,
        error: "Topic changed; reload and retry",
        code: "TOPIC_STATE_CONFLICT",
      };
    }
    if (message === "TOPIC_PUBLICATION_MUTATION_FORBIDDEN") {
      return {
        ok: false,
        error: "Publication status must remain unchanged",
        code: "TOPIC_PUBLICATION_MUTATION_FORBIDDEN",
      };
    }
    return {
      ok: false,
      error: "Topic transition failed",
      code: "TOPIC_TRANSITION_FAILED",
    };
  }
}

