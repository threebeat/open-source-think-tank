import type { AgendaState } from "@/domain/types";
import { agendaStateLabels } from "@/lib/evidence-labels";
import { cn } from "@/lib/utils";

type AgendaStateBadgeProps = {
  state: AgendaState;
};

export function AgendaStateBadge({ state }: AgendaStateBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        state === "qualified" && "bg-primary/15 text-primary",
        state === "proposed" && "bg-muted text-foreground",
        state === "deferred" && "bg-amber/50 text-amber-foreground",
        state === "rejected" && "bg-destructive/10 text-destructive",
      )}
    >
      {agendaStateLabels[state]}
    </span>
  );
}
