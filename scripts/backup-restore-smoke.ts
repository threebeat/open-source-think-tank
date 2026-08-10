/**
 * Ephemeral PGlite recovery drill (WP 2.11/2.12).
 *
 * This is NOT production restore validation — managed Postgres hosts remain
 * blocked pending vendor addendum. It dumps a PGlite data directory after
 * unique post-seed writes, restores into an empty instance, and verifies
 * row contents, immutable history, ledger continuity, schema version, and
 * audit ledger head.
 */
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";

import { verifyAuditContinuity } from "../src/lib/audit/ledger";
import { appendAuthAudit } from "../src/lib/auth/audit-log";
import * as schema from "../src/db/schema";
import { seedSyntheticFoundation } from "../src/db/seeds/synthetic";

const migrationsFolder = path.join(process.cwd(), "drizzle");
const MARKER_ID = "audit-ostt-synth-pglite-recovery-marker";
const MARKER_SUMMARY =
  "Unique post-seed recovery marker for ephemeral PGlite drill.";

async function createMigratedDb(options?: { loadDataDir?: Blob | File }) {
  const client = options?.loadDataDir
    ? await PGlite.create({ loadDataDir: options.loadDataDir })
    : new PGlite();
  const db = drizzle(client, { schema });
  if (!options?.loadDataDir) {
    await migrate(db, { migrationsFolder });
  }
  return { client, db };
}

async function main() {
  process.env.APP_MODE = "gated";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgres://ostt:ostt@127.0.0.1:54329/ostt_backup_smoke";

  console.log(
    "Ephemeral PGlite recovery drill (not production restore validation).",
  );

  const source = await createMigratedDb();
  await seedSyntheticFoundation(source.db);

  await appendAuthAudit(source.db, {
    actorRole: "ostt-synth-recovery-drill",
    action: "auth.test_synthetic_marker",
    subjectType: "recovery_drill",
    subjectId: MARKER_ID,
    summary: MARKER_SUMMARY,
    privatePayload: { drill: "pglite-recovery", nonce: "ostt-synth-unique-1" },
    synthetic: true,
  });

  const [markerBefore] = await source.db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.subjectId, MARKER_ID))
    .limit(1);
  if (!markerBefore) {
    throw new Error("Failed to write unique post-seed recovery marker");
  }

  const [headBefore] = await source.db
    .select()
    .from(schema.auditLedgerHead)
    .where(eq(schema.auditLedgerHead.id, "default"))
    .limit(1);
  const [metaBefore] = await source.db
    .select()
    .from(schema.schemaMeta)
    .where(eq(schema.schemaMeta.key, "migration_label"))
    .limit(1);

  const continuityBefore = await verifyAuditContinuity(source.db);
  if (!continuityBefore.ok) {
    throw new Error(`Source continuity broken: ${continuityBefore.reason}`);
  }

  const assentBefore = await source.db.select().from(schema.assentRecords);
  const dump = await source.client.dumpDataDir("none");
  await source.client.close();

  const restored = await createMigratedDb({ loadDataDir: dump });

  const [markerAfter] = await restored.db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.subjectId, MARKER_ID))
    .limit(1);
  if (!markerAfter) {
    throw new Error("Restored DB missing unique post-seed recovery marker");
  }
  if (markerAfter.summary !== MARKER_SUMMARY) {
    throw new Error("Restored marker summary mismatch");
  }
  if (markerAfter.continuityHash !== markerBefore.continuityHash) {
    throw new Error("Restored marker continuity hash mismatch");
  }
  if (
    JSON.stringify(markerAfter.privatePayload) !==
    JSON.stringify(markerBefore.privatePayload)
  ) {
    throw new Error("Restored marker privatePayload mismatch");
  }

  const [headAfter] = await restored.db
    .select()
    .from(schema.auditLedgerHead)
    .where(eq(schema.auditLedgerHead.id, "default"))
    .limit(1);
  if (
    !headAfter ||
    headAfter.headHash !== headBefore?.headHash ||
    headAfter.headEventId !== headBefore?.headEventId
  ) {
    throw new Error("Restored audit ledger head mismatch");
  }

  const [metaAfter] = await restored.db
    .select()
    .from(schema.schemaMeta)
    .where(eq(schema.schemaMeta.key, "migration_label"))
    .limit(1);
  if (metaAfter?.value !== metaBefore?.value) {
    throw new Error("Restored schema migration_label mismatch");
  }

  const assentAfter = await restored.db.select().from(schema.assentRecords);
  if (assentAfter.length !== assentBefore.length) {
    throw new Error("Restored assent history count mismatch");
  }
  for (const row of assentBefore) {
    const match = assentAfter.find((candidate) => candidate.id === row.id);
    if (!match || match.contentHash !== row.contentHash) {
      throw new Error(`Restored assent row mismatch for ${row.id}`);
    }
  }

  const continuityAfter = await verifyAuditContinuity(restored.db);
  if (!continuityAfter.ok) {
    throw new Error(`Restored continuity broken: ${continuityAfter.reason}`);
  }
  if (continuityAfter.checked !== continuityBefore.checked) {
    throw new Error("Restored continuity checked-count mismatch");
  }

  // Immutability still enforced after restore.
  await restored.db
    .update(schema.assentRecords)
    .set({ method: "tamper" })
    .where(eq(schema.assentRecords.id, assentAfter[0]!.id))
    .then(() => {
      throw new Error("Expected assent immutability trigger to reject UPDATE");
    })
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        error.message.includes("Expected assent immutability")
      ) {
        throw error;
      }
      // trigger rejection is success
    });

  await restored.client.close();

  console.log("Ephemeral PGlite recovery drill OK", {
    markerId: MARKER_ID,
    continuityChecked: continuityAfter.checked,
    headEventId: headAfter.headEventId,
    migrationLabel: metaAfter?.value,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
