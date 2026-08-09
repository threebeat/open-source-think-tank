import { defineConfig } from "drizzle-kit";

/**
 * Local/ephemeral migration config only.
 * Does not authorize a managed staging/production host (ADR 0003).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev",
  },
});
