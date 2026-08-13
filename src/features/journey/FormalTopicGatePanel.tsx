import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { FormalTopicGateView } from "@/fixtures/journey-catalog";

type Props = {
  gate: FormalTopicGateView;
};

export function FormalTopicGatePanel({ gate }: Props) {
  return (
    <section className="space-y-6" aria-labelledby="formal-gate-heading">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Formal Topic Pipeline
        </p>
        <h2
          id="formal-gate-heading"
          className="font-heading text-2xl text-foreground"
        >
          Gate status and lineage
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This surface shows only topics that entered through published criteria.
          No moderator, administrator, board member, or individual participant may
          directly promote a pre-deliberation topic based on preference.
        </p>
      </div>

      <DisclosureNotice title="Not Idea Commons" tone="neutral">
        Formal Topic Pipeline content has passed published gates. Informal
        discussion belongs in Idea Commons and must not be mistaken for a formal
        topic.
      </DisclosureNotice>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-foreground">Current stage</dt>
          <dd className="mt-1 text-sm text-muted-foreground">{gate.currentStage}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-foreground">Who can act now</dt>
          <dd className="mt-1 text-sm text-muted-foreground">{gate.whoCanActNow}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-foreground">Origin and lineage</dt>
          <dd className="mt-1 text-sm text-muted-foreground">{gate.originSummary}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-foreground">Next transition</dt>
          <dd className="mt-1 text-sm text-muted-foreground">{gate.nextTransition}</dd>
        </div>
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-heading text-lg text-foreground">Criteria already met</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {gate.criteriaMet.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">Unmet criteria</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {gate.criteriaUnmet.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-heading text-lg text-foreground">Public information</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {gate.publicInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">Protected information</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {gate.protectedInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-lg text-foreground">
          Complete transition history
        </h3>
        <ol className="mt-3 space-y-3">
          {gate.lineage.map((event) => (
            <li
              key={event.id}
              className="border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">
                {event.at} · {event.type}
              </p>
              <p className="mt-1">{event.summary}</p>
              <p className="mt-1 text-xs">Actor role: {event.actorRole}</p>
              {event.publicReason ? (
                <p className="mt-1 text-xs">Public reason: {event.publicReason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
