import type { AdapterResult } from "@/lib/adapters/types";
import {
  GOVERNANCE_TRANSITIONS,
  TERMINAL_STATES,
  isGovernanceAction,
  isGovernanceState,
  type GovernanceActor,
  type GovernanceTransition,
  type TopicGovernanceAction,
  type TopicGovernanceState,
} from "@/lib/governance/contract";

export type TransitionInput = {
  from: string;
  action: string;
  actor: GovernanceActor;
  reason?: string | null;
  criteriaTrace?: Record<string, unknown> | null;
  metricsSnapshot?: Record<string, unknown> | null;
  verdict?: Record<string, unknown> | null;
};

export type AcceptedTransition = {
  from: TopicGovernanceState;
  to: TopicGovernanceState;
  action: TopicGovernanceAction;
  transition: GovernanceTransition;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasObject(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Pure transition engine. Unknown from/action/to fail closed.
 * Informal/formal review cannot jump to Chamber/Council because those
 * edges are absent from the JSON contract.
 */
export function evaluateTransition(
  input: TransitionInput,
): AdapterResult<AcceptedTransition> {
  if (!isGovernanceState(input.from)) {
    return {
      ok: false,
      code: "GOVERNANCE_UNKNOWN_STATE",
      error: `Unknown governance state: ${input.from}`,
    };
  }
  if (!isGovernanceAction(input.action)) {
    return {
      ok: false,
      code: "GOVERNANCE_UNKNOWN_ACTION",
      error: `Unknown governance action: ${input.action}`,
    };
  }
  if (TERMINAL_STATES.has(input.from)) {
    return {
      ok: false,
      code: "GOVERNANCE_TERMINAL_STATE",
      error: `State ${input.from} has no outgoing transitions`,
    };
  }

  const transition = GOVERNANCE_TRANSITIONS.find(
    (candidate) =>
      candidate.from === input.from && candidate.action === input.action,
  );
  if (!transition) {
    return {
      ok: false,
      code: "GOVERNANCE_ILLEGAL_TRANSITION",
      error: `Action ${input.action} is not allowed from ${input.from}`,
    };
  }

  if (transition.actor !== input.actor) {
    return {
      ok: false,
      code: "GOVERNANCE_ACTOR_DENIED",
      error: `Action ${input.action} requires actor ${transition.actor}`,
    };
  }

  if (transition.reasonRequired && !hasText(input.reason)) {
    return {
      ok: false,
      code: "GOVERNANCE_REASON_REQUIRED",
      error: `Action ${input.action} requires a reason`,
    };
  }
  if (transition.criteriaTraceRequired && !hasObject(input.criteriaTrace)) {
    return {
      ok: false,
      code: "GOVERNANCE_CRITERIA_TRACE_REQUIRED",
      error: `Action ${input.action} requires a criteria trace`,
    };
  }
  if (transition.metricsSnapshotRequired && !hasObject(input.metricsSnapshot)) {
    return {
      ok: false,
      code: "GOVERNANCE_METRICS_SNAPSHOT_REQUIRED",
      error: `Action ${input.action} requires a metrics snapshot`,
    };
  }
  if (transition.verdictRequired && !hasObject(input.verdict)) {
    return {
      ok: false,
      code: "GOVERNANCE_VERDICT_REQUIRED",
      error: `Action ${input.action} requires a verdict`,
    };
  }

  return {
    ok: true,
    value: {
      from: transition.from,
      to: transition.to,
      action: transition.action,
      transition,
    },
  };
}
