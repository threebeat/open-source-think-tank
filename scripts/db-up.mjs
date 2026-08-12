/**
 * Start Compose Postgres and wait until healthy before migrations/E2E.
 * Prefer `docker compose up -d --wait`; fall back to up + wait-for-postgres.mjs.
 * If Compose cannot run but Postgres is already reachable on the configured
 * port (native install / shared CI service), succeed after the wait poll.
 */
import { spawnSync } from "node:child_process";

function run(args, options = {}) {
  return spawnSync("docker", args, { stdio: "inherit", ...options });
}

function waitForPostgres() {
  return spawnSync(process.execPath, ["scripts/wait-for-postgres.mjs"], {
    stdio: "inherit",
  });
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
if (up.status === 0) {
  const wait = waitForPostgres();
  process.exit(wait.status ?? 1);
}

console.warn(
  "docker compose could not start postgres; checking for an already-reachable instance…",
);
const waitExisting = waitForPostgres();
if (waitExisting.status === 0) {
  console.log("Postgres is already reachable; continuing without Compose.");
  process.exit(0);
}
process.exit(up.status ?? waitExisting.status ?? 1);
