import Link from "next/link";

import type { BodyTopicListItemDto } from "@/lib/bodies/types";

type BodyTopicListProps = {
  topics: BodyTopicListItemDto[];
  hrefBase: "/chamber" | "/council" | "/records";
  empty: string;
};

export function BodyTopicList({ topics, hrefBase, empty }: BodyTopicListProps) {
  if (topics.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-4">
      {topics.map((topic) => (
        <li key={topic.publicId} className="rounded-md border border-border p-4">
          <h2 className="font-heading text-lg tracking-tight">
            <Link
              className="underline underline-offset-2"
              href={`${hrefBase}/topics/${topic.slug}`}
            >
              {topic.title}
            </Link>
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
