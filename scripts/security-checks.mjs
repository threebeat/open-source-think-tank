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

// --- Phase 3.12 hardening guards ---
{
  const pkg = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const forbiddenVendors = [
    "polis",
    "@polis",
    "stripe",
    "openai",
    "@anthropic",
    "posthog",
    "segment",
    "mixpanel",
    "sendgrid",
    "@sendgrid",
    "mailgun",
    "resend",
    "twilio",
    "elasticsearch",
    "@elastic",
    "algoliasearch",
    "meilisearch",
    "@aws-sdk/client-s3",
    "firebase",
    "supabase",
  ];
  for (const name of Object.keys(deps)) {
    if (
      forbiddenVendors.some(
        (v) => name === v || name.startsWith(`${v}/`) || name.startsWith(`@${v}`),
      )
    ) {
      fail(`unexpected vendor/sdk dependency: ${name}`);
    }
  }
  ok("no forbidden Phase 3 vendor/SDK dependencies in package.json");
}

{
  const appDir = path.join(root, "src/app");
  const publicRouteFiles = [];
  function walkApp(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        // Account-gated product surfaces may import auth/db. Public landing,
        // demo, and join remain scanned. URL is never authorization.
        if (
          entry === "api" ||
          entry === "workspace" ||
          entry === "account" ||
          entry === "(member)" ||
          entry === "org"
        ) {
          continue;
        }
        walkApp(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        publicRouteFiles.push(full);
      }
    }
  }
  walkApp(appDir);
  const gatedImport =
    /from\s+["']@\/(db|lib\/(auth|operator|privacy\/export|search\/workspace-search)|lib\/topics\/staff-export)/;
  for (const file of publicRouteFiles) {
    const rel = path.relative(root, file);
    if (rel.includes(`${path.sep}workspace${path.sep}`)) continue;
    if (rel.includes(`${path.sep}account${path.sep}`)) continue;
    if (rel.includes(`${path.sep}api${path.sep}`)) continue;
    const text = readFileSync(file, "utf8");
    if (gatedImport.test(text) && !text.includes("resolveAppMode")) {
      // Soft: allow mode-branched pages that import only after gated checks via dynamic import.
      if (!text.includes("await import(") && !text.includes('APP_MODE')) {
        fail(`public route may import gated modules: ${rel}`);
      }
    }
  }
  ok("public app routes scanned for direct gated module imports");
}

{
  const resetRouteHit = [];
  function walkAll(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walkAll(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        const rel = path.relative(root, full).replace(/\\/g, "/");
        if (!rel.startsWith("src/app/")) continue;
        const text = readFileSync(full, "utf8");
        if (
          /alpha-reset|operator-reset-alpha|executeAlphaReset|dryRunAlphaReset/.test(
            text,
          )
        ) {
          resetRouteHit.push(rel);
        }
      }
    }
  }
  walkAll(path.join(root, "src/app"));
  if (resetRouteHit.length > 0) {
    fail(`public/app reset surface detected: ${resetRouteHit.join(", ")}`);
  } else {
    ok("no app-route alpha reset surface");
  }
}

{
  const dumpPatterns = [
    /\.sql\.gz$/i,
    /\.dump$/i,
    /pg_dump/i,
    /alpha-reset-dump/i,
  ];
  const badArtifacts = [];
  function walkArtifacts(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (["node_modules", ".next", ".git"].includes(entry)) continue;
        walkArtifacts(full);
      } else {
        const rel = path.relative(root, full).replace(/\\/g, "/");
        if (dumpPatterns.some((p) => p.test(rel) || p.test(entry))) {
          badArtifacts.push(rel);
        }
      }
    }
  }
  for (const top of ["tmp", "tmp-qa", "scripts", "docs"]) {
    const abs = path.join(root, top);
    try {
      walkArtifacts(abs);
    } catch {
      // optional dirs
    }
  }
  if (badArtifacts.length > 0) {
    fail(`possible reset dump artifacts: ${badArtifacts.join(", ")}`);
  } else {
    ok("no committed reset dump artifacts under scanned dirs");
  }
}

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
