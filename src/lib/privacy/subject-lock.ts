import { sql } from "drizzle-orm";

import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";

/**
 * Serialize legal-hold placement against closure/purge for a subject.
 * Uses a transaction-scoped advisory lock keyed by subject type+id.
 */
export async function lockPrivacySubject(
  db: FoundationDb | DrizzleTx,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  const key = `${subjectType.trim()}:${subjectId.trim()}`;
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`,
  );
}
