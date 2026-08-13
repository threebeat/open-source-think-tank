import Link from "next/link";

import {
  TOPIC_SECTION_LABELS,
  TOPIC_SECTIONS,
  topicSectionHref,
  type TopicSection,
} from "@/features/formal-topics/topic-section";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  active: TopicSection;
};

export function TopicSectionNav({ slug, active }: Props) {
  return (
    <nav
      className="flex flex-wrap gap-3"
      aria-label="Topic sections"
    >
      {TOPIC_SECTIONS.map((section) => {
        const isCurrent = section === active;
        return (
          <Link
            key={section}
            href={topicSectionHref(slug, section)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isCurrent
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {TOPIC_SECTION_LABELS[section]}
          </Link>
        );
      })}
    </nav>
  );
}
