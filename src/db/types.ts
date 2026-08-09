import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/db/schema";

export type FoundationDb =
  | PostgresJsDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;
