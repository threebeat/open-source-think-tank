/**
 * Operator alpha-reset ceremony (Phase 3 closure).
 *
 * Usage (secrets from environment only — never CLI argv):
 *   APP_MODE=gated DATABASE_URL=... OPERATOR_RESET_SECRET=... OPERATOR_LABEL=... \
 *     npm run operator:reset-alpha -- --reason="..."
 *   npm run operator:reset-alpha -- --execute --confirm-fingerprint=<exact> --reason="..."
 *
 * Default is dry-run. Receipt provenance is always operational/non-synthetic.
 * Never pass OPERATOR_RESET_SECRET on the command line.
 */
import { execSync } from "node:child_process";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import {
  computeDatabaseFingerprint,
  dryRunAlphaReset,
  executeAlphaReset,
  parseDatabaseName,
} from "../src/lib/operator/alpha-reset";

function usage(): never {
  console.error(`Usage:
  npm run operator:reset-alpha -- --reason=<text>
  npm run operator:reset-alpha -- --execute --confirm-fingerprint=<exact> --reason=<text>

Environment (required): APP_MODE=gated, DATABASE_URL, OPERATOR_RESET_SECRET, OPERATOR_LABEL
Optional: SOURCE_COMMIT_SHA (else GITHUB_SHA / git HEAD / unknown)
Refuse ostt_dev unless OSTT_ALLOW_DEV_RESET=1.
Receipt provenance is operational (non-synthetic). Disposable smoke opts into synthetic separately.
Never pass OPERATOR_RESET_SECRET on the command line.`);
  process.exit(2);
}

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function resolveSourceCommitSha(): string {
  if (process.env.SOURCE_COMMIT_SHA?.trim()) {
    return process.env.SOURCE_COMMIT_SHA.trim();
  }
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim();
  }
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const argv = process.argv.slice(2);
  for (const arg of argv) {
    if (
      /secret|password|token=/i.test(arg) &&
      !arg.startsWith("--reason") &&
      !arg.startsWith("--confirm-fingerprint")
    ) {
      console.error("Refusing argv that looks like a secret. Use environment variables.");
      process.exit(2);
    }
  }

  const reason = readFlag(argv, "reason");
  if (!reason) {
    usage();
  }

  const execute = hasFlag(argv, "execute");
  const confirmFingerprint = readFlag(argv, "confirm-fingerprint");
  if (execute && !confirmFingerprint) {
    console.error("Execute requires --confirm-fingerprint=<exact> from a prior dry-run.");
    process.exit(2);
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  process.env.SOURCE_COMMIT_SHA = resolveSourceCommitSha();

  let fingerprint: string;
  try {
    fingerprint = computeDatabaseFingerprint(url);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log("Alpha reset identity (safe fields only):");
  console.log(`  databaseName=${parseDatabaseName(url)}`);
  console.log(`  databaseFingerprint=${fingerprint}`);
  console.log(`  sourceCommitSha=${process.env.SOURCE_COMMIT_SHA}`);
  console.log(`  mode=${execute ? "execute" : "dry-run"}`);
  console.log(`  receiptProvenance=operational`);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const result = execute
      ? await executeAlphaReset(db, {
          reason,
          confirmFingerprint: confirmFingerprint!,
          // Normal operator CLI is always non-synthetic.
          syntheticReceipt: false,
        })
      : await dryRunAlphaReset(db, { reason, syntheticReceipt: false });

    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }

    const receipt = result.value;
    console.log(`  manifestVersion=${receipt.manifestVersion}`);
    console.log(`  manifestHash=${receipt.manifestHash}`);
    console.log(`  schemaVersion=${receipt.schemaVersion}`);
    console.log(`  operatorLabel=${receipt.operatorLabel}`);
    console.log(`  receiptProvenance=${receipt.receiptProvenance}`);
    console.log("  counts.before=", JSON.stringify(receipt.counts.before));
    console.log("  counts.after=", JSON.stringify(receipt.counts.after));
    if (receipt.dryRun) {
      console.log("");
      console.log("Dry-run only — no rows deleted.");
      console.log(
        `To execute: npm run operator:reset-alpha -- --execute --confirm-fingerprint=${receipt.databaseFingerprint} --reason="..."`,
      );
    } else {
      console.log("");
      console.log(
        "Alpha reset executed. New audit chain is rooted at alpha.reset_executed (metadata only; not continuity with the erased pre-reset ledger).",
      );
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
