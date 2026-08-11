/**
 * Start Compose Postgres and wait until healthy before migrations/E2E.
 * Prefer `docker compose up -d --wait`; fall back to up + wait-for-postgres.mjs.
 */
import { spawnSync } from "node:child_process";

function run(args, options = {}) {
  return spawnSync("docker", args, { stdio: "inherit", ...options });
}

const waited = run(["compose", "up", "-d", "--wait", "postgres"]);
if (waited.status === 0) {
  console.log("Postgres is up (compose --wait).");
  process.exit(0);
}

console.warn(
  "compose --wait failed or unsupported; starting postgres and polling pg_isready…",
);
const up = run(["compose", "up", "-d", "postgres"]);
if (up.status !== 0) {
  process.exit(up.status ?? 1);
}

const wait = spawnSync(process.execPath, ["scripts/wait-for-postgres.mjs"], {
  stdio: "inherit",
});
process.exit(wait.status ?? 1);
