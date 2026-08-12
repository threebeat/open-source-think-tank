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
  findDisclosure,
  findLimitations,
  findOpenTopic,
  findSourceOption,
  PRACTICE_DISCLOSURES,
  PRACTICE_LIMITATIONS,
  PRACTICE_OPEN_TOPICS,
  PRACTICE_SOURCE_OPTIONS,
} from "@/features/demo/workflow/practice-fixtures";
import {
  type SourceContributionStep,
  workflowDemoHref,
} from "@/features/demo/workflow/workflow-query";
import {
  getServerWorkflowPracticeSnapshot,
  getWorkflowPracticeSnapshot,
  subscribeWorkflowPractice,
  updateSourceContributionDraft,
} from "@/features/demo/workflow/workflow-storage";
import {
  sourceUrlErrorMessage,
  validateSourceUrl,
  type SourceUrlErrorCategory,
} from "@/lib/security/source-url";
import { cn } from "@/lib/utils";

const STEP_HEADINGS: Record<SourceContributionStep, string> = {
  topic: "Choose an open topic",
  relationship: "Supporting or counterevidence",
  url: "Choose a source URL example",
  details: "Limitations and conflict disclosure",
  review: "Review practice contribution",
  receipt: "Practice contribution submitted",
  consequence: "Example review and public consequence",
};

type Props = {
  step: SourceContributionStep;
};

function resolveUrl(
  sourceFixtureId: string | null,
  customUrl: string | null,
): { url: string; category?: SourceUrlErrorCategory } {
  const fixture = findSourceOption(sourceFixtureId);
  if (fixture) {
    return {
      url: fixture.url,
      category: fixture.kind === "unsafe" ? fixture.category : undefined,
    };
  }
  return { url: customUrl ?? "" };
}

