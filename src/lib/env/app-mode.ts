import type { AppMode } from "@/lib/adapters/types";

/** Env vars that must never appear on a public-demo deployment (ADR 0002). */
export const GATED_SECRET_ENV_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "EMAIL_API_KEY",
  "EMAIL_SERVER",
  "VERIFICATION_VENDOR_API_KEY",
] as const;

export type GatedSecretEnvKey = (typeof GATED_SECRET_ENV_KEYS)[number];

/**
 * Resolve APP_MODE. Unset defaults to public-demo so Phase 1 / demo deploys
 * fail closed rather than accidentally opening a database client.
 */
export type EnvMap = Record<string, string | undefined>;

export function resolveAppMode(env: EnvMap = process.env): AppMode {
  const raw = env.APP_MODE?.trim().toLowerCase();
  if (raw === "gated") {
    return "gated";
  }
  if (raw === "public-demo" || raw === undefined || raw === "") {
    return "public-demo";
  }
  throw new Error(
    `Invalid APP_MODE="${env.APP_MODE}". Expected "public-demo" or "gated".`,
  );
}

export function listPresentGatedSecrets(
  env: EnvMap = process.env,
): GatedSecretEnvKey[] {
  return GATED_SECRET_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * Fail closed when public-demo is combined with gated secrets, or when gated
 * mode lacks DATABASE_URL. Call before constructing any database client.
 */
export function assertEnvironmentSafe(env: EnvMap = process.env): AppMode {
  const mode = resolveAppMode(env);
  const secrets = listPresentGatedSecrets(env);

  if (mode === "public-demo" && secrets.length > 0) {
    throw new Error(
      `APP_MODE=public-demo forbids gated secrets (${secrets.join(", ")}). ` +
        `Unset them or set APP_MODE=gated for local foundation work.`,
    );
  }

  if (mode === "gated" && !env.DATABASE_URL?.trim()) {
    throw new Error(
      "APP_MODE=gated requires DATABASE_URL for the local/ephemeral PostgreSQL database.",
    );
  }

  return mode;
}
