import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import * as schema from "@/db/schema";

export type AppDatabase = ReturnType<typeof createPostgresDb>;

/**
 * Construct a postgres.js + Drizzle client. Call only in APP_MODE=gated.
 * Managed hosting vendors are not authorized by this helper (see ADR 0003).
 */
export function createPostgresDb(connectionString: string) {
  assertEnvironmentSafe({
    ...process.env,
    APP_MODE: "gated",
    DATABASE_URL: connectionString,
  });
  const client = postgres(connectionString, { max: 5 });
  const db = drizzle(client, { schema });
  return { db, client };
}