export function SourceContributionPractice({ step }: Props) {
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
  const draft = practice.sourceContribution;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function go(nextStep: SourceContributionStep) {
    const href = workflowDemoHref({
      task: "source-contribution",
      step: nextStep,
      explorer: null,
    });
    startTransition(() => {
      router.replace(href.startsWith(pathname) ? href : href, { scroll: false });
    });
  }

  function validateUrlStep(): boolean {
    const { url } = resolveUrl(draft.sourceFixtureId, draft.customUrl);
    if (!draft.sourceFixtureId && !draft.customUrl?.trim()) {
      setFieldErrors({
        source: "Select a source fixture or enter a URL example.",
      });
      setLiveMessage("Select a source fixture or enter a URL example.");
      return false;
    }
    const result = validateSourceUrl(url);
    if (!result.ok) {
      setFieldErrors({ source: result.message });
      setLiveMessage(result.message);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function validateFor(next: SourceContributionStep): boolean {
    const errors: Record<string, string> = {};
    if (next !== "topic" && !draft.topicId) {
      errors.topicId = "Select an open synthetic topic.";
    }
    if (
      (next === "url" ||
        next === "details" ||
        next === "review" ||
        next === "receipt") &&
      !draft.relationship
    ) {
      errors.relationship = "Choose supporting or counterevidence.";
    }
    if (
      next === "details" ||
      next === "review" ||
      next === "receipt"
    ) {
      if (!validateUrlStep()) return false;
    }
    if (next === "review" || next === "receipt") {
      if (!draft.limitationsId) {
        errors.limitationsId = "Select limitations for this source.";
      }
      if (!draft.disclosureChoice) {
        errors.disclosureChoice = "Choose a conflict-disclosure option.";
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...errors }));
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0] ?? "Fix the highlighted fields.";
      setLiveMessage(first);
      return false;
    }
    return true;
  }

  function continueFrom(current: SourceContributionStep) {
    const order: SourceContributionStep[] = [
      "topic",
      "relationship",
      "url",
      "details",
      "review",
      "receipt",
      "consequence",
    ];
    const idx = order.indexOf(current);
    const next = order[idx + 1];
    if (!next) return;
    if (next === "receipt") {
      if (!validateFor("review")) return;
      updateSourceContributionDraft({
        submittedAt: new Date().toISOString(),
      });
      setLiveMessage(
        "Practice source contribution stored in this browser session only.",
      );
      go(next);
      return;
    }
    if (next === "consequence") {
      updateSourceContributionDraft({ advancedToConsequence: true });
      setLiveMessage("Showing example review and public-projection consequences.");
      go(next);
      return;
    }
    if (!validateFor(next)) return;
    setLiveMessage(`Moved to ${STEP_HEADINGS[next]}.`);
    go(next);
  }

  function backFrom(current: SourceContributionStep) {
    const order: SourceContributionStep[] = [
      "topic",
      "relationship",
      "url",
      "details",
      "review",
      "receipt",
      "consequence",
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

  const topic = findOpenTopic(draft.topicId);
  const source = findSourceOption(draft.sourceFixtureId);
  const limitations = findLimitations(draft.limitationsId);
  const disclosure = findDisclosure(draft.disclosureFixtureId);
  const resolved = resolveUrl(draft.sourceFixtureId, draft.customUrl);
  const validation = resolved.url
    ? validateSourceUrl(resolved.url)
    : null;

  return (
    <div className="space-y-6" data-testid="source-contribution-practice">
      <DisclosureNotice title="Synthetic source-contribution practice" tone="caution">
        Stored in this browser session only. Not submitted to the alpha. Unsafe
        URL examples use the same plain-language validation categories as the
        gated source policy. No remote fetch occurs.
      </DisclosureNotice>

      <p className="sr-only" aria-live="polite" id={liveId}>
        {liveMessage}
      </p>

      <section className="space-y-4" aria-labelledby="source-step-heading">
        <h2
          id="source-step-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {STEP_HEADINGS[step]}
        </h2>
        <p className="text-sm text-muted-foreground" role="status">
          Step{" "}
          {(
            [
              "topic",
              "relationship",
              "url",
              "details",
              "review",
              "receipt",
              "consequence",
            ] as const
          ).indexOf(step) + 1}{" "}
          of 7
        </p>

        {step === "topic" ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Open synthetic topics
            </legend>
            {PRACTICE_OPEN_TOPICS.map((item) => (
              <label
                key={item.id}
                className="flex min-h-11 cursor-pointer gap-3 rounded-md border border-border px-3 py-3 text-base"
              >
                <input
                  type="radio"
                  name="open-topic"
                  className="mt-1 size-4"
                  checked={draft.topicId === item.id}
                  onChange={() => {
                    updateSourceContributionDraft({
                      topicId: item.id,
                      submittedAt: null,
                      advancedToConsequence: false,
                    });
                    setFieldErrors((prev) => ({ ...prev, topicId: "" }));
                  }}
                />
                <span>
                  <span className="block font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {item.blurb}
                  </span>
                </span>
              </label>
            ))}
            {fieldErrors.topicId ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.topicId}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === "relationship" ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Relationship to the claim
            </legend>
            {(
              [
                ["supporting", "Supporting"],
                ["counterevidence", "Counterevidence"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-base"
              >
                <input
                  type="radio"
                  name="relationship"
                  className="size-4"
                  checked={draft.relationship === value}
                  onChange={() => {
                    updateSourceContributionDraft({
                      relationship: value,
                      submittedAt: null,
                    });
                    setFieldErrors((prev) => ({ ...prev, relationship: "" }));
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
            {fieldErrors.relationship ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.relationship}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === "url" ? (
          <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Source fixtures
              </legend>
              {PRACTICE_SOURCE_OPTIONS.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer gap-3 rounded-md border border-border px-3 py-3 text-base"
                >
                  <input
                    type="radio"
                    name="source-fixture"
                    className="mt-1 size-4"
                    checked={draft.sourceFixtureId === item.id}
                    onChange={() => {
                      updateSourceContributionDraft({
                        sourceFixtureId: item.id,
                        customUrl: null,
                        submittedAt: null,
                      });
                      setFieldErrors((prev) => ({ ...prev, source: "" }));
                    }}
                  />
                  <span>
                    <span className="block font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-1 block break-all text-sm text-muted-foreground">
                      {item.url}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {fieldErrors.source ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="source-url-error"
              >
                {fieldErrors.source}
              </p>
            ) : null}
            {draft.sourceFixtureId && validation && !validation.ok ? (
              <p className="text-sm text-muted-foreground" role="status">
                Validation category: {validation.category}.{" "}
                {sourceUrlErrorMessage(validation.category)}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "details" ? (
          <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Limitations
              </legend>
              {PRACTICE_LIMITATIONS.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-base"
                >
                  <input
                    type="radio"
                    name="limitations"
                    className="size-4"
                    checked={draft.limitationsId === item.id}
                    onChange={() => {
                      updateSourceContributionDraft({
                        limitationsId: item.id,
                        submittedAt: null,
                      });
                      setFieldErrors((prev) => ({
                        ...prev,
                        limitationsId: "",
                      }));
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
              {fieldErrors.limitationsId ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.limitationsId}
                </p>
              ) : null}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Conflict disclosure
              </legend>
              {PRACTICE_DISCLOSURES.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer gap-3 rounded-md border border-border px-3 py-3 text-base"
                >
                  <input
                    type="radio"
                    name="disclosure"
                    className="mt-1 size-4"
                    checked={draft.disclosureFixtureId === item.id}
                    onChange={() => {
                      updateSourceContributionDraft({
                        disclosureFixtureId: item.id,
                        disclosureChoice: item.choice,
                        submittedAt: null,
                      });
                      setFieldErrors((prev) => ({
                        ...prev,
                        disclosureChoice: "",
                      }));
                    }}
                  />
                  <span>
                    <span className="block font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {item.publicSummary}
                    </span>
                  </span>
                </label>
              ))}
              {fieldErrors.disclosureChoice ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.disclosureChoice}
                </p>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {step === "review" ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-foreground">Topic</dt>
              <dd className="text-muted-foreground">{topic?.title ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Relationship</dt>
              <dd className="text-muted-foreground">
                {draft.relationship ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Source</dt>
              <dd className="break-all text-muted-foreground">
                {source?.label ?? resolved.url}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Limitations</dt>
              <dd className="text-muted-foreground">
                {limitations?.label ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Conflict disclosure</dt>
              <dd className="text-muted-foreground">
                {disclosure?.publicSummary ?? "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        {step === "receipt" ? (
          <div className="space-y-3 text-sm">
            <DisclosureNotice title="Local confirmation" tone="neutral">
              Practice contribution receipt stored in this browser session only.
              The sealed fixture report is unchanged. No other live participants
              are implied.
            </DisclosureNotice>
            <p className="text-muted-foreground">
              Submitted locally at {draft.submittedAt ?? "this session"}.
            </p>
          </div>
        ) : null}

        {step === "consequence" ? (
          <div className="space-y-3 text-sm">
            <DisclosureNotice title="Example next states" tone="neutral">
              In the gated alpha, staff could independently review workflow,
              record an evidence-quality decision, or apply moderation
              visibility. Those axes stay separate from this local practice
              draft.
            </DisclosureNotice>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Example review: changes requested or accepted (human decision).</li>
              <li>
                Example moderation: hold/hide with a public rationale; history
                retained.
              </li>
              <li>
                Example public projection: only published, visible, allowlisted
                fields become clickable when the URL passes the shared https
                policy.
              </li>
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step !== "consequence" ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
              onClick={() => continueFrom(step)}
            >
              {step === "review"
                ? "Submit practice contribution"
                : step === "receipt"
                  ? "Show example consequences"
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
                setLiveMessage("Returned to edit the source URL choice.");
                go("url");
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
          <Link
            href="/demo/workflow"
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "min-h-11",
            )}
          >
            Practice home
          </Link>
        </div>
      </section>
    </div>
  );
}
