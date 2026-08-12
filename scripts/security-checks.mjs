/**
 * Lightweight security checks for WP 2.11 (headers config, secret patterns, npm audit).
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

const headersSource = readFileSync(
  path.join(root, "src/lib/security/headers.ts"),
  "utf8",
);
for (const header of [
  "X-Content-Type-Options",
  "Content-Security-Policy",
  "X-Frame-Options",
]) {
  if (!headersSource.includes(header)) {
    fail(`security headers missing ${header}`);
  }
}
ok("security headers module declares baseline headers");

const proxySource = readFileSync(path.join(root, "src/proxy.ts"), "utf8");
if (!proxySource.includes("assertCsrfSafe")) {
  fail("proxy does not invoke CSRF checks");
} else {
  ok("proxy wires CSRF checks");
}

const sourceUrlPolicy = readFileSync(
  path.join(root, "src/lib/security/source-url.ts"),
  "utf8",
);
if (
  !sourceUrlPolicy.includes("https:") ||
  !sourceUrlPolicy.includes("validateSourceUrl")
) {
  fail("source-url policy module missing https validation export");
} else if (
  sourceUrlPolicy.includes("dns.lookup") ||
  sourceUrlPolicy.includes("fetch(") ||
  sourceUrlPolicy.includes("http.request")
) {
  fail("source-url policy must not perform network I/O");
} else {
  ok("source-url policy is local https validation only");
}

const mutationLimiter = readFileSync(
  path.join(root, "src/lib/security/mutation-rate-limit.ts"),
  "utf8",
);
if (
  !mutationLimiter.includes("MutationRateLimiter") ||
  !mutationLimiter.includes("single-instance")
) {
  fail("mutation rate limiter interface/docs missing");
} else if (
  /redis|upstash|ioredis/i.test(mutationLimiter)
) {
  fail("mutation rate limiter must not add a distributed vendor in 3.9");
} else {
  ok("mutation rate limiter remains in-process / replaceable");
}

const secretPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
  /postgres:\/\/[^:]+:[^@]+@/,
];
const scanRoots = ["src", "scripts", "docs"];
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|mjs|md|json)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

for (const rel of scanRoots) {
  const abs = path.join(root, rel);
  for (const file of walk(abs)) {
    const text = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(text) && !file.endsWith("security-checks.mjs")) {
        // Allow documented example connection strings in tests/docs that use ostt:ostt local defaults.
        if (
          text.includes("ostt:ostt@127.0.0.1") ||
          text.includes("ostt:ostt@")
        ) {
          continue;
        }
        fail(`possible secret pattern ${pattern} in ${path.relative(root, file)}`);
      }
    }
  }
}
ok("secret pattern scan completed");

try {
  execSync("npm audit --audit-level=high", {
    cwd: root,
    stdio: "inherit",
  });
  ok("npm audit (high) passed");
} catch {
  fail("npm audit reported high/critical issues");
}

if (failed) {
  process.exit(1);
}
console.log("Security checks passed.");
