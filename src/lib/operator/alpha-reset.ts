import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { getTableName, is, Table } from "drizzle-orm";

import * as schema from "@/db/schema";
import { auditLedgerHead, operatorBootstrapState, retentionPolicySettings, schemaMeta } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import {
  ALPHA_RESET_ADVISORY_LOCK_KEY,
  COUNT_FAMILIES,
  DELETE_ORDER,
  hashManifest,
  IMMUTABLE_DELETE_TRIGGERS,
  RESET_MANIFEST_VERSION,
  assertManifestComplete,
  tablesByClass,
} from "@/lib/operator/alpha-reset-manifest";
import { requireOperatorResetEnv } from "@/lib/operator/secrets";

const LEDGER_HEAD_ID = "default";
const BOOTSTRAP_STATE_ID = "default";

export type AlphaResetCounts = Record<string, number>;

export type AlphaResetReceipt = {
  dryRun: boolean;
  databaseFingerprint: string;
  schemaVersion: string;
  sourceCommitSha: string;
  manifestVersion: string;
  manifestHash: string;
  operatorLabel: string;
  counts: { before: AlphaResetCounts; after: AlphaResetCounts };
  deletedTables: string[];
};

export function listSchemaTableNames(): string[] {
  const names = new Set<string>();
  for (const value of Object.values(schema)) {
    if (is(value, Table)) {
      names.add(getTableName(value));
    }
  }
  return [...names].sort();
}

/**
 * Safe identity hash of host+port+dbname only — never includes credentials.
 */
