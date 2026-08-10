import type { AccountLifecycleState } from "@/lib/adapters/types";

/**
 * 2.4 may move invited → pending_onboarding after contact verification.
 * Transition to `active` is owned by 2.8 (`assertActivationTransition` only).
 */
export function assertAllowedLifecycleTransition(
  from: AccountLifecycleState,
  to: AccountLifecycleState,
): void {
  if (to === "active") {
    throw new Error(
      "Refusing lifecycle transition to active outside activateAccount (Work Package 2.8).",
    );
  }
  if (from === "invited" && to === "pending_onboarding") {
    return;
  }
  if (from === to) {
    return;
  }
  throw new Error(`Unsupported lifecycle transition ${from} → ${to}`);
}

/** Sole allowed production path into active (called only from onboarding activate). */
export function assertActivationTransition(
  from: AccountLifecycleState,
  to: AccountLifecycleState,
): void {
  if (to !== "active") {
    throw new Error(`assertActivationTransition only targets active (got ${to})`);
  }
  if (from !== "pending_onboarding") {
    throw new Error(
      `Activation requires pending_onboarding (got ${from})`,
    );
  }
}
