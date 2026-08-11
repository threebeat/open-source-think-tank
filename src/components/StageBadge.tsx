import type { TopicStage } from "@/domain/status";
import { topicStageLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type StageBadgeProps = {
  stage: TopicStage;
  className?: string;
};

export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium tracking-wide text-foreground uppercase",
        className,
      )}
    >
      {topicStageLabels[stage]}
    </span>
  );
}
