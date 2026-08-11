"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { TopicCard } from "@/features/topics/TopicCard";
import type { Topic, TopicStage, TopicStatus } from "@/domain/types";
import { TOPIC_STAGES, TOPIC_STATUSES } from "@/domain/status";
import { topicStageLabels, topicStatusLabels } from "@/lib/evidence-labels";

type TopicsExplorerProps = {
  topics: Topic[];
};

function matchesQuery(topic: Topic, query: string): boolean {
  const haystack = [
    topic.title,
    topic.question,
    topic.background,
    topic.scope,
    ...topic.subjectTags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function TopicsExplorer({ topics }: TopicsExplorerProps) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | TopicStage>("all");
  const [subject, setSubject] = useState("all");
  const [status, setStatus] = useState<"all" | TopicStatus>("all");

  const subjects = useMemo(() => {
    return Array.from(
      new Set(topics.flatMap((topic) => topic.subjectTags)),
    ).sort();
  }, [topics]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (stage !== "all" && topic.stage !== stage) {
        return false;
      }
      if (status !== "all" && topic.status !== status) {
        return false;
      }
      if (subject !== "all" && !topic.subjectTags.includes(subject)) {
        return false;
      }
      if (normalized && !matchesQuery(topic, normalized)) {
        return false;
      }
      return true;
    });
  }, [topics, query, stage, subject, status]);

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-md border border-border bg-surface p-4 sm:grid-cols-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block space-y-2 text-sm sm:col-span-3">
          <span className="font-medium text-foreground">Search topics</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, questions, or subjects"
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="block space-y-2 text-sm" htmlFor="topic-stage-filter">
          <span className="font-medium text-foreground">Stage</span>
          <select
            id="topic-stage-filter"
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as "all" | TopicStage)
            }
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All stages</option>
            {TOPIC_STAGES.map((value) => (
              <option key={value} value={value}>
                {topicStageLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm" htmlFor="topic-subject-filter">
          <span className="font-medium text-foreground">Subject</span>
          <select
            id="topic-subject-filter"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All subjects</option>
            {subjects.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm" htmlFor="topic-status-filter">
          <span className="font-medium text-foreground">Status</span>
          <select
            id="topic-status-filter"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | TopicStatus)
            }
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All statuses</option>
            {TOPIC_STATUSES.map((value) => (
              <option key={value} value={value}>
                {topicStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Stage is the position in how the process works. Status is brief
          availability (open, paused, or closed) and is filtered independently.
          Filters apply only to local synthetic fixtures.
        </p>
      </form>

      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No topics match these filters"
          description="Clear the search box or choose All stages / All subjects / All statuses to see the synthetic demonstration topics again."
        />
      )}
    </div>
  );
}
