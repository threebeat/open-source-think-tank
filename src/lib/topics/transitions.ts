import type { Capability } from "@/lib/authz/types";
import type { TopicWorkflowState } from "@/lib/topics/repository";

export type TopicTransitionAction =
  | "open"
  | "begin_review"
  | "reopen"
  | "pause"
  | "archive";

export type TopicTransitionRule = {
  from: TopicWorkflowState;
  to: TopicWorkflowState;
  capability: Capability;
  auditAction:
    | "topics.opened"
    | "topics.review_started"
    | "topics.reopened"
    | "topics.paused"
    | "topics.archived";
  reasonRequired: boolean;
};

export const TOPIC_TRANSITIONS: Record<
  TopicTransitionAction,
  TopicTransitionRule[]
> = {
  open: [
    {
      from: "draft",
      to: "open_for_submissions",
      capability: "topics.open",
      auditAction: "topics.opened",
      reasonRequired: false,
    },
  ],
  begin_review: [
    {
      from: "open_for_submissions",
      to: "under_review",
      capability: "topics.update",
      auditAction: "topics.review_started",
      reasonRequired: true,
    },
  ],
  reopen: [
    {
      from: "under_review",
      to: "open_for_submissions",
      capability: "topics.open",
      auditAction: "topics.reopened",
      reasonRequired: true,
    },
    {
      from: "paused",
      to: "open_for_submissions",
      capability: "topics.open",
      auditAction: "topics.reopened",
      reasonRequired: true,
    },
  ],
  pause: [
    {
      from: "open_for_submissions",
      to: "paused",
      capability: "topics.pause",
      auditAction: "topics.paused",
      reasonRequired: true,
    },
    {
      from: "under_review",
      to: "paused",
      capability: "topics.pause",
      auditAction: "topics.paused",
      reasonRequired: true,
    },
  ],
  archive: [
    {
      from: "draft",
      to: "archived",
      capability: "topics.archive",
      auditAction: "topics.archived",
      reasonRequired: true,
    },
    {
      from: "open_for_submissions",
      to: "archived",
      capability: "topics.archive",
      auditAction: "topics.archived",
      reasonRequired: true,
    },
    {
      from: "under_review",
      to: "archived",
      capability: "topics.archive",
      auditAction: "topics.archived",
      reasonRequired: true,
    },
    {
      from: "paused",
      to: "archived",
      capability: "topics.archive",
      auditAction: "topics.archived",
      reasonRequired: true,
    },
  ],
};

/** Allowed transition actions from a workflow state (for UI hints only). */
export function allowedTopicActions(
  workflowState: TopicWorkflowState,
): TopicTransitionAction[] {
  const actions: TopicTransitionAction[] = [];
  for (const [action, rules] of Object.entries(TOPIC_TRANSITIONS) as [
    TopicTransitionAction,
    TopicTransitionRule[],
  ][]) {
    if (rules.some((rule) => rule.from === workflowState)) {
      actions.push(action);
    }
  }
  return actions;
}
