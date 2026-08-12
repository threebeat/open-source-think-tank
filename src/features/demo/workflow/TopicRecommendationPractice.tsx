"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import {
  findReason,
  findStartingSource,
  findTopicIdea,
  PRACTICE_REASONS,
  PRACTICE_STARTING_SOURCES,
  PRACTICE_TOPIC_IDEAS,
} from "@/features/demo/workflow/practice-fixtures";
import {
  type TopicRecommendationStep,
  workflowDemoHref,
} from "@/features/demo/workflow/workflow-query";
import {
  getServerWorkflowPracticeSnapshot,
  getWorkflowPracticeSnapshot,
  subscribeWorkflowPractice,
  updateTopicRecommendationDraft,
} from "@/features/demo/workflow/workflow-storage";
import { TENNESSEE_COUNTIES } from "@/lib/geography/tennessee-counties";
import { cn } from "@/lib/utils";

const STEP_HEADINGS: Record<TopicRecommendationStep, string> = {
  choose: "Choose a topic idea",
  scope: "Choose geography scope",
  details: "Why this matters",
  review: "Review practice recommendation",
  receipt: "Practice recommendation submitted",
};

type Props = {
  step: TopicRecommendationStep;
};

export function TopicRecommendationPractice({ step }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const liveId = useId();
  const [liveMessage, setLiveMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const practice = useSyncExternalStore(
    subscribeWorkflowPractice,
    getWorkflowPracticeSnapshot,
    getServerWorkflowPracticeSnapshot,
  );
  const draft = practice.topicRecommendation;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function go(nextStep: TopicRecommendationStep) {
    const href = workflowDemoHref({
      task: "topic-recommendation",
      step: nextStep,
      explorer: null,
    });
    startTransition(() => {
      router.replace(href.startsWith(pathname) ? href : href, { scroll: false });
    });
  }

  function validateForStep(target: TopicRecommendationStep): boolean {
    const errors: Record<string, string> = {};
    if (target === "scope" || target === "details" || target === "review") {
      if (!draft.topicIdeaId) {
        errors.topicIdeaId = "Select a synthetic topic idea to continue.";
      }
    }
    if (target === "details" || target === "review") {
      if (!draft.scope) {
        errors.scope = "Choose statewide or county scope.";
      }
      if (draft.scope === "county" && !draft.countyFips) {
        errors.countyFips = "Select a Tennessee county.";
      }
    }
    if (target === "review") {
      if (!draft.reasonId) {
        errors.reasonId = "Choose why this matters.";
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0] ?? "Fix the highlighted fields.";
      setLiveMessage(first);
      return false;
    }
    setLiveMessage("");
    return true;
  }

  function continueFrom(current: TopicRecommendationStep) {
    const order: TopicRecommendationStep[] = [
      "choose",
      "scope",
      "details",
      "review",
      "receipt",
    ];
    const idx = order.indexOf(current);
    const next = order[idx + 1];
    if (!next) return;
    if (next !== "receipt" && !validateForStep(next)) return;
    if (next === "receipt") {
      if (!validateForStep("review")) return;
      updateTopicRecommendationDraft({
        submittedAt: new Date().toISOString(),
      });
      setLiveMessage(
        "Practice recommendation stored in this browser session only.",
      );
    } else {
      setLiveMessage(`Moved to ${STEP_HEADINGS[next]}.`);
    }
    go(next);
  }

  function backFrom(current: TopicRecommendationStep) {
    const order: TopicRecommendationStep[] = [
      "choose",
      "scope",
      "details",
      "review",
      "receipt",
    ];
    const idx = order.indexOf(current);
    const prev = order[idx - 1];
    if (!prev) {
      startTransition(() => {
        router.replace("/demo/workflow", { scroll: false });
      });
      return;
    }
    setLiveMessage(`Returned to ${STEP_HEADINGS[prev]}.`);
    go(prev);
  }

  const topic = findTopicIdea(draft.topicIdeaId);
  const reason = findReason(draft.reasonId);
  const starting = findStartingSource(draft.startingSourceId);
  const county =
    TENNESSEE_COUNTIES.find((item) => item.fips === draft.countyFips) ?? null;

  return (
    <div className="space-y-6" data-testid="topic-recommendation-practice">
      <DisclosureNotice title="Synthetic topic-recommendation practice" tone="caution">
        <p>Stored in this browser session only. Not submitted to the alpha.</p>
        <p className="mt-2">
          A recommendation does not automatically become a topic, receive
          priority, or represent popular support. This is an interaction
          prototype for local practice until a future package authorizes gated
          intake.
        </p>
      </DisclosureNotice>

      <p className="sr-only" aria-live="polite" id={liveId}>
        {liveMessage}
      </p>

      <section className="space-y-4" aria-labelledby="topic-rec-step-heading">
        <h2
          id="topic-rec-step-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {STEP_HEADINGS[step]}
        </h2>
        <p className="text-sm text-muted-foreground" role="status">
          Step {["choose", "scope", "details", "review", "receipt"].indexOf(step) + 1}{" "}
          of 5
        </p>

        {step === "choose" ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Synthetic Tennessee topic ideas
            </legend>
            {PRACTICE_TOPIC_IDEAS.map((idea) => (
              <label
                key={idea.id}
                className="flex min-h-11 cursor-pointer gap-3 rounded-md border border-border px-3 py-3 text-base"
              >
                <input
                  type="radio"
                  name="topic-idea"
                  className="mt-1 size-4"
                  checked={draft.topicIdeaId === idea.id}
                  onChange={() => {
                    updateTopicRecommendationDraft({
                      topicIdeaId: idea.id,
                      submittedAt: null,
                    });
                    setFieldErrors((prev) => ({ ...prev, topicIdeaId: "" }));
                  }}
                />
                <span>
                  <span className="block font-medium text-foreground">
                    {idea.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {idea.blurb}
                  </span>
                </span>
              </label>
            ))}
            {fieldErrors.topicIdeaId ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.topicIdeaId}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === "scope" ? (
          <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Geography scope
              </legend>
              {(
                [
                  ["statewide", "Statewide"],
                  ["county", "County"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-base"
                >
                  <input
                    type="radio"
                    name="scope"
                    className="size-4"
                    checked={draft.scope === value}
                    onChange={() => {
                      updateTopicRecommendationDraft({
                        scope: value,
                        countyFips: value === "statewide" ? null : draft.countyFips,
                        submittedAt: null,
                      });
                      setFieldErrors((prev) => ({
                        ...prev,
                        scope: "",
                        countyFips: "",
                      }));
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
              {fieldErrors.scope ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.scope}
                </p>
              ) : null}
            </fieldset>
            {draft.scope === "county" ? (
              <label className="block space-y-2 text-base">
                <span className="font-medium text-foreground">
                  Tennessee county
                </span>
                <select
                  className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                  value={draft.countyFips ?? ""}
                  onChange={(event) => {
                    updateTopicRecommendationDraft({
                      countyFips: event.target.value || null,
                      submittedAt: null,
                    });
                    setFieldErrors((prev) => ({ ...prev, countyFips: "" }));
                  }}
                >
                  <option value="">Select a county</option>
                  {TENNESSEE_COUNTIES.map((item) => (
                    <option key={item.fips} value={item.fips}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.countyFips ? (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors.countyFips}
                  </p>
                ) : null}
              </label>
            ) : null}
          </div>
        ) : null}

        {step === "details" ? (
          <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Why this matters
              </legend>
              {PRACTICE_REASONS.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-base"
                >
                  <input
                    type="radio"
                    name="reason"
                    className="size-4"
                    checked={draft.reasonId === item.id}
                    onChange={() => {
                      updateTopicRecommendationDraft({
                        reasonId: item.id,
                        submittedAt: null,
                      });
                      setFieldErrors((prev) => ({ ...prev, reasonId: "" }));
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
              {fieldErrors.reasonId ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.reasonId}
                </p>
              ) : null}
            </fieldset>
            <label className="block space-y-2 text-base">
              <span className="font-medium text-foreground">
                Optional starting source
              </span>
              <select
                className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                value={draft.startingSourceId ?? "source-none"}
                onChange={(event) => {
                  updateTopicRecommendationDraft({
                    startingSourceId: event.target.value,
                    submittedAt: null,
                  });
                }}
              >
                {PRACTICE_STARTING_SOURCES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-4 text-sm">
            <DisclosureNotice title="What would be public" tone="neutral">
              Topic idea title, geography scope, and the selected “why this
              matters” reason would be visible if a real intake existed.
            </DisclosureNotice>
            <DisclosureNotice title="What remains protected" tone="neutral">
              Account identifiers, contact channels, and any private notes stay
              protected. This practice draft never leaves your browser session.
            </DisclosureNotice>
            <dl className="space-y-3">
              <div>
                <dt className="font-medium text-foreground">Topic idea</dt>
                <dd className="text-muted-foreground">{topic?.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Scope</dt>
                <dd className="text-muted-foreground">
                  {draft.scope === "county"
                    ? `County — ${county?.name ?? "Tennessee county"}`
                    : draft.scope === "statewide"
                      ? "Statewide"
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Why it matters</dt>
                <dd className="text-muted-foreground">{reason?.label ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Starting source</dt>
                <dd className="break-all text-muted-foreground">
                  {starting?.label ?? "None"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {step === "receipt" ? (
          <div className="space-y-4 text-sm">
            <DisclosureNotice title="Local confirmation" tone="neutral">
              Practice recommendation receipt stored in this browser session
              only. Not submitted to the alpha.
            </DisclosureNotice>
            <p className="text-muted-foreground">
              Next institutional step in a real service would be{" "}
              <span className="font-medium text-foreground">staff scoping</span>
              — not automatic adoption, ranking, or priority.
            </p>
            <p className="text-muted-foreground">
              Submitted locally at {draft.submittedAt ?? "this session"}.
            </p>
            <p className="font-medium text-foreground">
              A recommendation does not automatically become a topic, receive
              priority, or represent popular support.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step !== "receipt" ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
              onClick={() => continueFrom(step)}
            >
              {step === "review"
                ? "Submit practice recommendation"
                : "Continue"}
            </button>
          ) : null}
          {step === "review" ? (
            <button
              type="button"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-h-11",
              )}
              onClick={() => {
                setLiveMessage("Returned to edit choices.");
                go("choose");
              }}
            >
              Back / Edit
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-h-11",
              )}
              onClick={() => backFrom(step)}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "min-h-11",
            )}
            onClick={() => {
              updateTopicRecommendationDraft({
                topicIdeaId: null,
                scope: null,
                countyFips: null,
                reasonId: null,
                startingSourceId: null,
                submittedAt: null,
              });
              setLiveMessage("Topic recommendation practice cleared.");
              go("choose");
            }}
          >
            Reset this practice
          </button>
          <Link
            href="/demo/workflow"
            className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "min-h-11")}
          >
            Practice home
          </Link>
        </div>
      </section>
    </div>
  );
}
