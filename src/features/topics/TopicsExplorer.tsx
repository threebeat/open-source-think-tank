"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { TopicCard } from "@/features/topics/TopicCard";
import type { Topic } from "@/domain/types";
import { TOPIC_STAGES, TOPIC_STATUSES } from "@/domain/status";
import { topicStageLabels, topicStatusLabels } from "@/lib/evidence-labels";
import { TENNESSEE_COUNTIES } from "@/lib/geography/tennessee-counties";
import {
  applyTopicsSearch,
  DEFAULT_TOPICS_SEARCH,
  hasNonDefaultAdvancedFilters,
  parseTopicsSearchParams,
  topicGeographyLabel,
  topicsSearchToParams,
  type JurisdictionFilter,
  type ProposedInclusion,
  type TopicSort,
  type TopicsSearchState,
} from "@/features/topics/topics-search";

type TopicsExplorerProps = {
  topics: Topic[];
};

function composeTopicsSearchState(
  baseline: TopicsSearchState,
  partial: Partial<TopicsSearchState>,
  subjects: string[],
): TopicsSearchState {
  const next: TopicsSearchState = { ...baseline, ...partial };
  if (next.jurisdiction !== "county") {
    next.countyFips = "all";
  }
  if (next.sort === "relevance" && !next.query.trim()) {
    next.sort = "updated";
  }
  if (next.subject !== "all" && !subjects.includes(next.subject)) {
    next.subject = "all";
  }
  return next;
}

