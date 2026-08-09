import type { AdapterResult } from "@/lib/adapters/types";

/**
 * Persistence boundary for gated PostgreSQL access (ADR 0003).
 * Public-demo mode must not construct an implementation that opens DATABASE_URL.
 */

export type PersistenceHealth = {
  reachable: boolean;
  migrationVersion?: string;
};

/**
 * Transaction-scoped context passed into `withTransaction`.
 * Repositories must use `executor` (narrowed in `src/db`) — never the pool.
 */
export type TransactionContext = {
  readonly transactionId: string;
  /**
   * Bound executor for this transaction only.
   * Typed unknown at the adapter boundary; Drizzle repositories narrow it.
   */
  readonly executor: unknown;
};

export interface PersistenceAdapter {
  readonly name: "persistence";
  healthCheck(): Promise<AdapterResult<PersistenceHealth>>;
  withTransaction<T>(
    fn: (tx: TransactionContext) => Promise<T>,
  ): Promise<AdapterResult<T>>;
}

export class PublicDemoPersistenceAdapter implements PersistenceAdapter {
  readonly name = "persistence" as const;

  async healthCheck(): Promise<AdapterResult<PersistenceHealth>> {
    return {
      ok: false,
      error: "Persistence is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_DB",
    };
  }

  async withTransaction<T>(
    _fn: (tx: TransactionContext) => Promise<T>,
  ): Promise<AdapterResult<T>> {
    return {
      ok: false,
      error: "Persistence is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_DB",
    };
  }
}
