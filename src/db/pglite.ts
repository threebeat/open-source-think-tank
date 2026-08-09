import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";

const root = process.cwd();

async function applyMigrationSql(client: PGlite, relativePath: string) {
  const sql = readFileSync(path.join(root, relativePath), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await client.exec(statement);
  }
}

/** Ephemeral Postgres-compatible DB for tests — not a managed host. */
export async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await applyMigrationSql(client, "drizzle/0000_foundation.sql");
  await client.exec(
    readFileSync(path.join(root, "src/db/immutability.sql"), "utf8"),
  );
  return { client, db };
}
