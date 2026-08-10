import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { seedSyntheticFoundation } from "../src/db/seeds/synthetic";
import { assertEnvironmentSafe } from "../src/lib/env/app-mode";

async function main() {
  const mode = assertEnvironmentSafe(process.env);
  if (mode !== "gated") {
    throw new Error("db:seed requires APP_MODE=gated");
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("db:seed requires DATABASE_URL");
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  await seedSyntheticFoundation(db);
  await client.end({ timeout: 5 });
  console.log("Synthetic foundation seed applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
