import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import { ProposalVersionNavigator } from "@/features/deliberation/ProposalVersionNavigator";
import type {
  Amendment,
  ConflictDisclosure,
  CouncilParticipant,
  Deliberation,
  EvidenceSource,
  Proposal,
  Topic,
} from "@/domain/types";
import { amendmentStatusLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type DeliberationObserverProps = {
  deliberation: Deliberation;
  topic: Topic;
  participants: CouncilParticipant[];
  conflicts: ConflictDisclosure[];
  proposals: Proposal[];
  amendments: Amendment[];
  relatedEvidence: EvidenceSource[];
  agendaSlug: string;
};

export function DeliberationObserver({
  deliberation,
  topic,
  participants,
  conflicts,
  proposals,
  amendments,
  relatedEvidence,
  agendaSlug,
}: DeliberationObserverProps) {
  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const recused = participantsById.get(deliberation.recusal.participantId);

  return (
    <div className="space-y-10">
      <DisclosureNotice title="Public observation only" tone="caution">
        {deliberation.observerNotice}
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="selection-heading">
        <h2 id="selection-heading" className="font-heading text-2xl text-foreground">
          How this synthetic council was selected
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {deliberation.selectionExplanation}
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="participants-heading">
        <h2
          id="participants-heading"
          className="font-heading text-2xl text-foreground"
        >
          Council participants
        </h2>
        <ul className="space-y-3">
          {participants.map((participant) => (
            <li
              key={participant.id}
              className="rounded-md border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">
                  {participant.displayName}
                </h3>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {participant.voting ? "Voting seat" : "Nonvoting facilitation"}
                </span>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-foreground">Term</dt>
                  <dd className="text-muted-foreground">
                    {participant.termStart} – {participant.termEnd}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Selection path</dt>
                  <dd className="text-muted-foreground">
                    {participant.selectionPath}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="conflicts-heading">
        <h2 id="conflicts-heading" className="font-heading text-2xl text-foreground">
          Conflict disclosures
        </h2>
        <ul className="space-y-3">
          {conflicts.map((conflict) => {
            const person = participantsById.get(conflict.participantId);
            return (
              <li
                key={conflict.id}
                className="rounded-md border border-border bg-surface p-4 text-sm leading-6"
              >
                <p className="font-medium text-foreground">
                  {person?.displayName ?? conflict.participantId}
                </p>
                <p className="mt-1 text-muted-foreground">{conflict.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Disclosed {conflict.disclosedAt}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <ProposalVersionNavigator proposals={proposals} />

      <section className="space-y-3" aria-labelledby="amendments-heading">
        <h2 id="amendments-heading" className="font-heading text-2xl text-foreground">
          Amendments
        </h2>
        <ul className="space-y-3">
          {amendments.map((amendment) => (
            <li
              key={amendment.id}
              className="rounded-md border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">{amendment.title}</h3>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {amendmentStatusLabels[amendment.status]}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {amendment.body}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Rationale: </span>
                {amendment.rationale}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Recorded {amendment.createdAt}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="evidence-request-heading">
        <h2
          id="evidence-request-heading"
          className="font-heading text-2xl text-foreground"
        >
          Evidence request
        </h2>
        <div className="rounded-md border border-border bg-surface p-5 text-sm leading-6">
          <p className="font-medium text-foreground">Request</p>
          <p className="mt-1 text-muted-foreground">
            {deliberation.evidenceRequest.request}
          </p>
          <p className="mt-4 font-medium text-foreground">Response to council</p>
          <p className="mt-1 text-muted-foreground">
            {deliberation.evidenceRequest.response}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Requested {deliberation.evidenceRequest.requestedAt} · Responded{" "}
            {deliberation.evidenceRequest.respondedAt}
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-foreground">
              Material claims linked to the evidence record
            </p>
            <ul className="flex flex-wrap gap-2 text-xs">
              {relatedEvidence.map((source) => (
                <li key={source.id}>
                  <Link
                    href={`/topics/${topic.slug}#${source.id}`}
                    className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Evidence ({source.reviewStatus}): {source.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/topics/${topic.slug}`}
                  className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Full topic evidence inventory
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="recusal-heading">
        <h2 id="recusal-heading" className="font-heading text-2xl text-foreground">
          Recusal
        </h2>
        <div className="rounded-md border border-border bg-surface p-5 text-sm leading-6">
          <p className="font-medium text-foreground">
            {recused?.displayName ?? deliberation.recusal.participantId}
          </p>
          <p className="mt-2 text-muted-foreground">
            {deliberation.recusal.publicReason}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Recorded {deliberation.recusal.recordedAt}. Unnecessary private
            financial details are not published.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="font-heading text-2xl text-foreground">
          Meeting and action timeline
        </h2>
        <ol className="space-y-3">
          {deliberation.timeline.map((entry) => (
            <li
              key={`${entry.at}-${entry.summary}`}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
            >
              <p className="font-medium text-foreground">{entry.at}</p>
              <p className="mt-1 text-muted-foreground">{entry.summary}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3" aria-labelledby="redaction-heading">
        <h2 id="redaction-heading" className="font-heading text-2xl text-foreground">
          Permitted narrow redaction placeholder
        </h2>
        <DisclosureNotice title="Public redaction reason">
          <span className="font-medium text-foreground">Scope: </span>
          {deliberation.publicRedaction.scope}
          <br />
          <span className="font-medium text-foreground">Reason: </span>
          {deliberation.publicRedaction.publicReason}
        </DisclosureNotice>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/topics/${topic.slug}`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Open evidence record
        </Link>
        <Link
          href={`/agenda/${agendaSlug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Open agenda review
        </Link>
        <Link
          href={`/topics/${topic.slug}/consult`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Open consultation path
        </Link>
      </section>
    </div>
  );
}
