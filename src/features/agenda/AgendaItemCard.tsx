import Link from "next/link";

import { AgendaStateBadge } from "@/features/agenda/AgendaStateBadge";
import type { AgendaItem } from "@/domain/types";

type AgendaItemCardProps = {
  item: AgendaItem;
};

export function AgendaItemCard({ item }: AgendaItemCardProps) {
  return (
    <article className="flex h-full flex-col rounded-md border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <AgendaStateBadge state={item.state} />
        <span className="text-xs text-muted-foreground">{item.methodVersion}</span>
      </div>
      <h2 className="mt-3 font-heading text-xl text-foreground">
        <Link
          href={`/agenda/${item.slug}`}
          className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {item.title}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Human review: {item.humanReview.decision} on {item.humanReview.decidedAt}
      </p>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
        {item.evidenceReadiness}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Popularity is not shown as a single score. Open the item for separate
        thresholds and the calculation trace.
      </p>
    </article>
  );
}
