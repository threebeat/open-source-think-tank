"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "commons",
    title: "Commons",
    body: "Members discuss in two parts. Formal categories appear first (moderator and Council communications, qualified topics and approaches, community actions). Informal conversations follow an unreviewed-content disclaimer. Signed-in members can create informal posts and submit proposals for formal review. Community enrollment never grants moderator, Chamber, Council, or organization-admin authority.",
  },
  {
    id: "qualification",
    title: "Qualification",
    body: "Safety and qualification are independent records. Moderators check published criteria and conduct — not viewpoint, ideology, popularity, or personal agreement. Formal status means criteria were checked, not that the content is endorsed.",
  },
  {
    id: "consultation",
    title: "Consultation",
    body: "Qualified topics receive structured consultation. This pre-alpha shows a fixture aggregate only. Hosted Pol.is is unavailable and is not loaded. Members of the hall may record in-house agree, disagree, or pass positions on synthetic statements. Evidence quality never changes because of a consultation result.",
  },
  {
    id: "chamber",
    title: "Chamber",
    body: "Community-accepted topics can enter an appointed Chamber. This pre-alpha shows a synthetic Chamber roster, schedule, and roll call so members can observe the path. Every seat records yes, no, abstain, recused, or absent. Chamber seats are explicit, time-bounded appointments — community enrollment never grants one. Live production appointments are not enabled.",
  },
  {
    id: "council",
    title: "Council",
    body: "The organization Council takes Chamber outcomes under published intake reasons. Acceptance, decline, and recommendations are separate from community preference. This pre-alpha shows synthetic Council intake and fixture playback. Live production Council appointments are not enabled. Hosted Pol.is remains unavailable. Community membership is not statutory membership.",
  },
  {
    id: "records",
    title: "Records",
    body: "Public records use allowlisted projections: versions, exact counts, and complementary suppression. Individual votes, XIDs, and provider mappings are never published.",
  },
] as const;

export function ProcessTour() {
  const [index, setIndex] = useState(0);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[index]!;
  const atStart = index === 0;
  const atEnd = index === STEPS.length - 1;
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) {
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  function goTo(next: number) {
    moved.current = true;
    setIndex(next);
  }

  return (
    <div className="space-y-6">
      <DisclosureNotice title="Demonstration, not a live town hall" tone="caution">
        This tour uses synthetic copy. It is not statutory membership, a
        government service, or a live consultation. Hosted Pol.is remains
        unavailable.
      </DisclosureNotice>

      <ol className="flex flex-wrap gap-2" aria-label="Process steps">
        {STEPS.map((item, stepIndex) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                buttonVariants({
                  variant: stepIndex === index ? "default" : "outline",
                  size: "lg",
                }),
                "min-h-11",
              )}
              aria-current={stepIndex === index ? "step" : undefined}
              onClick={() => goTo(stepIndex)}
            >
              {stepIndex + 1}. {item.title}
            </button>
          </li>
        ))}
      </ol>

      <section
        aria-labelledby={headingId}
        className="space-y-3 rounded-lg border border-border bg-surface p-5"
      >
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-2xl text-foreground outline-none"
        >
          {index + 1}. {step.title}
        </h2>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          {step.body}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
          disabled={atStart}
          onClick={() => goTo(Math.max(0, index - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
          disabled={atEnd}
          onClick={() => goTo(Math.min(STEPS.length - 1, index + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
