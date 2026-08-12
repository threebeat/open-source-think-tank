/**
 * Disposable alpha-reset smoke (Phase 3.12).
 *
 * Uses Docker Postgres on port 54329 and database ostt_alpha_reset ONLY.
 * Never touches ostt_dev.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { seedSyntheticFoundation } from "../src/db/seeds/synthetic";
import {
  computeDatabaseFingerprint,
  dryRunAlphaReset,
  executeAlphaReset,
  parseDatabaseName,
} from "../src/lib/operator/alpha-reset";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const ADMIN_URL =
  process.env.OSTT_ADMIN_DATABASE_URL?.trim() ??
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const RESET_DB = "ostt_alpha_reset";
const RESET_URL =
  process.env.OSTT_ALPHA_RESET_DATABASE_URL?.trim() ??
  `postgres://ostt:ostt@127.0.0.1:54329/${RESET_DB}`;
const RESET_SECRET = "ostt-synth-operator-reset-secret-32chars!!!!";
const SENTINEL_ACCOUNT = "account-ostt-synth-alpha-reset-sentinel";

function fail(message: string): never {
  console.error(`alpha:reset:smoke FAILED: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

async function ensureDisposableDatabase(): Promise<void> {
  const admin = postgres(ADMIN_URL, { max: 1 });
  try {
    const rows = await admin`
      SELECT 1 AS ok FROM pg_database WHERE datname = ${RESET_DB}
    `;
    if (rows.length === 0) {
      // Identifier allowlisted constant — not user input.
      await admin.unsafe(`CREATE DATABASE ${RESET_DB}`);
      console.log(`Created disposable database ${RESET_DB}`);
    } else {
      console.log(`Disposable database ${RESET_DB} already exists`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function wipeDisposableForReseed(client: postgres.Sql): Promise<void> {
  // Full truncate for a clean migrate+seed baseline on the disposable DB only.
  await client`
    TRUNCATE TABLE
      auth_challenges,
      auth_sessions,
      conversation_pseudonyms,
      closed_test_conversations,
      dual_control_requests,
      legal_holds,
      account_deletion_requests,
      retention_policy_settings,
      evidence_reviews,
      claim_reviews,
      moderation_actions,
      content_revisions,
      conflict_disclosures,
      claim_evidence_links,
      evidence_submissions,
      claims,
      topics,
      operator_bootstrap_state,
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
  await client`
    UPDATE audit_ledger_head
    SET head_event_id = NULL, head_hash = NULL, updated_at = now()
    WHERE id = 'default'
  `;
}

async function plantSentinels(db: ReturnType<typeof drizzle>): Promise<void> {
  const persons = await db.select().from(schema.persons).limit(1);
  const accounts = await db.select().from(schema.accounts).limit(1);
  assert(persons[0] && accounts[0], "seed must create persons/accounts");

  // Unique markers that must disappear after reset.
  await db.execute(sql`
    UPDATE accounts
    SET contact_channel = ${"sentinel-alpha-reset@ostt.synth.test"}
    WHERE id = ${accounts[0].id}
  `);
  await db.execute(sql`
    UPDATE topics
    SET title = ${"OSTT_ALPHA_RESET_SENTINEL_TOPIC"}
    WHERE id IN (SELECT id FROM topics LIMIT 1)
  `);

  // Ensure named sentinels exist for explicit zero-checks.
  const [existingPerson] = await db
    .select()
    .from(schema.persons)
    .where(eq(schema.persons.id, "person-ostt-synth-alpha-reset-sentinel"))
    .limit(1);
  if (!existingPerson) {
    await db.insert(schema.persons).values({
      id: "person-ostt-synth-alpha-reset-sentinel",
      synthetic: true,
      displayLabel: "ostt-synth alpha-reset sentinel",
      notes: "Disposable smoke sentinel — not a real individual.",
    });
    await db.insert(schema.accounts).values({
      id: SENTINEL_ACCOUNT,
      personId: "person-ostt-synth-alpha-reset-sentinel",
      contactChannel: "alpha-reset-sentinel@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  }
}

async function main() {
  console.log("Alpha reset smoke — disposable DB only (never ostt_dev).");

  execSync("npm run db:up", { stdio: "inherit" });
  await ensureDisposableDatabase();

  assert(
    parseDatabaseName(RESET_URL) === RESET_DB,
    `RESET_URL must target ${RESET_DB}`,
  );
  assert(
    parseDatabaseName(RESET_URL) !== "ostt_dev",
    "Smoke must never target ostt_dev",
  );

  process.env.APP_MODE = "gated";
  process.env.DATABASE_URL = RESET_URL;
  process.env.OPERATOR_RESET_SECRET = RESET_SECRET;
  process.env.OPERATOR_LABEL = "ostt-synth-alpha-reset-smoke";
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-alpha-reset-smoke";
  process.env.SOURCE_COMMIT_SHA = execSync("git rev-parse HEAD", {
    encoding: "utf8",
  }).trim();
  // Explicitly do not allow ostt_dev; smoke uses ostt_alpha_reset.
  delete process.env.OSTT_ALLOW_DEV_RESET;

  const client = postgres(RESET_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await migrate(db, { migrationsFolder: path.join(root, "drizzle") });
    await wipeDisposableForReseed(client);
    await seedSyntheticFoundation(db);
    await plantSentinels(db);

    const accountsBefore = await db.select().from(schema.accounts);
    const topicsBefore = await db.select().from(schema.topics);
    assert(accountsBefore.length > 0, "expected seeded accounts");
    assert(topicsBefore.length > 0, "expected seeded topics");

    const fingerprint = computeDatabaseFingerprint(RESET_URL);

    const dry = await dryRunAlphaReset(db, {
      reason: "Alpha reset smoke dry-run",
    });
    assert(dry.ok, dry.ok ? "" : dry.error);
    assert(dry.value.databaseFingerprint === fingerprint, "fingerprint mismatch");

    const accountsAfterDry = await db.select().from(schema.accounts);
    const topicsAfterDry = await db.select().from(schema.topics);
    assert(
      accountsAfterDry.length === accountsBefore.length,
      "dry-run must not change account rows",
    );
    assert(
      topicsAfterDry.length === topicsBefore.length,
      "dry-run must not change topic rows",
    );
    const sentinelStill =
      accountsAfterDry.some((row) =>
        row.contactChannel.includes("sentinel-alpha-reset"),
      ) ||
      accountsAfterDry.some((row) => row.id === SENTINEL_ACCOUNT);
    assert(sentinelStill, "dry-run must leave sentinels intact");

    const executed = await executeAlphaReset(db, {
      reason: "Alpha reset smoke execute",
      confirmFingerprint: fingerprint,
    });
    assert(executed.ok, executed.ok ? "" : executed.error);

    const accountsAfter = await db.select().from(schema.accounts);
    const topicsAfter = await db.select().from(schema.topics);
    const personsAfter = await db.select().from(schema.persons);
    assert(accountsAfter.length === 0, "accounts must be zero after reset");
    assert(topicsAfter.length === 0, "topics must be zero after reset");
    assert(personsAfter.length === 0, "persons must be zero after reset");

    const auditRows = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "alpha.reset_executed"));
    assert(auditRows.length === 1, "expected exactly one alpha.reset_executed receipt");
    assert(auditRows[0]?.reason?.includes("smoke execute"), "receipt reason missing");

    const [head] = await db
      .select()
      .from(schema.auditLedgerHead)
      .where(eq(schema.auditLedgerHead.id, "default"))
      .limit(1);
    assert(head?.headEventId === auditRows[0]?.id, "ledger head must point at reset receipt");

    const [meta] = await db
      .select()
      .from(schema.schemaMeta)
      .where(eq(schema.schemaMeta.key, "migration_label"))
      .limit(1);
    assert(meta?.value, "schema_meta must be retained");

    const retention = await db.select().from(schema.retentionPolicySettings);
    assert(retention.length >= 1, "retention_policy_settings must be regenerated");

    const second = await executeAlphaReset(db, {
      reason: "Alpha reset smoke second execute",
      confirmFingerprint: fingerprint,
    });
    assert(second.ok, second.ok ? "" : second.error);
    const auditRows2 = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "alpha.reset_executed"));
    assert(auditRows2.length === 1, "second reset wipes prior audit then writes one receipt");

    await seedSyntheticFoundation(db);
    const reseededAccounts = await db.select().from(schema.accounts);
    assert(reseededAccounts.length > 0, "reseed after reset must restore accounts");

    // Prove we never pointed at ostt_dev.
    assert(parseDatabaseName(process.env.DATABASE_URL!) === RESET_DB, "env drifted");
    console.log("alpha:reset:smoke OK");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
