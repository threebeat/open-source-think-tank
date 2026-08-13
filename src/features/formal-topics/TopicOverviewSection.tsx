import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { QualificationTracePanel } from "@/features/agenda-qualification/QualificationTracePanel";
import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";
import { topicSectionHref } from "@/features/formal-topics/topic-section";
import { FormalTopicGatePanel } from "@/features/journey/FormalTopicGatePanel";
import { PublicInputReportPanel } from "@/features/public-input/PublicInputReportPanel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  model: CanonicalTopicViewModel;
};

export function TopicOverviewSection({ model }: Props) {
  const summary = model.evidenceSummary;

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="overview-answers-heading">
        <h2
          id="overview-answers-heading"
          className="font-heading text-2xl text-foreground"
        >
          Overview
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">What is this topic?</dt>
            <dd className="mt-1 text-muted-foreground">{model.question}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Where is it now?</dt>
            <dd className="mt-1 text-muted-foreground">
              Stage: {model.stageLabel} · {model.advancingState}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">What has happened so far?</dt>
            <dd className="mt-1 text-muted-foreground">
              {model.lastPublicUpdate
                ? `Last public update ${model.lastPublicUpdate}. `
                : ""}
              {model.criteriaMet[0] ??
                "See lineage and qualification details below when available."}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Who can act now?</dt>
            <dd className="mt-1 text-muted-foreground">{model.whoCanActNow}</dd>
          </div>
        </dl>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="independent-metrics-heading"
      >
        <h2
          id="independent-metrics-heading"
          className="font-heading text-xl text-foreground"
        >
          Independent status metrics
        </h2>
        <p className="text-sm text-muted-foreground">
          These cards stay on separate axes. No composite truth, importance, or
          popularity score is computed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Current stage" value={model.stageLabel} axis="workflow" />
          <MetricCard
            label="Public Input"
            value={
              model.publicInputReport
                ? `${model.publicInputReport.participationCount.toLocaleString("en-US")} participants (aggregate)`
                : model.lane === "gated"
                  ? "Provider not live (4.2)"
                  : "No sealed report"
            }
            axis="consultation"
          />
          <MetricCard
            label="Qualification signals"
            value={
              model.qualificationTrace
                ? `${model.qualificationTrace.signals.filter((s) => s.status === "met").length} met · ${model.qualificationTrace.signals.filter((s) => s.status === "attention").length} attention · ${model.qualificationTrace.signals.filter((s) => s.status === "unmet").length} unmet`
                : "Not available on this projection"
            }
            axis="agenda"
          />
          <MetricCard
            label="Evidence readiness"
            value={summary.readinessLabel}
            axis="evidence"
          />
          <MetricCard
            label="Linked discussions / proposals"
            value={
              model.discussionsUnavailableReason
                ? "Not yet operational"
                : `${model.discussions.length} public links`
            }
            axis="lineage"
          />
          <MetricCard
            label="Next transition"
            value={model.nextTransition}
            axis="process"
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="evidence-summary-heading">
        <h2
          id="evidence-summary-heading"
          className="font-heading text-xl text-foreground"
        >
          Evidence summary
        </h2>
        <p className="text-sm text-muted-foreground">
          {summary.totalPublic} public sources · {summary.accepted} accepted ·{" "}
          {summary.limited} limited · {summary.disputed} disputed
          {summary.pending > 0 ? ` · ${summary.pending} pending` : ""}
          {summary.rejected > 0 ? ` · ${summary.rejected} rejected` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Most important gap: </span>
          {summary.importantGap}
        </p>
        <Link
          href={topicSectionHref(model.slug, "evidence")}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Explore evidence
        </Link>
      </section>

      <section
        className="space-y-3 rounded-md border border-border px-4 py-4"
        aria-labelledby="needs-next-heading"
      >
        <h2
          id="needs-next-heading"
          className="font-heading text-xl text-foreground"
        >
          What this topic needs next
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Next transition: </span>
            {model.nextTransition}
          </li>
          <li>
            <span className="font-medium text-foreground">Unmet criteria: </span>
            {model.unmetCriteria.length > 0
              ? model.unmetCriteria.join("; ")
              : "None listed on this projection."}
          </li>
          <li>
            <span className="font-medium text-foreground">Who may act: </span>
            {model.whoCanActNow}
          </li>
          <li>
            <span className="font-medium text-foreground">Status: </span>
            {model.advancingState}
          </li>
        </ul>
        <DisclosureNotice title="Preference is not evidence" tone="caution">
          Preference totals and Public Input aggregates cannot replace evidence
          readiness or published process requirements.
        </DisclosureNotice>
      </section>

      {model.publicInputReport ? (
        <div id="public-input-report">
          <PublicInputReportPanel report={model.publicInputReport} />
        </div>
      ) : null}

      {model.qualificationTrace ? (
        <details className="rounded-md border border-border px-4 py-3">
          <summary className="min-h-11 cursor-pointer font-medium text-foreground">
            Full agenda qualification trace
          </summary>
          <div className="mt-4">
            <QualificationTracePanel trace={model.qualificationTrace} />
          </div>
        </details>
      ) : null}

      {model.gate ? (
        <details className="rounded-md border border-border px-4 py-3">
          <summary className="min-h-11 cursor-pointer font-medium text-foreground">
            Complete gate status and lineage
          </summary>
          <div className="mt-4">
            <FormalTopicGatePanel gate={model.gate} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  axis,
}: {
  label: string;
  value: string;
  axis: string;
}) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">
        {axis}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}
