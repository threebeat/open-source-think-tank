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
  ALPHA_RESET_LOCK_TIMEOUT,
  ALPHA_RESET_STATEMENT_TIMEOUT,
  COUNT_FAMILIES,
  DELETE_ORDER,
  hashManifest,
  IMMUTABLE_DELETE_TRIGGERS,
  RESET_LOCK_TABLES,
  RESET_MANIFEST_VERSION,
  assertManifestComplete,
  tablesByClass,
} from "@/lib/operator/alpha-reset-manifest";
import { regenerateOperationalAssentDocuments } from "@/lib/operator/operational-assent-documents";
import { requireOperatorResetEnv } from "@/lib/operator/secrets";

const LEDGER_HEAD_ID = "default";
const BOOTSTRAP_STATE_ID = "default";

export type AlphaResetCounts = Record<string, number>;

export type AlphaResetReceiptProvenance = "operational" | "synthetic_smoke";

export type AlphaResetReceipt = {
  dryRun: boolean;
  databaseFingerprint: string;
  schemaVersion: string;
  sourceCommitSha: string;
  manifestVersion: string;
  manifestHash: string;
  operatorLabel: string;
  receiptProvenance: AlphaResetReceiptProvenance;
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
  // Break self-FK before deleting public_input_reports (Phase 4.4 supersession chain).
  await db.execute(
    sql.raw(
      `UPDATE ${quoteIdent("public_input_reports")} SET superseded_by_report_id = NULL`,
    ),
  );
  // Break self-FK before deleting topic_governance_records (v2 predecessor chain).
  await db.execute(
    sql.raw(
      `UPDATE ${quoteIdent("topic_governance_records")} SET predecessor_record_id = NULL`,
    ),
  );

  for (const table of DELETE_ORDER) {
    await db.execute(sql.raw(`DELETE FROM ${quoteIdent(table)}`));
  }
}

/**
 * Establish the protected reset window inside an open transaction:
 * bounded timeouts, transaction-scoped advisory lock, allowlisted table locks.
 */
