import type { Topic, TopicStage, TopicStatus } from "@/domain/types";
import { TOPIC_STAGES, TOPIC_STATUSES } from "@/domain/status";
import {
  formatTopicGeography,
  isTennesseeCountyFips,
} from "@/lib/geography/tennessee-counties";

export type JurisdictionFilter = "all" | "statewide" | "county";
export type ProposedInclusion = "exclude" | "include" | "only";
export type TopicSort =
  | "relevance"
  | "updated"
  | "title"
  | "stage"
  | "geography";

export type TopicsSearchState = {
  query: string;
  jurisdiction: JurisdictionFilter;
  countyFips: "all" | string;
  subject: "all" | string;
  stage: "all" | TopicStage;
  status: "all" | TopicStatus;
  proposed: ProposedInclusion;
  sort: TopicSort;
};

export const DEFAULT_TOPICS_SEARCH: TopicsSearchState = {
  query: "",
  jurisdiction: "all",
  countyFips: "all",
  subject: "all",
  stage: "all",
  status: "all",
  proposed: "exclude",
  sort: "updated",
};

const JURISDICTIONS = new Set<JurisdictionFilter>([
  "all",
  "statewide",
  "county",
]);
const PROPOSED = new Set<ProposedInclusion>(["exclude", "include", "only"]);
const SORTS = new Set<TopicSort>([
  "relevance",
  "updated",
  "title",
  "stage",
  "geography",
]);
const STAGES = new Set<string>(TOPIC_STAGES);
const STATUSES = new Set<string>(TOPIC_STATUSES);

export function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function topicGeographyLabel(topic: Topic): string {
  return formatTopicGeography({
    jurisdictionLevel: topic.jurisdictionLevel,
    stateCode: topic.stateCode,
    countyFips: topic.countyFips,
  });
}

export function topicUpdatedAt(topic: Topic): string {
  const dates = topic.changelog.map((entry) => entry.at);
  if (dates.length === 0) {
    return "0000-00-00";
  }
  return dates.reduce((latest, at) => (at > latest ? at : latest));
}

export function matchesTopicQuery(topic: Topic, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const haystack = normalizeSearchText(
    [
      topic.title,
      topic.question,
      topic.background,
      topic.scope,
      ...topic.subjectTags,
      topicGeographyLabel(topic),
    ].join(" "),
  );
  return haystack.includes(normalizedQuery);
}

export function parseTopicsSearchParams(
  params: URLSearchParams,
): TopicsSearchState {
  const query = params.get("q")?.trim() ?? "";

  const jurisdictionRaw = params.get("jurisdiction") ?? "all";
  const jurisdiction = JURISDICTIONS.has(jurisdictionRaw as JurisdictionFilter)
    ? (jurisdictionRaw as JurisdictionFilter)
    : "all";

  const countyRaw = params.get("county") ?? "all";
  const countyFips =
    countyRaw === "all" || isTennesseeCountyFips(countyRaw) ? countyRaw : "all";

  const subjectRaw = params.get("subject")?.trim() || "all";
  const subject = subjectRaw === "" ? "all" : subjectRaw;

  const stageRaw = params.get("stage") ?? "all";
  const stage =
    stageRaw === "all" || STAGES.has(stageRaw)
      ? (stageRaw as "all" | TopicStage)
      : "all";

  const statusRaw = params.get("status") ?? "all";
  const status =
    statusRaw === "all" || STATUSES.has(statusRaw)
      ? (statusRaw as "all" | TopicStatus)
      : "all";

  const proposedRaw = params.get("proposed") ?? "exclude";
  const proposed = PROPOSED.has(proposedRaw as ProposedInclusion)
    ? (proposedRaw as ProposedInclusion)
    : "exclude";

  const sortRaw = params.get("sort") ?? "updated";
  let sort = SORTS.has(sortRaw as TopicSort)
    ? (sortRaw as TopicSort)
    : DEFAULT_TOPICS_SEARCH.sort;
  if (sort === "relevance" && !query) {
    sort = "updated";
  }

  return {
    query,
    jurisdiction,
    countyFips: jurisdiction === "county" ? countyFips : "all",
    subject,
    stage,
    status,
    proposed,
    sort,
  };
}

