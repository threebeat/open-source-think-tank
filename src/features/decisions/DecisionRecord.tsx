import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import type {
  AgendaItem,
  CouncilParticipant,
  Decision,
  Deliberation,
  Proposal,
  Topic,
  VoteChoice,
} from "@/domain/types";
import {
  decisionOutcomeLabels,
  proposalStateLabels,
  voteChoiceLabels,
} from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type RollCallRow = {
  participantId: string;
  vote: VoteChoice;
  participant?: CouncilParticipant;
};

type DecisionRecordProps = {
  decision: Decision;
  topic: Topic;
  deliberation: Deliberation;
  agendaItem?: AgendaItem;
  finalProposal: Proposal;
  proposalHistory: Proposal[];
  rollCall: RollCallRow[];
  minorityAuthors: CouncilParticipant[];
};

export function DecisionRecord({
  decision,
  topic,
  deliberation,
  agendaItem,
  finalProposal,
  proposalHistory,
  rollCall,
  minorityAuthors,
}: DecisionRecordProps) {
  const orderedHistory = [...proposalHistory].sort(
    (a, b) => a.version - b.version,
  );

  return (
    <div className="space-y-10">
      <DisclosureNotice title="Recommendation, not settled adoption" tone="caution">
        This synthetic decision record is a Policy Council recommendation. Governing-board
        adoption authority remains unresolved and is not invented here. No effective
        adoption date is claimed.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="final-proposal-heading">
        <h2
          id="final-proposal-heading"
          className="font-heading text-2xl text-foreground"
        >
          Final proposal
        </h2>
        <div className="rounded-md border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
              {decisionOutcomeLabels[decision.outcome]}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {proposalStateLabels[finalProposal.state]}
            </span>
          </div>
          <h3 className="mt-3 font-heading text-xl text-foreground">
            {finalProposal.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {finalProposal.body}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-5 text-sm">
          <h2 className="font-heading text-xl text-foreground">Institutional details</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="font-medium text-foreground">Recommending body</dt>
              <dd className="mt-1 text-muted-foreground">{decision.adoptingBody}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Published</dt>
              <dd className="mt-1 text-muted-foreground">{decision.publishedOn}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Recommended on</dt>
              <dd className="mt-1 text-muted-foreground">
                {decision.recommendedOn ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Effective adoption date</dt>
              <dd className="mt-1 text-muted-foreground">
                {decision.effectiveOn ??
                  "Not applicable — recommendation only; no adoption date claimed."}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Scheduled review</dt>
              <dd className="mt-1 text-muted-foreground">{decision.reviewOn}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-md border border-border bg-surface p-5 text-sm">
          <h2 className="font-heading text-xl text-foreground">Vote tally</h2>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            <li>For: {decision.voteFor}</li>
            <li>Against: {decision.voteAgainst}</li>
            <li>Abstain: {decision.voteAbstain}</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Recused and nonvoting facilitation seats are excluded from the counted
            tally in this synthetic record.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="roll-call-heading">
        <h2 id="roll-call-heading" className="font-heading text-2xl text-foreground">
          Roll call
        </h2>
        <ul className="space-y-3">
          {rollCall.map((entry) => (
            <li
              key={entry.participantId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm"
            >
              <span className="font-medium text-foreground">
                {entry.participant?.displayName ?? entry.participantId}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {voteChoiceLabels[entry.vote]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="grid gap-4 lg:grid-cols-2"
        aria-labelledby="rationale-heading"
      >
        <div className="rounded-md border border-border bg-surface p-5">
          <h2
            id="rationale-heading"
            className="font-heading text-2xl text-foreground"
          >
            Rationale
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {decision.rationale}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-5">
          <h2 className="font-heading text-2xl text-foreground">
            {decision.minorityReport.title}
          </h2>
          <p className="mt-2 text-xs font-medium text-foreground">
            Authored by{" "}
            {minorityAuthors.map((author) => author.displayName).join(", ")}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {decision.minorityReport.body}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Minority report appears with equal structural prominence to the majority
            rationale.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-heading text-2xl text-foreground">
          Proposal version history
        </h2>
        <ol className="space-y-3">
          {orderedHistory.map((proposal) => (
            <li
              key={proposal.id}
              className="rounded-md border border-border bg-surface p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">
                  Version {proposal.version}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {proposalStateLabels[proposal.state]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {proposal.createdAt}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{proposal.title}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/topics/${topic.slug}`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Topic and evidence
        </Link>
        <Link
          href={`/topics/${topic.slug}/consult`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Consultation
        </Link>
        {agendaItem ? (
          <Link
            href={`/agenda/${agendaItem.slug}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-11 px-4",
            )}
          >
            Agenda review
          </Link>
        ) : null}
        <Link
          href={`/deliberation/${deliberation.slug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Deliberation
        </Link>
      </section>
    </div>
  );
}
