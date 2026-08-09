import type { TransactionContext } from "@/lib/adapters/persistence";
import type { FoundationDb } from "@/db/types";

/** Transaction client bound by DrizzlePersistenceAdapter.withTransaction. */
export type DrizzleTx = Parameters<
  Parameters<FoundationDb["transaction"]>[0]
>[0];

export type DrizzleTransactionContext = TransactionContext & {
  readonly executor: DrizzleTx;
};

export function asDrizzleTx(tx: TransactionContext): DrizzleTx {
  return tx.executor as DrizzleTx;
}
