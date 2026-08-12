/**
 * Local sessionStorage for `/demo/workflow` practice journeys.
 * Synthetic fixture IDs and step receipts only — never raw draft URLs or
 * private detail in durable storage beyond this browser session.
 */

export const WORKFLOW_PRACTICE_STORAGE_KEY = "ostt-workflow-practice";

export type TopicRecommendationDraft = {
  topicIdeaId: string | null;
  scope: "statewide" | "county" | null;
  countyFips: string | null;
  reasonId: string | null;
  startingSourceId: string | null;
  submittedAt: string | null;
};

export type SourceContributionDraft = {
  topicId: string | null;
  relationship: "supporting" | "counterevidence" | null;
  sourceFixtureId: string | null;
  customUrl: string | null;
  limitationsId: string | null;
  disclosureChoice: "none" | "disclose" | null;
  disclosureFixtureId: string | null;
  submittedAt: string | null;
  advancedToConsequence: boolean;
};

export type WorkflowPracticeState = {
  topicRecommendation: TopicRecommendationDraft;
  sourceContribution: SourceContributionDraft;
};

export const EMPTY_TOPIC_RECOMMENDATION: TopicRecommendationDraft = {
  topicIdeaId: null,
  scope: null,
  countyFips: null,
  reasonId: null,
  startingSourceId: null,
  submittedAt: null,
};

export const EMPTY_SOURCE_CONTRIBUTION: SourceContributionDraft = {
  topicId: null,
  relationship: null,
  sourceFixtureId: null,
  customUrl: null,
  limitationsId: null,
  disclosureChoice: null,
  disclosureFixtureId: null,
  submittedAt: null,
  advancedToConsequence: false,
};

export const EMPTY_WORKFLOW_PRACTICE: WorkflowPracticeState = {
  topicRecommendation: { ...EMPTY_TOPIC_RECOMMENDATION },
  sourceContribution: { ...EMPTY_SOURCE_CONTRIBUTION },
};

const listeners = new Set<() => void>();
let cached: WorkflowPracticeState | null = null;

function emit() {
  cached = null;
  for (const listener of listeners) {
    listener();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ostt-workflow-practice"));
  }
}

export function subscribeWorkflowPractice(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKFLOW_PRACTICE_STORAGE_KEY || event.key === null) {
        listener();
      }
    };
    const onCustom = () => listener();
    window.addEventListener("storage", onStorage);
    window.addEventListener("ostt-workflow-practice", onCustom);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ostt-workflow-practice", onCustom);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeTopic(raw: unknown): TopicRecommendationDraft {
  if (!isRecord(raw)) return { ...EMPTY_TOPIC_RECOMMENDATION };
  return {
    topicIdeaId:
      typeof raw.topicIdeaId === "string" ? raw.topicIdeaId : null,
    scope: raw.scope === "statewide" || raw.scope === "county" ? raw.scope : null,
    countyFips: typeof raw.countyFips === "string" ? raw.countyFips : null,
    reasonId: typeof raw.reasonId === "string" ? raw.reasonId : null,
    startingSourceId:
      typeof raw.startingSourceId === "string" ? raw.startingSourceId : null,
    submittedAt: typeof raw.submittedAt === "string" ? raw.submittedAt : null,
  };
}

function sanitizeSource(raw: unknown): SourceContributionDraft {
  if (!isRecord(raw)) return { ...EMPTY_SOURCE_CONTRIBUTION };
  return {
    topicId: typeof raw.topicId === "string" ? raw.topicId : null,
    relationship:
      raw.relationship === "supporting" || raw.relationship === "counterevidence"
        ? raw.relationship
        : null,
    sourceFixtureId:
      typeof raw.sourceFixtureId === "string" ? raw.sourceFixtureId : null,
    customUrl: typeof raw.customUrl === "string" ? raw.customUrl : null,
    limitationsId:
      typeof raw.limitationsId === "string" ? raw.limitationsId : null,
    disclosureChoice:
      raw.disclosureChoice === "none" || raw.disclosureChoice === "disclose"
        ? raw.disclosureChoice
        : null,
    disclosureFixtureId:
      typeof raw.disclosureFixtureId === "string"
        ? raw.disclosureFixtureId
        : null,
    submittedAt: typeof raw.submittedAt === "string" ? raw.submittedAt : null,
    advancedToConsequence: raw.advancedToConsequence === true,
  };
}

function practiceEqual(
  a: WorkflowPracticeState,
  b: WorkflowPracticeState,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function readWorkflowPractice(): WorkflowPracticeState {
  if (typeof window === "undefined") {
    return EMPTY_WORKFLOW_PRACTICE;
  }
  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_PRACTICE_STORAGE_KEY);
    if (!raw) return EMPTY_WORKFLOW_PRACTICE;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return EMPTY_WORKFLOW_PRACTICE;
    return {
      topicRecommendation: sanitizeTopic(parsed.topicRecommendation),
      sourceContribution: sanitizeSource(parsed.sourceContribution),
    };
  } catch {
    return EMPTY_WORKFLOW_PRACTICE;
  }
}

export function getWorkflowPracticeSnapshot(): WorkflowPracticeState {
  const next = readWorkflowPractice();
  if (cached && practiceEqual(cached, next)) {
    return cached;
  }
  cached = next;
  return cached;
}

export function getServerWorkflowPracticeSnapshot(): WorkflowPracticeState {
  return EMPTY_WORKFLOW_PRACTICE;
}

export function writeWorkflowPractice(state: WorkflowPracticeState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    WORKFLOW_PRACTICE_STORAGE_KEY,
    JSON.stringify(state),
  );
  emit();
}

export function updateTopicRecommendationDraft(
  patch: Partial<TopicRecommendationDraft>,
): void {
  const current = readWorkflowPractice();
  writeWorkflowPractice({
    ...current,
    topicRecommendation: { ...current.topicRecommendation, ...patch },
  });
}

export function updateSourceContributionDraft(
  patch: Partial<SourceContributionDraft>,
): void {
  const current = readWorkflowPractice();
  writeWorkflowPractice({
    ...current,
    sourceContribution: { ...current.sourceContribution, ...patch },
  });
}

export function clearWorkflowPractice(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WORKFLOW_PRACTICE_STORAGE_KEY);
  emit();
}
