/**
 * Shared adapter vocabulary for Phase 2 gated environments.
 * Vendor SDKs must not be imported from feature code—only from adapter implementations.
 */

export type AppMode = "public-demo" | "gated";

/** Account lifecycle — see docs/phase-2-plan.md package 2.4 / 2.8. */
export type AccountLifecycleState =
  | "invited"
  | "pending_onboarding"
  | "active"
  | "suspended"
  | "closed"
  | "anonymization-pending";

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: string };
