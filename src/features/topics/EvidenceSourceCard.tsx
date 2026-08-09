import type { EvidenceSource } from "@/domain/types";
import {
  authorTypeLabels,
  evidenceReviewExplanations,
  evidenceReviewLabels,
  sourceTypeLabels,
} from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type EvidenceSourceCardProps = {
  source: EvidenceSource;
  relationLabel?: "Supporting" | "Counterevidence";
  /** Set false when the same source is also rendered in the topic inventory. */
  anchor?: boolean;
};

export function EvidenceSourceCard({
  source,
  relationLabel,
  anchor = true,
}: EvidenceSourceCardProps) {
  return (
    <article
      id={anchor ? source.id : undefined}
      className={cn(
        "scroll-mt-28 rounded-md border border-border bg-surface-muted p-4",
        source.reviewStatus === "rejected" && "opacity-90",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {relationLabel ? (
          <span className="rounded-md bg-surface px-2 py-1 text-xs font-medium text-foreground">
            {relationLabel}
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium",
            source.reviewStatus === "accepted" && "bg-primary/15 text-primary",
            source.reviewStatus === "pending" && "bg-muted text-foreground",
            source.reviewStatus === "limited" && "bg-amber/50 text-amber-foreground",
            source.reviewStatus === "disputed" && "bg-destructive/10 text-destructive",
            source.reviewStatus === "rejected" && "bg-muted text-muted-foreground",
          )}
        >
          Review: {evidenceReviewLabels[source.reviewStatus]}
        </span>
      </div>
      <h4 className="mt-3 text-sm font-medium text-foreground">{source.title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{source.organization}</p>
      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Published</dt>
          <dd>{source.publishedOn}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Author type</dt>
          <dd>{authorTypeLabels[source.authorType]}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Source type</dt>
          <dd>{sourceTypeLabels[source.sourceType]}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Conflicts</dt>
          <dd>{source.conflicts}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{source.summary}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">Limitations: </span>
        {source.limitations}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {evidenceReviewExplanations[source.reviewStatus]}
      </p>
    </article>
  );
}
