import type { OperatorAction } from "@/lib/authz/types";

/**
 * Typed operator-action contract (Package 3.3).
 * Distinct from account {@link Capability} — never pass these to authorizeCapability.
 */
export type OperatorActionDecision =
  | { ok: true; action: OperatorAction }
  | { ok: false; code: string; error: string };

/** Reserved for documentation/type narrowing; credential checks live in operator bootstrap services. */
export function isOperatorAction(value: string): value is OperatorAction {
  return value === "operator.bootstrap_administrator";
}
