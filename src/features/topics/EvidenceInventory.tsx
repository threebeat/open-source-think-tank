"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { EvidenceSourceCard } from "@/features/topics/EvidenceSourceCard";
import type { Claim, EvidenceSource } from "@/domain/types";
import {
  AUTHOR_TYPES,
  EVIDENCE_REVIEW_STATUSES,
  SOURCE_TYPES,
} from "@/domain/status";
import {
  authorTypeLabels,
  evidenceReviewLabels,
  sourceTypeLabels,
} from "@/lib/evidence-labels";
import {
  applyEvidenceInventory,
  DEFAULT_EVIDENCE_INVENTORY,
  EVIDENCE_REVIEW_SORT_ORDER,
  hasActiveEvidenceFilters,
  type EvidenceInventoryState,
  type EvidenceRelationshipFilter,
  type EvidenceSort,
} from "@/features/topics/evidence-inventory";

type EvidenceInventoryProps = {
  sources: EvidenceSource[];
  claims: Claim[];
};

export function EvidenceInventory({ sources, claims }: EvidenceInventoryProps) {
  const [state, setState] = useState<EvidenceInventoryState>(
    DEFAULT_EVIDENCE_INVENTORY,
  );

  const results = useMemo(
    () => applyEvidenceInventory(sources, state, claims),
    [sources, state, claims],
  );

  const hasRelationships = claims.some(
    (claim) =>
      claim.supportingEvidenceIds.length > 0 ||
      claim.counterEvidenceIds.length > 0,
  );

  function update(partial: Partial<EvidenceInventoryState>) {
    setState((current) => ({ ...current, ...partial }));
  }

  function reset() {
    setState(DEFAULT_EVIDENCE_INVENTORY);
  }

  const fieldClass =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  if (sources.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">
        No evidence sources are attached yet for this synthetic topic. Missing
        evidence is an intentional brief-stage state, not a hidden section.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        All sources attached to this topic, including pending, limited, disputed,
        and rejected states. Source quality is shown independently from any
        public-input popularity. Sorting by research review status uses a fixed
        category order ({EVIDENCE_REVIEW_SORT_ORDER.map((status) => evidenceReviewLabels[status]).join(" → ")})
        for organization only — it is not a truth score and does not make accepted
        evidence automatically dispositive.
      </p>

      <form
        className="grid gap-4 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block space-y-2 text-sm" htmlFor="evidence-sort">
          <span className="font-medium text-foreground">Sort inventory</span>
          <select
            id="evidence-sort"
            value={state.sort}
            onChange={(event) =>
              update({ sort: event.target.value as EvidenceSort })
            }
            className={fieldClass}
          >
            <option value="original">Original order</option>
            <option value="review">Research review status</option>
            <option value="published_newest">Newest publication date</option>
            <option value="published_oldest">Oldest publication date</option>
            <option value="source_type">Source type</option>
            <option value="author_type">Author type</option>
            <option value="organization">Organization A–Z</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>

        <label className="block space-y-2 text-sm" htmlFor="evidence-review-filter">
          <span className="font-medium text-foreground">Research review status</span>
          <select
            id="evidence-review-filter"
            value={state.reviewStatus}
            onChange={(event) =>
              update({
                reviewStatus: event.target
                  .value as EvidenceInventoryState["reviewStatus"],
              })
            }
            className={fieldClass}
          >
            <option value="all">All review statuses</option>
            {EVIDENCE_REVIEW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {evidenceReviewLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2 text-sm" htmlFor="evidence-source-filter">
          <span className="font-medium text-foreground">Source type</span>
          <select
            id="evidence-source-filter"
            value={state.sourceType}
            onChange={(event) =>
              update({
                sourceType: event.target
                  .value as EvidenceInventoryState["sourceType"],
              })
            }
            className={fieldClass}
          >
            <option value="all">All source types</option>
            {SOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {sourceTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2 text-sm" htmlFor="evidence-author-filter">
          <span className="font-medium text-foreground">Author type</span>
          <select
            id="evidence-author-filter"
            value={state.authorType}
            onChange={(event) =>
              update({
                authorType: event.target
                  .value as EvidenceInventoryState["authorType"],
              })
            }
            className={fieldClass}
          >
            <option value="all">All author types</option>
            {AUTHOR_TYPES.map((value) => (
              <option key={value} value={value}>
                {authorTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>

        {hasRelationships ? (
          <label
            className="block space-y-2 text-sm"
            htmlFor="evidence-relationship-filter"
          >
            <span className="font-medium text-foreground">Relationship</span>
            <select
              id="evidence-relationship-filter"
              value={state.relationship}
              onChange={(event) =>
                update({
                  relationship: event.target
                    .value as EvidenceRelationshipFilter,
                })
              }
              className={fieldClass}
            >
              <option value="all">All relationships</option>
              <option value="supporting">Supporting a claim</option>
              <option value="counterevidence">Counterevidence</option>
            </select>
          </label>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {results.length} source{results.length === 1 ? "" : "s"}
        </p>
        {hasActiveEvidenceFilters(state) ? (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="Active evidence filters">
              {state.sort !== "original" ? (
                <li>
                  <button
                    type="button"
                    onClick={() => update({ sort: "original" })}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Sort: {state.sort.replaceAll("_", " ")} ×
                  </button>
                </li>
              ) : null}
              {state.reviewStatus !== "all" ? (
                <li>
                  <button
                    type="button"
                    onClick={() => update({ reviewStatus: "all" })}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Review: {evidenceReviewLabels[state.reviewStatus]} ×
                  </button>
                </li>
              ) : null}
              {state.sourceType !== "all" ? (
                <li>
                  <button
                    type="button"
                    onClick={() => update({ sourceType: "all" })}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Source: {sourceTypeLabels[state.sourceType]} ×
                  </button>
                </li>
              ) : null}
              {state.authorType !== "all" ? (
                <li>
                  <button
                    type="button"
                    onClick={() => update({ authorType: "all" })}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Author: {authorTypeLabels[state.authorType]} ×
                  </button>
                </li>
              ) : null}
              {state.relationship !== "all" ? (
                <li>
                  <button
                    type="button"
                    onClick={() => update({ relationship: "all" })}
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Relationship: {state.relationship} ×
                  </button>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={reset}
              className="min-h-9 rounded-md px-3 text-xs font-medium text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Reset to original order
            </button>
          </>
        ) : null}
      </div>

      {results.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {results.map((source) => (
            <EvidenceSourceCard
              key={source.id}
              source={source}
              claims={claims}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No evidence sources match these filters"
          description="Reset to original order to restore the synthetic inventory narrative, or clear individual filters."
        />
      )}
    </div>
  );
}
