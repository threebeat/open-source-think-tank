/**
 * Wait until Docker Compose Postgres accepts connections.
 * Used when `docker compose up -d --wait` is unavailable.
 */
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const maxAttempts = Number(process.env.OSTT_PG_WAIT_ATTEMPTS ?? 40);
const sleepMs = Number(process.env.OSTT_PG_WAIT_MS ?? 2000);

function pgReady() {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      "ostt",
      "-d",
      "ostt_dev",
    ],
    { encoding: "utf8" },
  );
  return result.status === 0;
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  if (pgReady()) {
    console.log(`Postgres ready (attempt ${attempt}/${maxAttempts}).`);
    process.exit(0);
  }
  console.log(`Waiting for Postgres… (${attempt}/${maxAttempts})`);
  await delay(sleepMs);
}

console.error("Postgres did not become ready within the wait budget.");
spawnSync("docker", ["compose", "ps"], { stdio: "inherit" });
process.exit(1);
