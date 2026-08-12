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
  "empty",
] as const;

export const WORKFLOW_TASKS = [
  "home",
  "topic-recommendation",
  "source-contribution",
  "explore",
] as const;

export const TOPIC_RECOMMENDATION_STEPS = [
  "choose",
  "scope",
  "details",
  "review",
  "receipt",
] as const;

export const SOURCE_CONTRIBUTION_STEPS = [
  "topic",
  "relationship",
  "url",
  "details",
  "review",
  "receipt",
  "consequence",
] as const;

export type WorkflowPreviewView = (typeof WORKFLOW_VIEWS)[number];
export type ModerationPreviewState = (typeof MODERATION_PREVIEW_STATES)[number];
export type WorkflowTask = (typeof WORKFLOW_TASKS)[number];
export type TopicRecommendationStep =
  (typeof TOPIC_RECOMMENDATION_STEPS)[number];
export type SourceContributionStep = (typeof SOURCE_CONTRIBUTION_STEPS)[number];

export type WorkflowPreviewQuery = {
  view: WorkflowPreviewView;
  /** Presentation-only; meaningful for moderation and visitor projections. */
  state: ModerationPreviewState;
};

/** Safe URL state for the primary practice surface + secondary explorer. */
export type WorkflowDemoQuery = {
  task: WorkflowTask;
  step: string | null;
  explorer: WorkflowPreviewQuery | null;
};

export const DEFAULT_WORKFLOW_PREVIEW_QUERY: WorkflowPreviewQuery = {
  view: "participant",
  state: "visible",
};

export const DEFAULT_WORKFLOW_DEMO_QUERY: WorkflowDemoQuery = {
  task: "home",
  step: null,
  explorer: null,
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

export function isWorkflowTask(
  value: string | null | undefined,
): value is WorkflowTask {
  return (
    typeof value === "string" &&
    (WORKFLOW_TASKS as readonly string[]).includes(value)
  );
}

export function isTopicRecommendationStep(
  value: string | null | undefined,
): value is TopicRecommendationStep {
  return (
    typeof value === "string" &&
    (TOPIC_RECOMMENDATION_STEPS as readonly string[]).includes(value)
  );
}

export function isSourceContributionStep(
  value: string | null | undefined,
): value is SourceContributionStep {
  return (
    typeof value === "string" &&
    (SOURCE_CONTRIBUTION_STEPS as readonly string[]).includes(value)
  );
}

function paramOf(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/** Parse URL search params into a fixture preview selection. Pure; no I/O. */
export function parseWorkflowPreviewQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): WorkflowPreviewQuery {
  const viewRaw = paramOf(params, "view");
  const stateRaw = paramOf(params, "state");

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

export function parseWorkflowDemoQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): WorkflowDemoQuery {
  const taskRaw = paramOf(params, "task");
  const stepRaw = paramOf(params, "step");
  const viewRaw = paramOf(params, "view");
  const stateRaw = paramOf(params, "state");

  // Legacy deep links (`?view=` without `task=`) open the secondary explorer.
  if (!isWorkflowTask(taskRaw) && isWorkflowPreviewView(viewRaw)) {
    return {
      task: "explore",
      step: null,
      explorer: parseWorkflowPreviewQuery(params),
    };
  }

  const task = isWorkflowTask(taskRaw) ? taskRaw : DEFAULT_WORKFLOW_DEMO_QUERY.task;

  if (task === "topic-recommendation") {
    return {
      task,
      step: isTopicRecommendationStep(stepRaw) ? stepRaw : "choose",
      explorer: null,
    };
  }

  if (task === "source-contribution") {
    return {
      task,
      step: isSourceContributionStep(stepRaw) ? stepRaw : "topic",
      explorer: null,
    };
  }

  if (task === "explore") {
    return {
      task,
      step: null,
      explorer: {
        view: isWorkflowPreviewView(viewRaw)
          ? viewRaw
          : DEFAULT_WORKFLOW_PREVIEW_QUERY.view,
        state: isModerationPreviewState(stateRaw)
          ? stateRaw
          : DEFAULT_WORKFLOW_PREVIEW_QUERY.state,
      },
    };
  }

  return { ...DEFAULT_WORKFLOW_DEMO_QUERY };
}

export function serializeWorkflowDemoQuery(
  query: WorkflowDemoQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.task === "home") {
    return params;
  }
  params.set("task", query.task);
  if (
    (query.task === "topic-recommendation" ||
      query.task === "source-contribution") &&
    query.step
  ) {
    const defaultStep =
      query.task === "topic-recommendation" ? "choose" : "topic";
    if (query.step !== defaultStep) {
      params.set("step", query.step);
    }
  }
  if (query.task === "explore" && query.explorer) {
    const explorerParams = serializeWorkflowPreviewQuery(query.explorer);
    for (const [key, value] of explorerParams.entries()) {
      params.set(key, value);
    }
  }
  return params;
}

export function workflowPreviewHref(query: WorkflowPreviewQuery): string {
  const params = serializeWorkflowDemoQuery({
    task: "explore",
    step: null,
    explorer: query,
  });
  const qs = params.toString();
  return qs ? `/demo/workflow?${qs}` : "/demo/workflow?task=explore";
}

export function workflowDemoHref(query: WorkflowDemoQuery): string {
  const params = serializeWorkflowDemoQuery(query);
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
    case "empty":
      return "Published with no included content";
  }
}

export function workflowTaskLabel(task: WorkflowTask): string {
  switch (task) {
    case "home":
      return "Practice home";
    case "topic-recommendation":
      return "Recommend a topic";
    case "source-contribution":
      return "Contribute a source";
    case "explore":
      return "Explore example staff and visitor states";
  }
}
