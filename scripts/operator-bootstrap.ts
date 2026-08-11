/**
 * First-administrator operator ceremony (Package 3.3).
 *
 * Usage (secrets from environment only — never CLI argv):
 *   APP_MODE=gated DATABASE_URL=... OPERATOR_BOOTSTRAP_SECRET=... OPERATOR_LABEL=... \
 *     npm run operator:bootstrap -- issue --contact=you@example.test --reason="..."
 *   npm run operator:bootstrap -- finalize --reason="..." --verification-reason="..."
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import {
  finalizeAdministratorBootstrap,
  issueAdministratorBootstrapInvitation,
} from "../src/lib/operator/bootstrap";
import { requireOperatorBootstrapEnv } from "../src/lib/operator/secrets";

function usage(): never {
  console.error(`Usage:
  npm run operator:bootstrap -- issue --contact=<email> --reason=<text>
  npm run operator:bootstrap -- finalize --reason=<text> --verification-reason=<text>

Environment (required): APP_MODE=gated, DATABASE_URL, OPERATOR_BOOTSTRAP_SECRET, OPERATOR_LABEL
Never pass OPERATOR_BOOTSTRAP_SECRET on the command line.`);
  process.exit(2);
}

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  // Refuse secret-like argv
  for (const arg of argv) {
    if (/secret|password|token=/i.test(arg) && !arg.startsWith("--reason") && !arg.startsWith("--verification-reason") && !arg.startsWith("--contact")) {
      console.error("Refusing argv that looks like a secret. Use environment variables.");
      process.exit(2);
    }
  }

  const creds = requireOperatorBootstrapEnv();
  if (!creds.ok) {
    console.error(creds.error);
    process.exit(1);
  }

  const command = argv[0];
  if (command !== "issue" && command !== "finalize") {
    usage();
  }

  const url = process.env.DATABASE_URL!.trim();
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    if (command === "issue") {
      const contact = readFlag(argv, "contact");
      const reason = readFlag(argv, "reason");
      if (!contact || !reason) {
        usage();
      }
      const result = await issueAdministratorBootstrapInvitation(db, {
        intendedContactChannel: contact,
        reason,
      });
      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }
      console.log("Bootstrap invitation issued.");
      console.log(`invitationId=${result.value.invitationId}`);
      console.log(`expiresAt=${result.value.expiresAt}`);
      console.log(`operatorLabel=${result.value.operatorLabel}`);
      console.log("");
      console.log("Copy the acceptance link now. It will not be shown again.");
      console.log(result.value.acceptanceLink);
      console.log("");
      console.log(
        "WARNING: Do not paste this link into CI logs, screenshots, or tickets.",
      );
      return;
    }

    const reason = readFlag(argv, "reason");
    const verificationReason = readFlag(argv, "verification-reason");
    if (!reason || !verificationReason) {
      usage();
    }
    const result = await finalizeAdministratorBootstrap(db, {
      reason,
      verificationReason,
    });
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    console.log("First administrator bootstrap completed.");
    console.log(`accountId=${result.value.accountId}`);
    console.log(
      "Verify completion via staff role list / audit action operator.bootstrap_administrator (no secrets).",
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
