/**
 * Production build for gated E2E with APP_MODE=gated so /topics does not
 * statically bake public-demo fixture params into the artifact.
 */
import { spawnSync } from "node:child_process";

process.env.APP_MODE = "gated";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev";
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-e2e-not-production";
process.env.AUTH_URL = process.env.AUTH_URL ?? "http://127.0.0.1:3000";

const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
