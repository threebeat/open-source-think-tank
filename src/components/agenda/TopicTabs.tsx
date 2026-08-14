import Link from "next/link";

import { AGENDA_TABS, type AgendaTab } from "@/lib/agenda/types";

const TAB_LABELS: Record<AgendaTab, string> = {
  overview: "Overview",
  evidence: "Evidence",
  discussion: "Discussion",
  history: "History",
};

type TopicTabsProps = {
  slug: string;
  active: AgendaTab;
};

export function TopicTabs({ slug, active }: TopicTabsProps) {
  return (
    <nav aria-label="Topic sections">
      <ul className="flex flex-wrap gap-2">
        {AGENDA_TABS.map((tab) => {
          const href =
            tab === "overview"
              ? `/agenda/topics/${slug}`
              : `/agenda/topics/${slug}?tab=${tab}`;
          const isActive = tab === active;
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex min-h-11 items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                    : "inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-sm font-medium"
                }
              >
                {TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
