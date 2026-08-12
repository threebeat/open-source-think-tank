/**
 * Wait until Postgres accepts connections.
 * Prefer Docker Compose `pg_isready` when available; otherwise probe the
 * configured host/port with local `pg_isready` or a TCP connect.
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const maxAttempts = Number(process.env.OSTT_PG_WAIT_ATTEMPTS ?? 40);
const sleepMs = Number(process.env.OSTT_PG_WAIT_MS ?? 2000);
const host = process.env.OSTT_PG_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.OSTT_PG_PORT ?? 54329);

function composeReady() {
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

function localPgIsReady() {
  const result = spawnSync(
    "pg_isready",
    ["-h", host, "-p", String(port), "-U", "ostt", "-d", "ostt_dev"],
    { encoding: "utf8" },
  );
  return result.status === 0;
}

function tcpReady() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function pgReady() {
  if (composeReady()) return true;
  if (localPgIsReady()) return true;
  return tcpReady();
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  if (await pgReady()) {
    console.log(`Postgres ready (attempt ${attempt}/${maxAttempts}).`);
    process.exit(0);
  }
  console.log(`Waiting for Postgres… (${attempt}/${maxAttempts})`);
  await delay(sleepMs);
}

console.error("Postgres did not become ready within the wait budget.");
spawnSync("docker", ["compose", "ps"], { stdio: "inherit" });
process.exit(1);
