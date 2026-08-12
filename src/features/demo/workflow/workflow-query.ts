export const WORKFLOW_VIEWS = [
  "participant",
  "review",
  "revision",
  "comparison",
  "moderation",
  "visitor",
] as const;

export const MODERATION_PREVIEW_STATES = [
  "visible",
  "held",
  "hidden",
  "restored",
] as const;

export type WorkflowPreviewView = (typeof WORKFLOW_VIEWS)[number];
export type ModerationPreviewState = (typeof MODERATION_PREVIEW_STATES)[number];

export type WorkflowPreviewQuery = {
  view: WorkflowPreviewView;
  /** Presentation-only; meaningful for moderation and visitor projections. */
  state: ModerationPreviewState;
};

export const DEFAULT_WORKFLOW_PREVIEW_QUERY: WorkflowPreviewQuery = {
  view: "participant",
  state: "visible",
};

export function isWorkflowPreviewView(
  value: string | null | undefined,
): value is WorkflowPreviewView {
  return (
    typeof value === "string" &&
    (WORKFLOW_VIEWS as readonly string[]).includes(value)
  );
}

export function isModerationPreviewState(
  value: string | null | undefined,
): value is ModerationPreviewState {
  return (
    typeof value === "string" &&
    (MODERATION_PREVIEW_STATES as readonly string[]).includes(value)
  );
}

/** Parse URL search params into a fixture preview selection. Pure; no I/O. */
export function parseWorkflowPreviewQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): WorkflowPreviewQuery {
  const viewRaw =
    params instanceof URLSearchParams
      ? params.get("view")
      : Array.isArray(params.view)
        ? params.view[0]
        : params.view;
  const stateRaw =
    params instanceof URLSearchParams
      ? params.get("state")
      : Array.isArray(params.state)
        ? params.state[0]
        : params.state;

  return {
    view: isWorkflowPreviewView(viewRaw)
      ? viewRaw
      : DEFAULT_WORKFLOW_PREVIEW_QUERY.view,
    state: isModerationPreviewState(stateRaw)
      ? stateRaw
      : DEFAULT_WORKFLOW_PREVIEW_QUERY.state,
  };
}

/**
 * Serialize preview selection to URLSearchParams.
 * Omits defaults so `/demo/workflow` stays clean; always includes explicit
 * non-default view/state for deep links and refresh stability.
 */
export function serializeWorkflowPreviewQuery(
  query: WorkflowPreviewQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.view !== DEFAULT_WORKFLOW_PREVIEW_QUERY.view) {
    params.set("view", query.view);
  }
  const stateRelevant =
    query.view === "moderation" || query.view === "visitor";
  if (
    stateRelevant &&
    query.state !== DEFAULT_WORKFLOW_PREVIEW_QUERY.state
  ) {
    params.set("state", query.state);
  }
  return params;
}

export function workflowPreviewHref(query: WorkflowPreviewQuery): string {
  const params = serializeWorkflowPreviewQuery(query);
  const qs = params.toString();
  return qs ? `/demo/workflow?${qs}` : "/demo/workflow";
}

export function workflowPreviewViewLabel(view: WorkflowPreviewView): string {
  switch (view) {
    case "participant":
      return "Participant submission & disclosure";
    case "review":
      return "Review decisions";
    case "revision":
      return "Revision chronology";
    case "comparison":
      return "Evidence comparison";
    case "moderation":
      return "Moderation visibility";
    case "visitor":
      return "Visitor public projection";
  }
}

export function moderationPreviewStateLabel(
  state: ModerationPreviewState,
): string {
  switch (state) {
    case "visible":
      return "Visible";
    case "held":
      return "Example held state";
    case "hidden":
      return "Example hidden state";
    case "restored":
      return "Restored to visible";
  }
}
