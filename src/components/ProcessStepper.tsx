import { cn } from "@/lib/utils";

export type ProcessStep = {
  id: string;
  label: string;
  description?: string;
};

type ProcessStepperProps = {
  steps: ProcessStep[];
  currentStepId?: string;
  className?: string;
};

export function ProcessStepper({
  steps,
  currentStepId,
  className,
}: ProcessStepperProps) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2",
        className,
      )}
      aria-label="Process stages"
    >
      {steps.map((step, index) => {
        const current = step.id === currentStepId;
        return (
          <li
            key={step.id}
            className={cn(
              "flex min-h-11 flex-1 items-start gap-3 rounded-md border px-3 py-3 sm:min-w-[8.5rem]",
              current
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-surface text-muted-foreground",
            )}
            aria-current={current ? "step" : undefined}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                current
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {step.label}
              </span>
              {step.description ? (
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {step.description}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
