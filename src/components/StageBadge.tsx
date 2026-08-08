import type { TopicStage } from "@/domain/status";
import { cn } from "@/lib/utils";

const stageLabels: Record<TopicStage, string> = {
  brief: "Brief",
  evidence: "Evidence",
  consultation: "Consultation",
  agenda: "Agenda",
  deliberation: "Deliberation",
  decision: "Decision",
  closed: "Closed",
};

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
      {stageLabels[stage]}
    </span>
  );
}
