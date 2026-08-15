import Link from "next/link";

import type { AgendaTopicListItemDto } from "@/lib/agenda/types";

type AgendaTopicListProps = {
  topics: AgendaTopicListItemDto[];
  onSelectTopic?: (slug: string) => void;
  selectedSlug?: string | null;
};

export function AgendaTopicList({
  topics,
  onSelectTopic,
  selectedSlug,
}: AgendaTopicListProps) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Public Agenda topics are listed for this organization.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {topics.map((topic) => (
        <li
          key={topic.publicId}
          className={
            selectedSlug === topic.slug
              ? "rounded-md border border-primary bg-primary/5 p-4"
              : "rounded-md border border-border p-4"
          }
        >
          <h2 className="font-heading text-lg tracking-tight">
            {onSelectTopic ? (
              <button
                type="button"
                className="text-left underline underline-offset-2"
                aria-pressed={selectedSlug === topic.slug}
                onClick={() => onSelectTopic(topic.slug)}
              >
                {topic.title}
              </button>
            ) : (
              <Link
                className="underline underline-offset-2"
                href={`/agenda/topics/${topic.slug}`}
              >
                {topic.title}
              </Link>
            )}
          </h2>
          {topic.question ? (
            <p className="mt-2 text-sm text-muted-foreground">{topic.question}</p>
          ) : null}
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">State: </span>
            {topic.state}
            {topic.synthetic ? " · Synthetic seed" : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
