import { demoSteps } from "@/features/demo/demo-steps";

export const DEMO_STEP_QUERY = "demoStep";

export function withDemoStep(href: string, stepId: string): string {
  const url = new URL(href, "https://ostt.local");
  url.searchParams.set(DEMO_STEP_QUERY, stepId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function demoReturnHref(stepId: string): string {
  return `/demo?step=${encodeURIComponent(stepId)}`;
}

export function getDemoStepIndex(stepId: string): number {
  return demoSteps.findIndex((step) => step.id === stepId);
}

export function getNextDemoStepId(stepId: string): string | null {
  const index = getDemoStepIndex(stepId);
  if (index < 0 || index >= demoSteps.length - 1) {
    return null;
  }
  return demoSteps[index + 1]?.id ?? null;
}

export function getDemoContinueHref(stepId: string): string {
  const nextId = getNextDemoStepId(stepId);
  if (!nextId) {
    return demoReturnHref(stepId);
  }
  const next = demoSteps.find((step) => step.id === nextId);
  if (next?.href) {
    return withDemoStep(next.href, next.id);
  }
  return demoReturnHref(nextId);
}
