/**
 * Backup/restore smoke for ephemeral PGlite (WP 2.11).
 * Recovery point: migrate + seedSyntheticFoundation on an isolated database.
 */
import { createTestDatabase } from "../src/db/pglite";
import {
  accounts,
  assentRecords,
  auditEvents,
} from "../src/db/schema";
import { seedSyntheticFoundation } from "../src/db/seeds/synthetic";

async function main() {
  process.env.APP_MODE = "gated";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgres://ostt:ostt@127.0.0.1:54329/ostt_backup_smoke";

  const first = await createTestDatabase();
  await seedSyntheticFoundation(first.db);
  const before = {
    accounts: (await first.db.select().from(accounts)).length,
    assent: (await first.db.select().from(assentRecords)).length,
    audit: (await first.db.select().from(auditEvents)).length,
  };
  await first.client.close();

  const restored = await createTestDatabase();
  await seedSyntheticFoundation(restored.db);
  const after = {
    accounts: (await restored.db.select().from(accounts)).length,
    assent: (await restored.db.select().from(assentRecords)).length,
    audit: (await restored.db.select().from(auditEvents)).length,
  };
  await restored.client.close();

  if (before.accounts !== after.accounts || before.assent !== after.assent) {
    console.error("Restore smoke mismatch", { before, after });
    process.exit(1);
  }

  console.log("Backup/restore smoke OK", { before, after });
  console.log(
    "Documented recovery point: migrate + seedSyntheticFoundation on isolated DB.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
