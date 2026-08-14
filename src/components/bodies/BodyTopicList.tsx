import Link from "next/link";

import type { BodyTopicListItemDto } from "@/lib/bodies/types";

type BodyTopicListProps = {
  topics: BodyTopicListItemDto[];
  hrefBase: "/chamber" | "/council" | "/records";
  empty: string;
  onSelectTopic?: (slug: string) => void;
  selectedSlug?: string | null;
};

export function BodyTopicList({
  topics,
  hrefBase,
  empty,
  onSelectTopic,
  selectedSlug,
}: BodyTopicListProps) {
  if (topics.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
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
                href={`${hrefBase}/topics/${topic.slug}`}
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
            {topic.publicAgenda ? " · On Public Agenda" : " · Left Public Agenda"}
            {topic.synthetic ? " · Synthetic seed" : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
