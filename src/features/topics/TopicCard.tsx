import Link from "next/link";

import { StageBadge } from "@/components/StageBadge";
import type { Topic } from "@/domain/types";
import { topicStatusLabels } from "@/lib/evidence-labels";

type TopicCardProps = {
  topic: Topic;
};

export function TopicCard({ topic }: TopicCardProps) {
  return (
    <article className="flex h-full flex-col rounded-md border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={topic.stage} />
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          Status: {topicStatusLabels[topic.status]}
        </span>
        <ul className="flex flex-wrap gap-2" aria-label="Topic subject tags">
          {topic.subjectTags.map((tag) => (
            <li
              key={tag}
              className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
      <h2 className="mt-3 font-heading text-xl text-foreground">
        <Link
          href={`/topics/${topic.slug}`}
          className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {topic.title}
        </Link>
      </h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
        {topic.question}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Synthetic fixture · Next: {topic.nextStep}
      </p>
    </article>
  );
}
