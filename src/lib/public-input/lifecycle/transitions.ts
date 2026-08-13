import type { Capability } from "@/lib/authz/types";
import type { PublicInputWorkflowState } from "@/lib/public-input/lifecycle/repository";

/**
 * Forward-path conversation lifecycle actions. All are administrator-only
 * via `consultations.transition` (docs/phase-4-plan.md §4; ADR 0012).
 */
export type PublicInputTransitionAction =
  | "mark_ready"
  | "open"
  | "close_commenting"
  | "close_voting"
  | "close"
  | "archive";

export type PublicInputAuditAction =
  | "consultations.marked_ready"
  | "consultations.opened"
  | "consultations.commenting_closed"
  | "consultations.voting_closed"
  | "consultations.closed"
  | "consultations.archived"
  | "consultations.recovery_transition";

export type PublicInputTransitionRule = {
  from: PublicInputWorkflowState;
  to: PublicInputWorkflowState;
  capability: Capability;
  auditAction: PublicInputAuditAction;
  reasonRequired: boolean;
};

/**
 * Ordinary forward pipeline: draft → ready → open → commenting_closed →
 * voting_closed → closed → archived. `archive` may be reached from any
 * non-archived state so a conversation can be retired early with a reason.
 */
export const PUBLIC_INPUT_TRANSITIONS: Record<
  PublicInputTransitionAction,
  PublicInputTransitionRule[]
> = {
  mark_ready: [
    {
      from: "draft",
      to: "ready",
      capability: "consultations.transition",
      auditAction: "consultations.marked_ready",
      reasonRequired: false,
    },
  ],
  open: [
    {
      from: "ready",
      to: "open",
      capability: "consultations.transition",
      auditAction: "consultations.opened",
      reasonRequired: false,
    },
  ],
  close_commenting: [
    {
      from: "open",
      to: "commenting_closed",
      capability: "consultations.transition",
      auditAction: "consultations.commenting_closed",
      reasonRequired: false,
    },
  ],
  close_voting: [
    {
      from: "commenting_closed",
      to: "voting_closed",
      capability: "consultations.transition",
      auditAction: "consultations.voting_closed",
      reasonRequired: false,
    },
  ],
  close: [
    {
      from: "voting_closed",
      to: "closed",
      capability: "consultations.transition",
      auditAction: "consultations.closed",
      reasonRequired: true,
    },
  ],
  archive: [
    {
      from: "draft",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
    {
      from: "ready",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
    {
      from: "open",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
    {
      from: "commenting_closed",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
    {
      from: "voting_closed",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
    {
      from: "closed",
      to: "archived",
      capability: "consultations.transition",
      auditAction: "consultations.archived",
      reasonRequired: true,
    },
  ],
};

/**
 * Anomalous, out-of-pipeline moves used to correct a mistaken transition
 * (e.g. a conversation opened before it should have been). Always require a
 * substantive reason and are always recorded with `isRecovery = true` — this
 * is a distinct audit shape (`consultations.recovery_transition`) from the
 * ordinary forward-pipeline audit actions above, never reused for routine work.
 */
export const PUBLIC_INPUT_RECOVERY_TRANSITIONS: PublicInputTransitionRule[] = [
  {
    from: "ready",
    to: "draft",
    capability: "consultations.transition",
    auditAction: "consultations.recovery_transition",
    reasonRequired: true,
  },
  {
    from: "open",
    to: "ready",
    capability: "consultations.transition",
    auditAction: "consultations.recovery_transition",
    reasonRequired: true,
  },
  {
    from: "commenting_closed",
    to: "open",
    capability: "consultations.transition",
    auditAction: "consultations.recovery_transition",
    reasonRequired: true,
  },
  {
    from: "voting_closed",
    to: "commenting_closed",
    capability: "consultations.transition",
    auditAction: "consultations.recovery_transition",
    reasonRequired: true,
  },
  {
    from: "closed",
    to: "voting_closed",
    capability: "consultations.transition",
    auditAction: "consultations.recovery_transition",
    reasonRequired: true,
  },
];

const MIN_REASON_LENGTH = 8;

export function isSubstantiveReason(reason: string | null | undefined): boolean {
  return Boolean(reason && reason.trim().length >= MIN_REASON_LENGTH);
}

/** Allowed forward actions from a workflow state (UI hints only — never authorization). */
export function allowedPublicInputActions(
  workflowState: PublicInputWorkflowState,
): PublicInputTransitionAction[] {
  const actions: PublicInputTransitionAction[] = [];
  for (const [action, rules] of Object.entries(PUBLIC_INPUT_TRANSITIONS) as [
    PublicInputTransitionAction,
    PublicInputTransitionRule[],
  ][]) {
    if (rules.some((rule) => rule.from === workflowState)) {
      actions.push(action);
    }
  }
  return actions;
}

/** Recovery targets available from a workflow state (UI hints only — never authorization). */
export function allowedRecoveryTargets(
  workflowState: PublicInputWorkflowState,
): PublicInputWorkflowState[] {
  return PUBLIC_INPUT_RECOVERY_TRANSITIONS.filter(
    (rule) => rule.from === workflowState,
  ).map((rule) => rule.to);
}

export function findForwardTransitionRule(
  action: PublicInputTransitionAction,
  from: PublicInputWorkflowState,
): PublicInputTransitionRule | null {
  return (
    PUBLIC_INPUT_TRANSITIONS[action].find((rule) => rule.from === from) ??
    null
  );
}

export function findRecoveryTransitionRule(
  from: PublicInputWorkflowState,
  to: PublicInputWorkflowState,
): PublicInputTransitionRule | null {
  return (
    PUBLIC_INPUT_RECOVERY_TRANSITIONS.find(
      (rule) => rule.from === from && rule.to === to,
    ) ?? null
  );
}
