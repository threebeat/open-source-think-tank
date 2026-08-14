import Link from "next/link";

import { formatPublicDateTime } from "@/lib/format/public-datetime";
import type { CommonsCategoryGroupDto } from "@/lib/commons/categories";

type CommonsCategorySectionProps = {
  group: CommonsCategoryGroupDto;
  headingLevel?: "h2" | "h3";
};

export function CommonsCategorySection({
  group,
  headingLevel = "h3",
}: CommonsCategorySectionProps) {
  const Heading = headingLevel;
  return (
    <section aria-labelledby={`commons-${group.category}`} className="space-y-3">
      <Heading
        id={`commons-${group.category}`}
        className="font-heading text-lg tracking-tight"
      >
        {group.label}
      </Heading>
      {group.discussions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts in this category yet.</p>
      ) : (
        <ul className="space-y-3">
          {group.discussions.map((discussion) => (
            <li key={discussion.publicId}>
              <article className="rounded-md border border-border p-4">
                <h4 className="font-medium">
                  <Link
                    className="underline underline-offset-2"
                    href={`/commons/discussions/${discussion.publicId}`}
                  >
                    {discussion.title}
                  </Link>
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {discussion.authorDisplayName}
                  {discussion.synthetic ? " · Synthetic" : ""}
                  {" · "}
                  {formatPublicDateTime(discussion.createdAt)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
