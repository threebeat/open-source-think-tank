import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { QualificationTrace } from "@/fixtures/journey-catalog";

type Props = {
  trace: QualificationTrace;
};

export function QualificationTracePanel({ trace }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="qualification-trace-heading">
      <h2
        id="qualification-trace-heading"
        className="font-heading text-2xl text-foreground"
      >
        Agenda qualification trace
      </h2>
      <DisclosureNotice title="Independent signals — no composite score" tone="neutral">
        Consultation, evidence, and human review stay independent. Pol.is / Public
        Input results never determine evidence quality. Moderators cannot alter
        consultation metrics.
      </DisclosureNotice>
      <p className="text-sm text-muted-foreground">
        Method {trace.methodVersion} · imported {trace.importedAt}
      </p>
      <ul className="space-y-3">
        {trace.signals.map((signal) => (
          <li
            key={signal.id}
            className="rounded-md border border-border px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-foreground">{signal.label}</p>
              <p className="text-xs uppercase tracking-wide text-primary">
                {signal.status} · {signal.axis}
              </p>
            </div>
            <p className="mt-1 text-muted-foreground">{signal.summary}</p>
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-border px-4 py-3 text-sm">
        <h3 className="font-heading text-lg text-foreground">
          Human review provenance
        </h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Actor role</dt>
            <dd className="text-muted-foreground">{trace.humanReview.actorRole}</dd>
          </div>
          <div>
            <dt className="font-medium">Decision</dt>
            <dd className="text-muted-foreground">{trace.humanReview.decision}</dd>
          </div>
          <div>
            <dt className="font-medium">Timestamp</dt>
            <dd className="text-muted-foreground">{trace.humanReview.decidedAt}</dd>
          </div>
          <div>
            <dt className="font-medium">Conflicts</dt>
            <dd className="text-muted-foreground">{trace.humanReview.conflicts}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Public reason</dt>
            <dd className="text-muted-foreground">{trace.humanReview.publicReason}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Method version</dt>
            <dd className="text-muted-foreground">
              {trace.humanReview.methodVersion}
            </dd>
          </div>
        </dl>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {trace.notices.map((notice) => (
          <li key={notice}>{notice}</li>
        ))}
      </ul>
    </section>
  );
}
