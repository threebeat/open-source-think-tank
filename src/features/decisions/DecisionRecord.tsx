import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import type {
  AgendaItem,
  ConflictDisclosure,
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
  conflicts: ConflictDisclosure[];
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
  conflicts,
}: DecisionRecordProps) {
  const orderedHistory = [...proposalHistory].sort(
    (a, b) => a.version - b.version,
  );
  const conflictsByParticipant = new Map<string, ConflictDisclosure[]>();
  for (const conflict of conflicts) {
    const existing = conflictsByParticipant.get(conflict.participantId) ?? [];
    existing.push(conflict);
    conflictsByParticipant.set(conflict.participantId, existing);
  }

  return (
    <div className="space-y-10">
      <DisclosureNotice title="Recommendation, not settled adoption" tone="caution">
        This synthetic recommendation & council vote is a Policy Council recommendation — not enacted law and not governing-board adoption. Governing-board
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
            People who stepped aside because of a conflict and nonvoting facilitation seats are excluded from the counted
            tally in this synthetic record.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="roll-call-heading">
        <h2 id="roll-call-heading" className="font-heading text-2xl text-foreground">
          Policy Council roll call
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This roster is the Policy Council for the recommendation. It is not the
          Policy Drafting Council roster. Dual-seat members have separately recorded
          Policy Council selection paths. Conflict disclosures below are scoped to
          this recommendation; private financial detail stays unpublished.
        </p>
        <ul className="space-y-3">
          {rollCall.map((entry) => {
            const policyPath = entry.participant?.roleAssignments.find(
              (assignment) => assignment.role === "policy_council",
            )?.selectionPath;
            const entryConflicts =
              conflictsByParticipant.get(entry.participantId) ?? [];
            return (
              <li
                key={entry.participantId}
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {entry.participant?.displayName ?? entry.participantId}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {voteChoiceLabels[entry.vote]}
                  </span>
                </div>
                {policyPath ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Policy Council selection: {policyPath}
                  </p>
                ) : null}
                {entryConflicts.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-medium text-foreground">
                      Conflict disclosure
                      {entryConflicts.length > 1 ? "s" : ""}
                    </p>
                    {entryConflicts.map((conflict) => (
                      <div key={conflict.id}>
                        <p className="text-muted-foreground">{conflict.summary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Disclosed {conflict.disclosedAt}
                          {entry.vote === "recused"
                            ? " · Public reason for stepping aside because of a conflict"
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
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
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Expand each version for its full text, or open the matching selectable
          version in the policy drafting navigator.
        </p>
        <ol className="space-y-3">
          {orderedHistory.map((proposal) => (
            <li
              key={proposal.id}
              className="rounded-md border border-border bg-surface p-4 text-sm"
            >
              <details>
                <summary className="cursor-pointer list-none">
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
                  <p className="mt-2 text-xs font-medium text-primary">
                    Show full proposal text
                  </p>
                </summary>
                <p className="mt-3 leading-6 text-muted-foreground">
                  {proposal.body}
                </p>
                <p className="mt-3">
                  <Link
                    href={`/deliberation/${deliberation.slug}?version=${proposal.version}#proposal-versions`}
                    className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Open version {proposal.version} in policy drafting navigator
                  </Link>
                </p>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={`/topics/${topic.slug}`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Fact-Check & Research
        </Link>
        <Link
          href={`/topics/${topic.slug}/consult`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Public Input
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
          State-Level Policy Drafting
        </Link>
      </section>
    </div>
  );
}
