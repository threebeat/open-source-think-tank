/**
 * Migrate + reseed local Postgres for gated auth E2E (synthetic data only).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

process.env.APP_MODE = "gated";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev";
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-e2e-not-production";
process.env.AUTH_E2E_CAPTURE = "1";

const url = process.env.DATABASE_URL;
const client = postgres(url, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: path.join(root, "drizzle") });

await client`
  TRUNCATE TABLE
    auth_challenges,
    auth_sessions,
    audit_events,
    verification_artifact_payloads,
    verification_artifact_holds,
    verification_assertions,
    verification_cases,
    assent_presentations,
    assent_outcomes,
    assent_records,
    document_versions,
    council_appointments,
    role_assignments,
    invitations,
    profiles,
    accounts,
    persons,
    schema_meta
  CASCADE
`;

await client.end({ timeout: 5 });

execSync("npx tsx scripts/seed-synthetic.ts", {
  stdio: "inherit",
  env: process.env,
});

console.log("Gated E2E database prepared with synthetic seed.");
