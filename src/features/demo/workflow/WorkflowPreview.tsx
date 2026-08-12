"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import { SnapshotExplorer } from "@/features/demo/workflow/SnapshotExplorer";
import { SourceContributionPractice } from "@/features/demo/workflow/SourceContributionPractice";
import { TopicRecommendationPractice } from "@/features/demo/workflow/TopicRecommendationPractice";
import {
  DEFAULT_WORKFLOW_DEMO_QUERY,
  isSourceContributionStep,
  isTopicRecommendationStep,
  parseWorkflowDemoQuery,
  serializeWorkflowDemoQuery,
  type WorkflowDemoQuery,
  workflowDemoHref,
} from "@/features/demo/workflow/workflow-query";
import { clearWorkflowPractice } from "@/features/demo/workflow/workflow-storage";
import { cn } from "@/lib/utils";

export function WorkflowPreview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const urlQuery = useMemo(
    () => parseWorkflowDemoQuery(new URLSearchParams(urlKey)),
    [urlKey],
  );
  const [query, setQuery] = useState(urlQuery);
  const [syncedUrlKey, setSyncedUrlKey] = useState(urlKey);

  if (urlKey !== syncedUrlKey) {
    setSyncedUrlKey(urlKey);
    setQuery(urlQuery);
  }

  function replaceDemoQuery(next: WorkflowDemoQuery) {
    setQuery(next);
    const params = serializeWorkflowDemoQuery(next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  if (query.task === "explore") {
    return (
      <div className="space-y-6">
        <SnapshotExplorer />
      </div>
    );
  }

  if (query.task === "topic-recommendation") {
    const step = isTopicRecommendationStep(query.step)
      ? query.step
      : "choose";
    return <TopicRecommendationPractice step={step} />;
  }

  if (query.task === "source-contribution") {
    const step = isSourceContributionStep(query.step) ? query.step : "topic";
    return <SourceContributionPractice step={step} />;
  }

  return (
    <div className="space-y-8" data-testid="workflow-practice-home">
      <DisclosureNotice title="Synthetic practice journeys" tone="caution">
        These local practice tasks teach how someone would operate the service.
        Choices are stored in this browser session only, are resettable, and are
        never submitted to the alpha or a participant datastore.
      </DisclosureNotice>

      <section
        className="space-y-4"
        aria-labelledby="workflow-practice-home-heading"
      >
        <h2
          id="workflow-practice-home-heading"
          className="font-heading text-xl text-foreground"
        >
          Practice how someone would use the service
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a task. You will make choices, see validation, review, submit
          locally, and see the next institutional step — without calling gated
          APIs.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
            onClick={() =>
              replaceDemoQuery({
                task: "topic-recommendation",
                step: "choose",
                explorer: null,
              })
            }
          >
            Recommend a topic
          </button>
          <button
            type="button"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "min-h-11",
            )}
            onClick={() =>
              replaceDemoQuery({
                task: "source-contribution",
                step: "topic",
                explorer: null,
              })
            }
          >
            Contribute a source
          </button>
        </div>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="workflow-secondary-explorer-heading"
      >
        <h2
          id="workflow-secondary-explorer-heading"
          className="font-heading text-xl text-foreground"
        >
          Explore example staff and visitor states
        </h2>
        <p className="text-sm text-muted-foreground">
          Secondary reference snapshots for phone review of role and moderation
          states. Prefer the practice tasks above for the user journey.
        </p>
        <Link
          href={workflowDemoHref({
            task: "explore",
            step: null,
            explorer: { view: "participant", state: "visible" },
          })}
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "min-h-11",
          )}
        >
          Open snapshot explorer
        </Link>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={cn(
            buttonVariants({ size: "lg", variant: "ghost" }),
            "min-h-11",
          )}
          onClick={() => {
            clearWorkflowPractice();
            replaceDemoQuery(DEFAULT_WORKFLOW_DEMO_QUERY);
          }}
        >
          Reset workflow practice
        </button>
        <Link
          href="/demo"
          className={cn(
            buttonVariants({ size: "lg", variant: "ghost" }),
            "min-h-11",
          )}
        >
          Back to guided demo
        </Link>
      </div>
    </div>
  );
}
