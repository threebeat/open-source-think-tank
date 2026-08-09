import Link from "next/link";
import { Suspense } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import { ProposalVersionNavigatorKeyed } from "@/features/deliberation/ProposalVersionNavigator";
import { SourceLinks } from "@/features/deliberation/SourceLinks";
import type {
  Amendment,
  Claim,
  ConflictDisclosure,
  ConsultationStatement,
  CouncilParticipant,
  Deliberation,
  EvidenceSource,
  Proposal,
  Topic,
} from "@/domain/types";
import { amendmentStatusLabels, councilRoleLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type DeliberationObserverProps = {
  deliberation: Deliberation;
  topic: Topic;
  participants: CouncilParticipant[];
  conflicts: ConflictDisclosure[];
  proposals: Proposal[];
  amendments: Amendment[];
  relatedEvidence: EvidenceSource[];
  claimsById: Map<string, Claim>;
  statementsById: Map<string, ConsultationStatement>;
  evidenceById: Map<string, EvidenceSource>;
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
  claimsById,
  statementsById,
  evidenceById,
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
                <div className="sm:col-span-2">
                  <dt className="font-medium text-foreground">
                    Role seats and selection paths
                  </dt>
                  <dd className="mt-1 space-y-2 text-muted-foreground">
                    {participant.roleAssignments.map((assignment) => (
                      <p key={`${participant.id}-${assignment.role}`}>
                        <span className="font-medium text-foreground">
                          {councilRoleLabels[assignment.role]}:{" "}
                        </span>
                        {assignment.selectionPath}
                      </p>
                    ))}
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

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading proposal versions…</p>
        }
      >
        <ProposalVersionNavigatorKeyed proposals={proposals} />
      </Suspense>

      <section className="space-y-3" aria-labelledby="amendments-heading">
        <h2 id="amendments-heading" className="font-heading text-2xl text-foreground">
          Amendments
        </h2>
        <ul className="space-y-3">
          {amendments.map((amendment) => {
            const amendmentEvidence = amendment.relatedEvidenceIds
              .map((id) => evidenceById.get(id))
              .filter((source): source is EvidenceSource => source != null);
            const amendmentStatements = amendment.relatedStatementIds
              .map((id) => statementsById.get(id))
              .filter(
                (statement): statement is ConsultationStatement =>
                  statement != null,
              );
            const amendmentClaims = amendment.relatedClaimIds
              .map((id) => claimsById.get(id))
              .filter((claim): claim is Claim => claim != null);

            return (
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
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Targeted sources for this amendment
                  </p>
                  <SourceLinks
                    topicSlug={topic.slug}
                    evidence={amendmentEvidence}
                    statements={amendmentStatements}
                    claims={amendmentClaims}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Recorded {amendment.createdAt}
                </p>
              </li>
            );
          })}
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
              Source for the billing-hours claim
            </p>
            <SourceLinks
              topicSlug={topic.slug}
              evidence={relatedEvidence}
              emptyLabel="No billing evidence linked."
            />
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
        <Link
          href={`/decisions/${topic.slug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Open decision record
        </Link>
      </section>
    </div>
  );
}
