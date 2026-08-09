"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { demoSteps } from "@/features/demo/demo-steps";
import {
  getDemoClientState,
  getServerDemoClientState,
  resetDemoClientState,
  subscribeDemoState,
  writeDemoStep,
  writePresenterNotesVisible,
} from "@/features/demo/demo-storage";
import { cn } from "@/lib/utils";

const maxIndex = demoSteps.length - 1;

function readStepFromLocation(max: number): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const fromQuery = new URLSearchParams(window.location.search).get("step");
  const queryIndex = demoSteps.findIndex((item) => item.id === fromQuery);
  if (queryIndex >= 0) {
    return queryIndex;
  }
  return getDemoClientState(max).step;
}

function syncStepQuery(stepIndex: number) {
  const url = new URL(window.location.href);
  const id = demoSteps[stepIndex]?.id ?? "welcome";
  if (url.searchParams.get("step") === id) {
    return;
  }
  url.searchParams.set("step", id);
  window.history.replaceState(null, "", url.toString());
}

export function GuidedDemo() {
  const router = useRouter();
  const state = useSyncExternalStore(
    subscribeDemoState,
    () => getDemoClientState(maxIndex),
    getServerDemoClientState,
  );

  const stepIndex = state.step;
  const notesVisible = state.notesVisible;
  const step = demoSteps[stepIndex] ?? demoSteps[0];

  useEffect(() => {
    const fromLocation = readStepFromLocation(maxIndex);
    if (fromLocation !== stepIndex) {
      writeDemoStep(fromLocation);
      return;
    }
    syncStepQuery(stepIndex);
  }, [stepIndex]);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(maxIndex, next));
    writeDemoStep(clamped);
    syncStepQuery(clamped);
  }

  function reset() {
    resetDemoClientState();
    writeDemoStep(0);
    writePresenterNotesVisible(false);
    syncStepQuery(0);
  }

  function exit() {
    router.push("/");
  }

  if (!step) {
    return (
      <p className="text-sm text-muted-foreground">Loading guided demonstration…</p>
    );
  }

  return (
    <div className="space-y-8">
      <DisclosureNotice title="Presentation mode — not an operational system" tone="caution">
        Controls below organize a synthetic walkthrough. They do not enroll members,
        send consultation votes, adopt policy, or complete legal review. Direct
        product URLs continue to work without this mode.
      </DisclosureNotice>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Step {stepIndex + 1} of {demoSteps.length}
        </p>
        <div
          className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={demoSteps.length}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={`Guided demo step ${stepIndex + 1} of ${demoSteps.length}: ${step.title}`}
          aria-label="Guided demonstration progress"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{
              width: `${((stepIndex + 1) / demoSteps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <section
        className="space-y-4 rounded-md border border-border bg-surface p-5 sm:p-6"
        aria-labelledby="demo-step-heading"
      >
        {step.audienceStop ? (
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Audience stop
          </p>
        ) : null}
        <h2
          id="demo-step-heading"
          className="font-heading text-2xl text-foreground"
        >
          {step.title}
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {step.summary}
        </p>
        {step.href && step.linkLabel ? (
          <Link
            href={step.href}
            className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
          >
            {step.linkLabel}
          </Link>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={stepIndex === 0}
          onClick={() => goTo(stepIndex - 1)}
        >
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={stepIndex >= maxIndex}
          onClick={() => goTo(stepIndex + 1)}
        >
          Next
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={reset}>
          Reset
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={exit}>
          Exit
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          aria-pressed={notesVisible}
          onClick={() => writePresenterNotesVisible(!notesVisible)}
        >
          {notesVisible ? "Hide presenter notes" : "Show presenter notes"}
        </Button>
      </div>

      {notesVisible ? (
        <aside
          className="rounded-md border border-amber-foreground/25 bg-amber/40 px-4 py-3 text-sm leading-6 text-amber-foreground"
          aria-label="Presenter notes"
        >
          <p className="font-medium">Presenter notes</p>
          <p className="mt-1 text-muted-foreground">{step.presenterNotes}</p>
        </aside>
      ) : null}

      <section className="space-y-3" aria-labelledby="demo-path-heading">
        <h2
          id="demo-path-heading"
          className="font-heading text-xl text-foreground"
        >
          Full path (direct URLs still work)
        </h2>
        <ol className="space-y-2 text-sm">
          {demoSteps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "text-left underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  index === stepIndex
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => goTo(index)}
              >
                {index + 1}. {item.title}
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
