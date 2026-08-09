import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type {
  PersistenceAdapter,
  PersistenceHealth,
  TransactionContext,
} from "@/lib/adapters/persistence";
import type { AdapterResult } from "@/lib/adapters/types";
import { schemaMeta } from "@/db/schema";
import type { FoundationDb } from "@/db/types";

/**
 * Gated Drizzle persistence. Repositories must use the TransactionContext.executor
 * (narrowed via asDrizzleTx) — never the outer pool — inside withTransaction.
 */
export class DrizzlePersistenceAdapter implements PersistenceAdapter {
  readonly name = "persistence" as const;

  constructor(private readonly db: FoundationDb) {}

  async healthCheck(): Promise<AdapterResult<PersistenceHealth>> {
    try {
      const rows = await this.db
        .select()
        .from(schemaMeta)
        .where(eq(schemaMeta.key, "migration_label"))
        .limit(1);
      return {
        ok: true,
        value: {
          reachable: true,
          migrationVersion: rows[0]?.value,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "health check failed",
        code: "DB_HEALTH_FAILED",
      };
    }
  }

  async withTransaction<T>(
    fn: (tx: TransactionContext) => Promise<T>,
  ): Promise<AdapterResult<T>> {
    try {
      const value = await this.db.transaction(async (executor) => {
        const tx: TransactionContext = {
          transactionId: randomUUID(),
          executor,
        };
        return fn(tx);
      });
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "transaction failed",
        code: "DB_TRANSACTION_FAILED",
      };
    }
  }
}