export async function acquireAlphaResetProtection(
  db: FoundationDb,
): Promise<void> {
  await db.execute(
    sql.raw(`SET LOCAL lock_timeout = '${ALPHA_RESET_LOCK_TIMEOUT}'`),
  );
  await db.execute(
    sql.raw(
      `SET LOCAL statement_timeout = '${ALPHA_RESET_STATEMENT_TIMEOUT}'`,
    ),
  );
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(${ALPHA_RESET_ADVISORY_LOCK_KEY})`,
  );
  for (const table of RESET_LOCK_TABLES) {
    await db.execute(
      sql.raw(
        `LOCK TABLE ${quoteIdent(table)} IN SHARE ROW EXCLUSIVE MODE`,
      ),
    );
  }
}

function isLockContentionError(error: unknown): boolean {
  const chain: unknown[] = [error];
  if (error instanceof Error && "cause" in error && error.cause) {
    chain.push(error.cause);
  }
  for (const entry of chain) {
    const message = entry instanceof Error ? entry.message : String(entry);
    const code =
      entry && typeof entry === "object" && "code" in entry
        ? String((entry as { code?: unknown }).code ?? "")
        : "";
    if (
      code === "55P03" ||
      /lock timeout|canceling statement due to lock timeout|could not obtain lock|deadlock detected/i.test(
        message,
      )
    ) {
      return true;
    }
  }
  return false;
}

function sanitizeResetFailure(error: unknown): AdapterResult<never> {
  if (isLockContentionError(error)) {
    return {
      ok: false,
      code: "RESET_LOCK_UNAVAILABLE",
      error:
        "Alpha reset could not establish a protected quiesced window (lock contention or timeout). No destructive changes were committed.",
    };
  }
  const message = error instanceof Error ? error.message : "Alpha reset failed";
  // Keep operator-facing failures free of contact channels / tokens.
  const sanitized = message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/postgres:\/\/[^\s]+/gi, "[redacted-db-url]");
  return {
    ok: false,
    code: "RESET_FAILED",
    error: sanitized,
  };
}

type ResetPlanInput = {
  db: FoundationDb;
  reason: string;
  confirmFingerprint?: string;
  dryRun: boolean;
  /**
   * Explicit ceremony provenance. Operational CLI must pass false;
   * disposable smoke must pass true. Never inferred from DATABASE_URL.
   */
  syntheticReceipt: boolean;
  env?: Record<string, string | undefined>;
  /** Test-only: throw after deletes to prove rollback restores data/triggers. */
  __testInjectFailure?: "after_deletes";
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
  const receiptProvenance: AlphaResetReceiptProvenance = input.syntheticReceipt
    ? "synthetic_smoke"
    : "operational";

  if (input.dryRun) {
    const before = await collectCoarseCounts(input.db);
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
        receiptProvenance,
        counts: { before, after: before },
        deletedTables: [...DELETE_ORDER],
      },
    };
  }

  let receiptCounts: { before: AlphaResetCounts; after: AlphaResetCounts } | null =
    null;

  try {
    await input.db.transaction(async (tx) => {
      const txDb = tx as unknown as FoundationDb;
      await acquireAlphaResetProtection(txDb);

      const before = await collectCoarseCounts(txDb);
      await setImmutableTriggers(txDb, false);
      try {
        await ensureLedgerHead(txDb);
        await deleteResetTables(txDb);
        await regenerateOperationalAssentDocuments(txDb);
        await reseedRetentionDefaults(txDb);
        await restoreBootstrapSingleton(txDb);
        await ensureLedgerHead(txDb);

        if (input.__testInjectFailure === "after_deletes") {
          throw new Error("RESET_TEST_INJECTED_FAILURE");
        }

        let after = await collectCoarseCounts(txDb);
        // Include the forthcoming reset receipt (+1 audit) in after.audit.
        after = {
          ...after,
          audit: (after.audit ?? 0) + 1,
        };

        // Success audit only after wipe + regenerated defaults.
        // New audit chain is rooted at this receipt — not continuity with the
        // erased pre-reset ledger.
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
            receiptProvenance,
            counts: { before, after },
          },
          synthetic: input.syntheticReceipt,
        });

        after = await collectCoarseCounts(txDb);
        receiptCounts = { before, after };
      } finally {
        await setImmutableTriggers(txDb, true);
      }
    });
  } catch (error) {
    return sanitizeResetFailure(error);
  }

  if (!receiptCounts) {
    return {
      ok: false,
      code: "RESET_FAILED",
      error: "Alpha reset completed without authoritative counts",
    };
  }

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
      receiptProvenance,
      counts: receiptCounts,
      deletedTables: [...DELETE_ORDER],
    },
  };
}

/**
 * Plan-only: identity, coarse counts, delete list. No mutations.
 */
export async function dryRunAlphaReset(
  db: FoundationDb,
  input: {
    reason: string;
    syntheticReceipt?: boolean;
    env?: Record<string, string | undefined>;
  },
): Promise<AdapterResult<AlphaResetReceipt>> {
  return runAlphaReset({
    db,
    reason: input.reason,
    dryRun: true,
    syntheticReceipt: input.syntheticReceipt ?? false,
    env: input.env,
  });
}

/**
 * Execute alpha wipe after fingerprint confirmation.
 * `syntheticReceipt` must be set explicitly by the ceremony caller.
 */
export async function executeAlphaReset(
  db: FoundationDb,
  input: {
    reason: string;
    confirmFingerprint: string;
    syntheticReceipt: boolean;
    env?: Record<string, string | undefined>;
    __testInjectFailure?: "after_deletes";
  },
): Promise<AdapterResult<AlphaResetReceipt>> {
  return runAlphaReset({
    db,
    reason: input.reason,
    confirmFingerprint: input.confirmFingerprint,
    dryRun: false,
    syntheticReceipt: input.syntheticReceipt,
    env: input.env,
    __testInjectFailure: input.__testInjectFailure,
  });
}

export { tablesByClass, RESET_MANIFEST_VERSION, hashManifest };
