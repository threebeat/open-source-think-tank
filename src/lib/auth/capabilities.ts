import type { AccountLifecycleState } from "@/lib/adapters/types";

/** Capabilities gated behind institutional `active` (owned by 2.5/2.8 matrix). */
export const ACTIVE_ONLY_CAPABILITIES = [
  "institutional.vote",
  "institutional.council_action",
  "institutional.publish_decision",
] as const;

export type ActiveOnlyCapability = (typeof ACTIVE_ONLY_CAPABILITIES)[number];

export function canExerciseActiveCapability(
  lifecycleState: AccountLifecycleState,
): boolean {
  return lifecycleState === "active";
}

export function isSessionLifecycleAllowed(
  lifecycleState: AccountLifecycleState,
): boolean {
  return (
    lifecycleState === "invited" ||
    lifecycleState === "pending_onboarding" ||
    lifecycleState === "active"
  );
}
