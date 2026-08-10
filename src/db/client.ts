import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import * as schema from "@/db/schema";

export type AppDatabase = ReturnType<typeof createPostgresDb>;

/**
 * Construct a postgres.js + Drizzle client. Call only in APP_MODE=gated.
 * Managed hosting vendors are not authorized by this helper (see ADR 0003).
 *
 * Validates the real process environment first (must resolve to gated), then
 * uses DATABASE_URL from that environment or an explicit connection string
 * that matches it. Never overrides APP_MODE to bypass public-demo isolation.
 */
export function createPostgresDb(connectionString?: string) {
  const mode = assertEnvironmentSafe(process.env);
  if (mode !== "gated") {
    throw new Error(
      "createPostgresDb requires APP_MODE=gated; public-demo must not construct a participant database client.",
    );
  }

  const fromEnv = process.env.DATABASE_URL?.trim();
  const resolved = connectionString?.trim() || fromEnv;
  if (!resolved) {
    throw new Error(
      "createPostgresDb requires DATABASE_URL (or an explicit connection string) after gated mode is validated.",
    );
  }

  if (connectionString?.trim() && fromEnv && connectionString.trim() !== fromEnv) {
    throw new Error(
      "createPostgresDb connection string must match DATABASE_URL from the validated gated environment.",
    );
  }

  const client = postgres(resolved, { max: 5 });
  const db = drizzle(client, { schema });
  return { db, client };
}
