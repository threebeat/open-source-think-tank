import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";

/** Drizzle executor accepted by gated repositories (root DB or transaction). */
export type GatedDb = FoundationDb | DrizzleTx;

/**
 * Fail closed unless APP_MODE=gated after assertEnvironmentSafe().
 * Repositories must call this before any SQL.
 */
export function requireGatedPersistence(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Gated persistence unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_GATED_DB",
    };
  }
  return null;
}
