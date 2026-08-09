"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import type { Proposal } from "@/domain/types";
import { proposalStateLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type ProposalVersionNavigatorProps = {
  proposals: Proposal[];
};

function resolveInitialId(
  proposals: Proposal[],
  proposalParam: string | null,
  versionParam: string | null,
): string {
  const ordered = [...proposals].sort((a, b) => a.version - b.version);
  return (
    ordered.find((proposal) => proposal.id === proposalParam)?.id ??
    ordered.find((proposal) => String(proposal.version) === versionParam)?.id ??
    ordered[ordered.length - 1]?.id ??
    ""
  );
}

export function ProposalVersionNavigatorKeyed({
  proposals,
}: ProposalVersionNavigatorProps) {
  const searchParams = useSearchParams();
  const key = `${searchParams.get("version") ?? ""}:${searchParams.get("proposal") ?? ""}`;
  return <ProposalVersionNavigator key={key} proposals={proposals} />;
}

export function ProposalVersionNavigator({
  proposals,
}: ProposalVersionNavigatorProps) {
  const baseId = useId();
  const searchParams = useSearchParams();
  const versionParam = searchParams.get("version");
  const proposalParam = searchParams.get("proposal");
  const ordered = [...proposals].sort((a, b) => a.version - b.version);
  const [selectedId, setSelectedId] = useState(() =>
    resolveInitialId(proposals, proposalParam, versionParam),
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    ordered.findIndex((proposal) => proposal.id === selectedId),
  );
  const selected = ordered[selectedIndex] ?? ordered[0];

  if (!selected) {
    return null;
  }

  function focusTab(index: number) {
    const next = ordered[index];
    if (!next) {
      return;
    }
    setSelectedId(next.id);
    tabRefs.current[index]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (ordered.length === 0) {
      return;
    }
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % ordered.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + ordered.length) % ordered.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = ordered.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusTab(nextIndex);
  }

  return (
    <section
      id="proposal-versions"
      className="space-y-4 scroll-mt-28"
      aria-labelledby={`${baseId}-heading`}
    >
      <div>
        <h2
          id={`${baseId}-heading`}
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
        aria-orientation="horizontal"
      >
        {ordered.map((proposal, index) => {
          const selectedVersion = proposal.id === selected.id;
          const tabId = `${baseId}-tab-${proposal.version}`;
          const ref: Ref<HTMLButtonElement> = (node) => {
            tabRefs.current[index] = node;
          };
          return (
            <button
              key={proposal.id}
              ref={ref}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selectedVersion}
              aria-controls={`${baseId}-panel`}
              tabIndex={selectedVersion ? 0 : -1}
              className={cn(
                buttonVariants({
                  size: "lg",
                  variant: selectedVersion ? "default" : "outline",
                }),
              )}
              onClick={() => setSelectedId(proposal.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              Version {proposal.version}
            </button>
          );
        })}
      </div>

      <article
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${selected.version}`}
        className="rounded-md border border-border bg-surface p-5"
        tabIndex={0}
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
