import type { AccountLifecycleState } from "@/lib/adapters/types";

/**
 * 2.4 may move invited → pending_onboarding after contact verification.
 * Transition to `active` is owned by 2.8 — never performed here.
 */
export function assertAllowedLifecycleTransition(
  from: AccountLifecycleState,
  to: AccountLifecycleState,
): void {
  if (to === "active") {
    throw new Error(
      "Refusing lifecycle transition to active in Work Package 2.4 (owned by 2.8).",
    );
  }
  if (from === "invited" && to === "pending_onboarding") {
    return;
  }
  if (from === to) {
    return;
  }
  throw new Error(`Unsupported lifecycle transition ${from} → ${to} in 2.4`);
}