export function topicsSearchToParams(state: TopicsSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const trimmed = state.query.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }
  if (state.jurisdiction !== "all") {
    params.set("jurisdiction", state.jurisdiction);
  }
  if (state.jurisdiction === "county" && state.countyFips !== "all") {
    params.set("county", state.countyFips);
  }
  if (state.subject !== "all") {
    params.set("subject", state.subject);
  }
  if (state.stage !== "all") {
    params.set("stage", state.stage);
  }
  if (state.status !== "all") {
    params.set("status", state.status);
  }
  if (state.proposed !== "exclude") {
    params.set("proposed", state.proposed);
  }
  const effectiveSort =
    state.sort === "relevance" && !trimmed ? "updated" : state.sort;
  if (effectiveSort !== "updated") {
    params.set("sort", effectiveSort);
  }
  return params;
}

export function hasNonDefaultAdvancedFilters(state: TopicsSearchState): boolean {
  return (
    state.jurisdiction !== DEFAULT_TOPICS_SEARCH.jurisdiction ||
    (state.jurisdiction === "county" &&
      state.countyFips !== DEFAULT_TOPICS_SEARCH.countyFips) ||
    state.subject !== DEFAULT_TOPICS_SEARCH.subject ||
    state.stage !== DEFAULT_TOPICS_SEARCH.stage ||
    state.status !== DEFAULT_TOPICS_SEARCH.status ||
    state.proposed !== DEFAULT_TOPICS_SEARCH.proposed
  );
}

export function filterTopics(
  topics: Topic[],
  state: TopicsSearchState,
): Topic[] {
  const normalized = normalizeSearchText(state.query);
  return topics.filter((topic) => {
    if (state.proposed === "exclude" && topic.discoveryState !== "active") {
      return false;
    }
    if (state.proposed === "only" && topic.discoveryState !== "proposed") {
      return false;
    }
    if (state.jurisdiction === "statewide") {
      if (topic.jurisdictionLevel !== "statewide") {
        return false;
      }
    } else if (state.jurisdiction === "county") {
      if (topic.jurisdictionLevel !== "county") {
        return false;
      }
      if (
        state.countyFips !== "all" &&
        topic.countyFips !== state.countyFips
      ) {
        return false;
      }
    }
    if (state.subject !== "all" && !topic.subjectTags.includes(state.subject)) {
      return false;
    }
    if (state.stage !== "all" && topic.stage !== state.stage) {
      return false;
    }
    if (state.status !== "all" && topic.status !== state.status) {
      return false;
    }
    if (!matchesTopicQuery(topic, normalized)) {
      return false;
    }
    return true;
  });
}

function stageRank(stage: TopicStage): number {
  return TOPIC_STAGES.indexOf(stage);
}

function geographySortKey(topic: Topic): string {
  if (topic.jurisdictionLevel === "statewide") {
    return `0:${topicGeographyLabel(topic)}`;
  }
  return `1:${topicGeographyLabel(topic)}`;
}

function relevanceScore(topic: Topic, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return 0;
  }
  const title = normalizeSearchText(topic.title);
  const question = normalizeSearchText(topic.question);
  const tags = normalizeSearchText(topic.subjectTags.join(" "));
  const geography = normalizeSearchText(topicGeographyLabel(topic));
  let score = 0;
  if (title.includes(normalizedQuery)) {
    score += 100;
  }
  if (question.includes(normalizedQuery)) {
    score += 60;
  }
  if (tags.includes(normalizedQuery)) {
    score += 40;
  }
  if (geography.includes(normalizedQuery)) {
    score += 30;
  }
  if (
    normalizeSearchText(`${topic.background} ${topic.scope}`).includes(
      normalizedQuery,
    )
  ) {
    score += 10;
  }
  return score;
}

export function sortTopics(
  topics: Topic[],
  state: TopicsSearchState,
): Topic[] {
  const normalized = normalizeSearchText(state.query);
  const sort =
    state.sort === "relevance" && !normalized ? "updated" : state.sort;
  const sorted = [...topics];
  sorted.sort((a, b) => {
    switch (sort) {
      case "relevance": {
        const scoreDiff =
          relevanceScore(b, normalized) - relevanceScore(a, normalized);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "title":
        return a.title.localeCompare(b.title);
      case "stage": {
        const stageDiff = stageRank(a.stage) - stageRank(b.stage);
        if (stageDiff !== 0) {
          return stageDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "geography": {
        const geoDiff = geographySortKey(a).localeCompare(geographySortKey(b));
        if (geoDiff !== 0) {
          return geoDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "updated":
      default: {
        const updatedDiff = topicUpdatedAt(b).localeCompare(topicUpdatedAt(a));
        if (updatedDiff !== 0) {
          return updatedDiff;
        }
        return a.title.localeCompare(b.title);
      }
    }
  });
  return sorted;
}

export function applyTopicsSearch(
  topics: Topic[],
  state: TopicsSearchState,
): Topic[] {
  return sortTopics(filterTopics(topics, state), state);
}