function TopicsExplorerInner({ topics }: TopicsExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const urlState = useMemo(
    () => parseTopicsSearchParams(new URLSearchParams(urlKey)),
    [urlKey],
  );
  const [state, setState] = useState(urlState);
  const [syncedUrlKey, setSyncedUrlKey] = useState(urlKey);
  const [userOpened, setUserOpened] = useState(false);
  const [collapsedDespiteUrl, setCollapsedDespiteUrl] = useState(false);
  const [, startTransition] = useTransition();

  // Sync local filter state when the URL changes (Back/Forward / shared links).
  if (urlKey !== syncedUrlKey) {
    setSyncedUrlKey(urlKey);
    setState(urlState);
  }

  const subjects = useMemo(() => {
    return Array.from(
      new Set(topics.flatMap((topic) => topic.subjectTags)),
    ).sort();
  }, [topics]);

  const effectiveState = useMemo(
    () => composeTopicsSearchState(state, {}, subjects),
    [state, subjects],
  );

  const urlWantsAdvanced = hasNonDefaultAdvancedFilters(effectiveState);
  const advancedOpen = urlWantsAdvanced
    ? !collapsedDespiteUrl
    : userOpened;

  const results = useMemo(
    () => applyTopicsSearch(topics, effectiveState),
    [topics, effectiveState],
  );

  function replaceState(next: TopicsSearchState) {
    const params = topicsSearchToParams(next);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function update(partial: Partial<TopicsSearchState>) {
    setState((current) => {
      const next = composeTopicsSearchState(current, partial, subjects);
      // Defer URL writes so startTransition never runs during render (Strict Mode).
      queueMicrotask(() => {
        replaceState(next);
      });
      return next;
    });
  }

  function clearAll() {
    setUserOpened(false);
    setCollapsedDespiteUrl(false);
    setState(DEFAULT_TOPICS_SEARCH);
    queueMicrotask(() => {
      replaceState(DEFAULT_TOPICS_SEARCH);
    });
  }

  function toggleAdvanced() {
    if (advancedOpen) {
      if (urlWantsAdvanced) {
        setCollapsedDespiteUrl(true);
      } else {
        setUserOpened(false);
      }
    } else {
      setCollapsedDespiteUrl(false);
      setUserOpened(true);
    }
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (effectiveState.query.trim()) {
      chips.push({
        key: "q",
        label: `Search: ${effectiveState.query.trim()}`,
        clear: () => update({ query: "" }),
      });
    }
    if (effectiveState.jurisdiction === "statewide") {
      chips.push({
        key: "jurisdiction",
        label: "Tennessee statewide",
        clear: () => update({ jurisdiction: "all", countyFips: "all" }),
      });
    } else if (effectiveState.jurisdiction === "county") {
      const countyLabel =
        effectiveState.countyFips === "all"
          ? "All counties"
          : (TENNESSEE_COUNTIES.find(
              (county) => county.fips === effectiveState.countyFips,
            )?.name ?? effectiveState.countyFips) + " County";
      chips.push({
        key: "jurisdiction",
        label: `County: ${countyLabel}`,
        clear: () => update({ jurisdiction: "all", countyFips: "all" }),
      });
    }
    if (effectiveState.subject !== "all") {
      chips.push({
        key: "subject",
        label: `Subject: ${effectiveState.subject}`,
        clear: () => update({ subject: "all" }),
      });
    }
    if (effectiveState.stage !== "all") {
      chips.push({
        key: "stage",
        label: `Stage: ${topicStageLabels[effectiveState.stage]}`,
        clear: () => update({ stage: "all" }),
      });
    }
    if (effectiveState.status !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${topicStatusLabels[effectiveState.status]}`,
        clear: () => update({ status: "all" }),
      });
    }
    if (effectiveState.proposed === "include") {
      chips.push({
        key: "proposed",
        label: "Include proposed",
        clear: () => update({ proposed: "exclude" }),
      });
    } else if (effectiveState.proposed === "only") {
      chips.push({
        key: "proposed",
        label: "Proposed only",
        clear: () => update({ proposed: "exclude" }),
      });
    }
    if (
      effectiveState.sort !== "updated" &&
      !(effectiveState.sort === "relevance" && !effectiveState.query.trim())
    ) {
      chips.push({
        key: "sort",
        label: `Sort: ${sortLabel(effectiveState.sort)}`,
        clear: () => update({ sort: "updated" }),
      });
    }
    return chips;
    // update closes over current state; rebuild chips when filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional chip rebuild on filter state
  }, [effectiveState]);

  const fieldClass =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-md border border-border bg-surface p-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-foreground">Search topics</span>
          <input
            type="search"
            value={effectiveState.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Search titles, questions, subjects, or geography"
            className={fieldClass}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="topics-advanced-search"
            onClick={toggleAdvanced}
            className="min-h-11 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {advancedOpen ? "Hide advanced search" : "Advanced search"}
          </button>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm sm:max-w-xs">
            <span className="font-medium text-foreground">Sort</span>
            <select
              id="topic-sort"
              value={
                effectiveState.sort === "relevance" &&
                !effectiveState.query.trim()
                  ? "updated"
                  : effectiveState.sort
              }
              onChange={(event) =>
                update({ sort: event.target.value as TopicSort })
              }
              className={fieldClass}
            >
              {effectiveState.query.trim() ? (
                <option value="relevance">Relevance</option>
              ) : null}
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="stage">Process stage</option>
              <option value="geography">County / statewide</option>
            </select>
          </label>
        </div>

        {advancedOpen ? (
          <fieldset
            id="topics-advanced-search"
            className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <legend className="sr-only">Advanced search</legend>
            <h2 className="mb-2 font-heading text-lg text-foreground sm:col-span-2 lg:col-span-3">
              Advanced search
            </h2>

            <label className="block space-y-2 text-sm" htmlFor="topic-jurisdiction-filter">
              <span className="font-medium text-foreground">Jurisdiction</span>
              <select
                id="topic-jurisdiction-filter"
                value={effectiveState.jurisdiction}
                onChange={(event) =>
                  update({
                    jurisdiction: event.target.value as JurisdictionFilter,
                  })
                }
                className={fieldClass}
              >
                <option value="all">All active locations</option>
                <option value="statewide">Tennessee statewide</option>
                <option value="county">County</option>
              </select>
            </label>

            <label className="block space-y-2 text-sm" htmlFor="topic-county-filter">
              <span className="font-medium text-foreground">County</span>
              <select
                id="topic-county-filter"
                value={effectiveState.countyFips}
                disabled={effectiveState.jurisdiction !== "county"}
                onChange={(event) =>
                  update({ countyFips: event.target.value })
                }
                className={fieldClass}
              >
                <option value="all">All counties</option>
                {TENNESSEE_COUNTIES.map((county) => (
                  <option key={county.fips} value={county.fips}>
                    {county.name} County
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm" htmlFor="topic-subject-filter">
              <span className="font-medium text-foreground">Subject</span>
              <select
                id="topic-subject-filter"
                value={effectiveState.subject}
                onChange={(event) => update({ subject: event.target.value })}
                className={fieldClass}
              >
                <option value="all">All subjects</option>
                {subjects.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm" htmlFor="topic-stage-filter">
              <span className="font-medium text-foreground">Process stage</span>
              <select
                id="topic-stage-filter"
                value={effectiveState.stage}
                onChange={(event) =>
                  update({
                    stage: event.target.value as TopicsSearchState["stage"],
                  })
                }
                className={fieldClass}
              >
                <option value="all">All stages</option>
                {TOPIC_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {topicStageLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm" htmlFor="topic-status-filter">
              <span className="font-medium text-foreground">Status</span>
              <select
                id="topic-status-filter"
                value={effectiveState.status}
                onChange={(event) =>
                  update({
                    status: event.target.value as TopicsSearchState["status"],
                  })
                }
                className={fieldClass}
              >
                <option value="all">All statuses</option>
                {TOPIC_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {topicStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm" htmlFor="topic-proposed-filter">
              <span className="font-medium text-foreground">Proposed topics</span>
              <select
                id="topic-proposed-filter"
                value={effectiveState.proposed}
                onChange={(event) =>
                  update({
                    proposed: event.target.value as ProposedInclusion,
                  })
                }
                className={fieldClass}
              >
                <option value="exclude">Active only (default)</option>
                <option value="include">Include proposed</option>
                <option value="only">Proposed only</option>
              </select>
            </label>

            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
              Geography is a topic classification label only — not eligibility,
              residency, or voting. Default listing shows active synthetic topics;
              proposed topics appear only when inclusion is enabled. Filters apply
              only to local synthetic fixtures.
            </p>
          </fieldset>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {results.length} topic{results.length === 1 ? "" : "s"}
        </p>
        {activeChips.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="Active filters">
              {activeChips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={chip.clear}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {chip.label} ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={clearAll}
              className="min-h-9 rounded-md px-3 text-xs font-medium text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Clear all
            </button>
          </>
        ) : null}
      </div>

      {results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              geographyLabel={topicGeographyLabel(topic)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No topics match these filters"
          description="Clear filters or enable Include proposed if you are looking for proposed discovery fixtures. Search stays local to synthetic demonstration topics."
        />
      )}
    </div>
  );
}

function sortLabel(sort: TopicSort): string {
  switch (sort) {
    case "relevance":
      return "Relevance";
    case "title":
      return "Title A–Z";
    case "stage":
      return "Process stage";
    case "geography":
      return "County / statewide";
    case "updated":
    default:
      return "Recently updated";
  }
}

export function TopicsExplorer({ topics }: TopicsExplorerProps) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading topic search…</p>
      }
    >
      <TopicsExplorerInner topics={topics} />
    </Suspense>
  );
}