export function computeDatabaseFingerprint(dbUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port || (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:" ? "5432" : "");
  const dbname = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
  if (!host || !dbname) {
    throw new Error("DATABASE_URL must include host and database name");
  }
  const material = `${host}:${port}/${dbname}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export function parseDatabaseName(dbUrl: string): string {
  const parsed = new URL(dbUrl);
  return decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
}

function resolveSourceCommitSha(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.SOURCE_COMMIT_SHA?.trim() ||
    env.GITHUB_SHA?.trim() ||
    env.GIT_COMMIT?.trim() ||
    "unknown"
  );
}

function validateReason(reason: string | undefined): AdapterResult<string> {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 8) {
    return {
      ok: false,
      code: "RESET_REASON_REQUIRED",
      error: "Alpha reset requires a substantive reason (≥8 characters)",
    };
  }
  return { ok: true, value: trimmed };
}

function refuseDevDatabase(
  dbUrl: string,
  env: Record<string, string | undefined>,
): AdapterResult<true> {
  const dbname = parseDatabaseName(dbUrl);
  if (dbname === "ostt_dev" && env.OSTT_ALLOW_DEV_RESET !== "1") {
    return {
      ok: false,
      code: "RESET_DEV_DB_REFUSED",
      error:
        'Refusing alpha reset against database "ostt_dev". Use a disposable DB (e.g. ostt_alpha_reset) or set OSTT_ALLOW_DEV_RESET=1 for a deliberate local drill.',
    };
  }
  return { ok: true, value: true };
}

function extractCount(result: unknown): number {
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    const row = (result as { rows: Record<string, unknown>[] }).rows[0];
    return Number(row?.count ?? 0);
  }
  if (Array.isArray(result) && result[0] && typeof result[0] === "object") {
    const row = result[0] as Record<string, unknown>;
    return Number(row.count ?? 0);
  }
  return 0;
}

async function countFamily(
  db: FoundationDb,
  tables: readonly string[],
): Promise<number> {
  let total = 0;
  for (const table of tables) {
    // Allowlisted identifiers only (manifest / COUNT_FAMILIES).
    const result = await db.execute(
      sql.raw(`SELECT count(*)::int AS count FROM ${quoteIdent(table)}`),
    );
    total += extractCount(result);
  }
  return total;
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(ident)) {
    throw new Error(`ALPHA_RESET_INVALID_IDENT:${ident}`);
  }
  return `"${ident}"`;
}

async function collectCoarseCounts(db: FoundationDb): Promise<AlphaResetCounts> {
  const counts: AlphaResetCounts = {};
  for (const family of COUNT_FAMILIES) {
    counts[family.family] = await countFamily(db, family.tables);
  }
  // Retained / regenerated skeletons for operator visibility
  counts.schema_meta = await countFamily(db, ["schema_meta"]);
  counts.audit_ledger_head = await countFamily(db, ["audit_ledger_head"]);
  return counts;
}

async function readSchemaVersion(db: FoundationDb): Promise<string> {
  const [row] = await db
    .select()
    .from(schemaMeta)
    .where(eq(schemaMeta.key, "migration_label"))
    .limit(1);
  return row?.value ?? "unknown";
}

async function ensureLedgerHead(db: FoundationDb): Promise<void> {
  const [existing] = await db
    .select()
    .from(auditLedgerHead)
    .where(eq(auditLedgerHead.id, LEDGER_HEAD_ID))
    .limit(1);
  if (!existing) {
    await db.insert(auditLedgerHead).values({
      id: LEDGER_HEAD_ID,
      headEventId: null,
      headHash: null,
    });
    return;
  }
  await db
    .update(auditLedgerHead)
    .set({
      headEventId: null,
      headHash: null,
      updatedAt: new Date(),
    })
    .where(eq(auditLedgerHead.id, LEDGER_HEAD_ID));
}

async function reseedRetentionDefaults(db: FoundationDb): Promise<void> {
  await db.execute(sql.raw(`DELETE FROM ${quoteIdent("retention_policy_settings")}`));
  await db.insert(retentionPolicySettings).values([
    {
      key: "verification_artifact_ttl_ms",
      valueJson: 604_800_000,
      provisional: true,
      updatedByLabel: "ostt-alpha-reset",
    },
    {
      key: "pseudonym_expire_job_enabled",
      valueJson: true,
      provisional: true,
      updatedByLabel: "ostt-alpha-reset",
    },
    {
      key: "auth_challenge_ttl_ms",
      valueJson: 3_600_000,
      provisional: true,
      updatedByLabel: "ostt-alpha-reset",
    },
  ]);
}

async function restoreBootstrapSingleton(db: FoundationDb): Promise<void> {
  await db
    .insert(operatorBootstrapState)
    .values({
      id: BOOTSTRAP_STATE_ID,
      status: "not_started",
    })
    .onConflictDoNothing();
}

async function setImmutableTriggers(
  db: FoundationDb,
  enabled: boolean,
): Promise<void> {
  const verb = enabled ? "ENABLE" : "DISABLE";
  for (const entry of IMMUTABLE_DELETE_TRIGGERS) {
    await db.execute(
      sql.raw(
        `ALTER TABLE ${quoteIdent(entry.table)} ${verb} TRIGGER ${quoteIdent(entry.trigger)}`,
      ),
    );
  }
}

async function deleteResetTables(db: FoundationDb): Promise<void> {
  // Break self-FK before deleting conversation_pseudonyms.
  await db.execute(
    sql.raw(
      `UPDATE ${quoteIdent("conversation_pseudonyms")} SET superseded_by_id = NULL`,
    ),
  );

  for (const table of DELETE_ORDER) {
    await db.execute(sql.raw(`DELETE FROM ${quoteIdent(table)}`));
  }
}

type ResetPlanInput = {
  db: FoundationDb;
  reason: string;
  confirmFingerprint?: string;
  dryRun: boolean;
  env?: Record<string, string | undefined>;
};

async function runAlphaReset(
  input: ResetPlanInput,
): Promise<AdapterResult<AlphaResetReceipt>> {
  const env = input.env ?? process.env;
  assertManifestComplete(listSchemaTableNames());

  const creds = requireOperatorResetEnv(env);
  if (!creds.ok) {
    return { ok: false, error: creds.error, code: creds.code };
  }

  const reasonCheck = validateReason(input.reason);
  if (!reasonCheck.ok) {
    return reasonCheck;
  }

  const dbUrl = env.DATABASE_URL?.trim() ?? "";
  if (!dbUrl) {
    return {
      ok: false,
      code: "DATABASE_URL_MISSING",
      error: "DATABASE_URL is required",
    };
  }

  const devCheck = refuseDevDatabase(dbUrl, env);
  if (!devCheck.ok) {
    return devCheck;
  }

  let fingerprint: string;
  try {
    fingerprint = computeDatabaseFingerprint(dbUrl);
  } catch (error) {
    return {
      ok: false,
      code: "FINGERPRINT_INVALID",
      error: error instanceof Error ? error.message : "Invalid DATABASE_URL",
    };
  }

  if (!input.dryRun) {
    const confirmed = input.confirmFingerprint?.trim() ?? "";
    if (!confirmed || confirmed !== fingerprint) {
      return {
        ok: false,
        code: "FINGERPRINT_MISMATCH",
        error:
          "Execute requires --confirm-fingerprint matching the dry-run database fingerprint exactly",
      };
    }
  }

  const schemaVersion = await readSchemaVersion(input.db);
  const sourceCommitSha = resolveSourceCommitSha(env);
  const manifestHash = hashManifest();
  const before = await collectCoarseCounts(input.db);

  if (input.dryRun) {
    return {
      ok: true,
      value: {
        dryRun: true,
        databaseFingerprint: fingerprint,
        schemaVersion,
        sourceCommitSha,
        manifestVersion: RESET_MANIFEST_VERSION,
        manifestHash,
        operatorLabel: creds.label,
        counts: { before, after: before },
        deletedTables: [...DELETE_ORDER],
      },
    };
  }

  let after: AlphaResetCounts = before;
  try {
    await input.db.execute(
      sql`SELECT pg_advisory_lock(${ALPHA_RESET_ADVISORY_LOCK_KEY})`,
    );
    try {
      await input.db.transaction(async (tx) => {
        const txDb = tx as unknown as FoundationDb;
        await setImmutableTriggers(txDb, false);
        try {
          await ensureLedgerHead(txDb);
          await deleteResetTables(txDb);
          await reseedRetentionDefaults(txDb);
          await restoreBootstrapSingleton(txDb);
          await ensureLedgerHead(txDb);
          after = await collectCoarseCounts(txDb);
          // Include the forthcoming reset receipt (+1 audit) in after.audit.
          after = {
            ...after,
            audit: (after.audit ?? 0) + 1,
          };
        } finally {
          await setImmutableTriggers(txDb, true);
        }

        // Success audit only after wipe + regenerated defaults.
        await appendAuthAudit(txDb, {
          actorRole: "operator",
          action: "alpha.reset_executed",
          subjectType: "database",
          subjectId: fingerprint,
          summary: "Operator alpha reset executed (metadata-only receipt).",
          reason: reasonCheck.value,
          privatePayload: {
            operatorLabel: creds.label,
            databaseFingerprint: fingerprint,
            schemaVersion,
            sourceCommitSha,
            manifestVersion: RESET_MANIFEST_VERSION,
            manifestHash,
            counts: { before, after },
          },
          synthetic: true,
        });
      });
    } finally {
      await input.db.execute(
        sql`SELECT pg_advisory_unlock(${ALPHA_RESET_ADVISORY_LOCK_KEY})`,
      );
    }
  } catch (error) {
    return {
      ok: false,
      code: "RESET_FAILED",
      error: error instanceof Error ? error.message : "Alpha reset failed",
    };
  }

  // Re-read after commit so ledger head / audit row are reflected accurately.
  after = await collectCoarseCounts(input.db);

  return {
    ok: true,
    value: {
      dryRun: false,
      databaseFingerprint: fingerprint,
      schemaVersion,
      sourceCommitSha,
      manifestVersion: RESET_MANIFEST_VERSION,
      manifestHash,
      operatorLabel: creds.label,
      counts: { before, after },
      deletedTables: [...DELETE_ORDER],
    },
  };
}

/**
 * Plan-only: identity, coarse counts, delete list. No mutations.
 */
export async function dryRunAlphaReset(
  db: FoundationDb,
  input: { reason: string; env?: Record<string, string | undefined> },
): Promise<AdapterResult<AlphaResetReceipt>> {
  return runAlphaReset({
    db,
    reason: input.reason,
    dryRun: true,
    env: input.env,
  });
}

/**
 * Execute alpha wipe after fingerprint confirmation.
 */
export async function executeAlphaReset(
  db: FoundationDb,
  input: {
    reason: string;
    confirmFingerprint: string;
    env?: Record<string, string | undefined>;
  },
): Promise<AdapterResult<AlphaResetReceipt>> {
  return runAlphaReset({
    db,
    reason: input.reason,
    confirmFingerprint: input.confirmFingerprint,
    dryRun: false,
    env: input.env,
  });
}

export { tablesByClass, RESET_MANIFEST_VERSION, hashManifest };
