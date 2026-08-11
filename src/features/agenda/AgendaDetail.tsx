import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { MetricWithExplanation } from "@/components/MetricWithExplanation";
import { AgendaStateBadge } from "@/features/agenda/AgendaStateBadge";
import type { AgendaItem, Topic } from "@/domain/types";
import { agendaStateLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type AgendaDetailProps = {
  item: AgendaItem;
  topic: Topic;
};

export function AgendaDetail({ item, topic }: AgendaDetailProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <AgendaStateBadge state={item.state} />
        <span className="text-sm text-muted-foreground">
          Method {item.methodVersion}
        </span>
      </div>

      <DisclosureNotice title="No combined truth score" tone="caution">
        Thresholds below stay separate on purpose. Participation, cross-group
        support, disagreement, evidence readiness, and representation warnings are
        not collapsed into a single ranking that could hide a failed gate.
        Popularity alone does not determine the agenda.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="threshold-heading">
        <h2 id="threshold-heading" className="font-heading text-2xl text-foreground">
          Public Criteria
        </h2>
        <ul className="space-y-3">
          {item.thresholds.map((threshold) => (
            <li
              key={threshold.id}
              className="rounded-md border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">{threshold.label}</h3>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    threshold.met
                      ? "bg-primary/15 text-primary"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {threshold.met ? "Met" : "Not met"}
                </span>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-foreground">Required</dt>
                  <dd className="text-muted-foreground">{threshold.required}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Actual (synthetic)</dt>
                  <dd className="text-muted-foreground">{threshold.actual}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="indicators-heading">
        <h2
          id="indicators-heading"
          className="font-heading text-2xl text-foreground"
        >
          Separate indicators
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <MetricWithExplanation
            label="Participation coverage"
            value="Reported separately"
            explanation={item.participationCoverage}
          />
          <MetricWithExplanation
            label="Cross-group support"
            value="Reported separately"
            explanation={item.crossGroupSupport}
          />
          <MetricWithExplanation
            label="Disagreement / salience"
            value="Reported separately"
            explanation={item.disagreementSalience}
          />
          <MetricWithExplanation
            label="Enough Research to Move Forward"
            value="Reported separately"
            explanation={item.evidenceReadiness}
          />
        </div>
        <DisclosureNotice title="Representation warning">
          {item.representationWarning}
        </DisclosureNotice>
      </section>

      <section className="space-y-3" aria-labelledby="trace-heading">
        <h2 id="trace-heading" className="font-heading text-2xl text-foreground">
          How This Result Was Calculated
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Plain-language steps from fixed fixture inputs. This is a mock
          calculation for demonstration, not a live algorithm run.
        </p>
        <ol className="space-y-3">
          {item.calculationTrace.map((step, index) => (
            <li
              key={`${item.id}-trace-${index}`}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted-foreground"
            >
              <span className="font-medium text-foreground">Step {index + 1}. </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">Sensitivity note: </span>
          {item.sensitivityNote}
        </p>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="human-review-heading"
        role="region"
      >
        <h2
          id="human-review-heading"
          className="font-heading text-2xl text-foreground"
        >
          Human review
        </h2>
        <div className="rounded-md border border-border bg-surface p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Reviewer role</dt>
              <dd className="mt-1 text-muted-foreground">
                {item.humanReview.reviewerRole}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Decision</dt>
              <dd className="mt-1 text-muted-foreground">
                {agendaStateLabels[item.humanReview.decision]}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Decided on</dt>
              <dd className="mt-1 text-muted-foreground">
                {item.humanReview.decidedAt}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Conflicts</dt>
              <dd className="mt-1 text-muted-foreground">
                {item.humanReview.conflicts}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Rationale: </span>
            {item.humanReview.rationale}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/topics/${topic.slug}/consult`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Open public input report path
        </Link>
        <Link
          href={`/topics/${topic.slug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Open fact-check & research record
        </Link>
      </section>
    </div>
  );
}
