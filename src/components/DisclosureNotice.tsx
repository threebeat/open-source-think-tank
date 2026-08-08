import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DisclosureNoticeProps = {
  title: string;
  children: ReactNode;
  tone?: "neutral" | "caution";
  className?: string;
};

export function DisclosureNotice({
  title,
  children,
  tone = "neutral",
  className,
}: DisclosureNoticeProps) {
  return (
    <aside
      className={cn(
        "rounded-md border px-4 py-3 text-sm leading-6",
        tone === "caution"
          ? "border-amber-foreground/25 bg-amber/40 text-amber-foreground"
          : "border-border bg-surface-muted text-foreground",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-muted-foreground [&_a]:underline">{children}</div>
    </aside>
  );
}
