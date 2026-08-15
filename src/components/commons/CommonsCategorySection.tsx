import Link from "next/link";

import { formatPublicDateTime } from "@/lib/format/public-datetime";
import type { CommonsCategoryGroupDto } from "@/lib/commons/categories";

type CommonsCategorySectionProps = {
  group: CommonsCategoryGroupDto;
  headingLevel?: "h2" | "h3";
  onSelectDiscussion?: (publicId: string) => void;
  selectedPublicId?: string | null;
  showBody?: boolean;
};

export function CommonsCategorySection({
  group,
  headingLevel = "h3",
  onSelectDiscussion,
  selectedPublicId,
  showBody = false,
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
          {group.discussions.map((discussion) => {
            const selected = selectedPublicId === discussion.publicId;
            return (
              <li key={discussion.publicId}>
                <article
                  className={
                    selected
                      ? "rounded-md border border-primary bg-primary/5 p-4"
                      : "rounded-md border border-border p-4"
                  }
                >
                  <h4 className="font-medium">
                    {onSelectDiscussion ? (
                      <button
                        type="button"
                        className="text-left underline underline-offset-2"
                        aria-pressed={selected}
                        onClick={() => onSelectDiscussion(discussion.publicId)}
                      >
                        {discussion.title}
                      </button>
                    ) : (
                      <Link
                        className="underline underline-offset-2"
                        href={`/commons/discussions/${discussion.publicId}`}
                      >
                        {discussion.title}
                      </Link>
                    )}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {discussion.authorDisplayName}
                    {discussion.synthetic ? " · Synthetic" : ""}
                    {" · "}
                    {formatPublicDateTime(discussion.createdAt)}
                  </p>
                  {showBody && selected ? (
                    <p className="mt-3 text-sm leading-6">{discussion.body}</p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
