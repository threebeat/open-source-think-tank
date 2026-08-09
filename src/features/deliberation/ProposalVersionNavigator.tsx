"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Proposal } from "@/domain/types";
import { proposalStateLabels } from "@/lib/evidence-labels";

type ProposalVersionNavigatorProps = {
  proposals: Proposal[];
};

export function ProposalVersionNavigator({
  proposals,
}: ProposalVersionNavigatorProps) {
  const ordered = [...proposals].sort((a, b) => a.version - b.version);
  const [selectedId, setSelectedId] = useState(
    ordered[ordered.length - 1]?.id ?? "",
  );
  const selected =
    ordered.find((proposal) => proposal.id === selectedId) ?? ordered[0];

  if (!selected) {
    return null;
  }

  return (
    <section
      className="space-y-4"
      aria-labelledby="proposal-versions-heading"
    >
      <div>
        <h2
          id="proposal-versions-heading"
          className="font-heading text-2xl text-foreground"
        >
          Proposal versions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Navigate draft versions to see how the text changed. Algorithms did not
          write these drafts; the synthetic council record shows human edits over
          time.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Proposal versions"
      >
        {ordered.map((proposal) => {
          const selectedVersion = proposal.id === selected.id;
          return (
            <Button
              key={proposal.id}
              type="button"
              role="tab"
              id={`proposal-tab-${proposal.version}`}
              aria-selected={selectedVersion}
              aria-controls="proposal-version-panel"
              size="lg"
              variant={selectedVersion ? "default" : "outline"}
              onClick={() => setSelectedId(proposal.id)}
            >
              Version {proposal.version}
            </Button>
          );
        })}
      </div>

      <article
        id="proposal-version-panel"
        role="tabpanel"
        aria-labelledby={`proposal-tab-${selected.version}`}
        className="rounded-md border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Version {selected.version}
          </p>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {proposalStateLabels[selected.state]}
          </span>
          <span className="text-xs text-muted-foreground">
            {selected.createdAt}
          </span>
        </div>
        <h3 className="mt-3 font-heading text-xl text-foreground">
          {selected.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {selected.body}
        </p>
      </article>
    </section>
  );
}
