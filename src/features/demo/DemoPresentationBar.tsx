"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { demoSteps } from "@/features/demo/demo-steps";
import {
  DEMO_STEP_QUERY,
  demoReturnHref,
  getDemoContinueHref,
  getNextDemoStepId,
} from "@/features/demo/demo-query";
import { cn } from "@/lib/utils";

function DemoPresentationBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stepId = searchParams.get(DEMO_STEP_QUERY);

  if (!stepId || pathname === "/demo") {
    return null;
  }

  const step = demoSteps.find((item) => item.id === stepId);
  if (!step) {
    return null;
  }

  const nextId = getNextDemoStepId(stepId);
  const next = nextId ? demoSteps.find((item) => item.id === nextId) : undefined;
  const continueHref = getDemoContinueHref(stepId);
  const continueLabel = next
    ? `Continue to ${next.title}`
    : "Return to guided demo";

  return (
    <div
      className="border-b border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground"
      role="region"
      aria-label="Guided demonstration controls"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 leading-5">
          <span className="font-medium">Presentation mode</span>
          <span className="text-muted-foreground">
            {" "}
            — viewing “{step.title}”. Controls stay available so you do not need
            the browser Back button.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={demoReturnHref(stepId)}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-11")}
          >
            Return to guided demo
          </Link>
          {nextId ? (
            <Link
              href={continueHref}
              className={cn(buttonVariants({ size: "sm" }), "min-h-11")}
            >
              {continueLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DemoPresentationBar() {
  return (
    <Suspense fallback={null}>
      <DemoPresentationBarInner />
    </Suspense>
  );
}
