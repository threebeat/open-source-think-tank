"use client";

import { useState } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { Button } from "@/components/ui/button";
import {
  conductPlaceholder,
  joinSteps,
  privacyPlaceholder,
} from "@/lib/join-steps";
import { cn } from "@/lib/utils";

export function JoinWalkthrough() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = joinSteps[stepIndex];
  const isLast = stepIndex === joinSteps.length - 1;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Join preview steps">
        {joinSteps.map((item, index) => {
          const current = index === stepIndex;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm transition-colors hover:bg-muted active:bg-muted/80",
                  current
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-surface text-muted-foreground",
                )}
                aria-current={current ? "step" : undefined}
                onClick={() => setStepIndex(index)}
              >
                {index + 1}. {item.title}
              </button>
            </li>
          );
        })}
      </ol>

      <section
        aria-labelledby="join-step-title"
        className="rounded-md border border-border bg-surface p-5 sm:p-6"
      >
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Step {stepIndex + 1} of {joinSteps.length}
        </p>
        <h2
          id="join-step-title"
          className="mt-2 font-heading text-2xl text-foreground"
        >
          {step.title}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          {step.summary}
        </p>
        {step.clarifies ? (
          <p className="mt-3 text-sm font-medium text-foreground">
            {step.clarifies}
          </p>
        ) : null}

        {step.id === "conduct" ? (
          <aside className="mt-5 rounded-md border border-dashed border-border bg-surface-muted p-4">
            <p className="text-sm font-medium text-foreground">
              {conductPlaceholder.title}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-wide text-amber-foreground uppercase">
              {conductPlaceholder.status}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {conductPlaceholder.body}
            </p>
          </aside>
        ) : null}

        {step.id === "privacy" ? (
          <aside className="mt-5 rounded-md border border-dashed border-border bg-surface-muted p-4">
            <p className="text-sm font-medium text-foreground">
              {privacyPlaceholder.title}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-wide text-amber-foreground uppercase">
              {privacyPlaceholder.status}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {privacyPlaceholder.body}
            </p>
          </aside>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
          >
            Back
          </Button>
          {!isLast ? (
            <Button
              type="button"
              size="lg"
              onClick={() =>
                setStepIndex((value) =>
                  Math.min(joinSteps.length - 1, value + 1),
                )
              }
            >
              Next step
            </Button>
          ) : (
            <Button type="button" size="lg" disabled>
              Create account (disabled)
            </Button>
          )}
        </div>
      </section>

      <DisclosureNotice title="This prototype does not collect information">
        There is no working form submission for membership, consent, verification,
        or donation. Controls above only move between local preview panels in your
        browser.
      </DisclosureNotice>

      <DisclosureNotice title="Verification concepts are distinct">
        Bot resistance, account continuity, uniqueness, and legal identity are
        different problems. The join preview shows them separately so later design
        does not collapse them into a single “ID required” step.
      </DisclosureNotice>

      <DisclosureNotice title="Viewpoint-neutral participation">
        Enforcement is described as behavior-based, not ideology-based. The
        prototype does not label participants by political identity.
      </DisclosureNotice>
    </div>
  );
}
