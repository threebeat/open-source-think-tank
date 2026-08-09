import type { AdapterResult } from "@/lib/adapters/types";

/**
 * Persistence boundary for gated PostgreSQL access (ADR 0003).
 * Public-demo mode must not construct an implementation that opens DATABASE_URL.
 */
export type PersistenceHealth = {
  reachable: boolean;
  migrationVersion?: string;
};

export interface PersistenceAdapter {
  readonly name: "persistence";
  healthCheck(): Promise<AdapterResult<PersistenceHealth>>;
  /**
   * Run inside a transaction when the implementation supports it.
   * Domain repositories will sit behind this adapter in 2.3+.
   */
  withTransaction<T>(fn: () => Promise<T>): Promise<AdapterResult<T>>;
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
    _fn: () => Promise<T>,
  ): Promise<AdapterResult<T>> {
    return {
      ok: false,
      error: "Persistence is disabled in public-demo mode",
      code: "PUBLIC_DEMO_NO_DB",
    };
  }
}
