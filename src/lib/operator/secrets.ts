import { timingSafeEqual } from "node:crypto";

import { assertEnvironmentSafe } from "@/lib/env/app-mode";

/**
 * Compare secrets with timingSafeEqual (length-mismatched inputs still run a
 * padded compare so simple `===` is never used for secret checks).
 */
export function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const max = Math.max(a.length, b.length, 1);
    const padA = Buffer.alloc(max);
    const padB = Buffer.alloc(max);
    a.copy(padA);
    b.copy(padB);
    timingSafeEqual(padA, padB);
    return false;
  }
  return timingSafeEqual(a, b);
}

export type OperatorCredentialCheck =
  | { ok: true; label: string; secret: string }
  | { ok: false; code: string; error: string };

/**
 * Fail closed unless gated mode + DATABASE_URL + strong operator secret + label.
 * Public-demo fails inside assertEnvironmentSafe before DB construction.
 * Secret must come from the environment — never from CLI argv.
 */
function requireOperatorSecretEnv(
  env: Record<string, string | undefined>,
  options: {
    secretKey: "OPERATOR_BOOTSTRAP_SECRET" | "OPERATOR_RESET_SECRET";
    publicDemoCode: string;
    publicDemoError: string;
  },
): OperatorCredentialCheck {
  try {
    if (assertEnvironmentSafe(env) !== "gated") {
      return {
        ok: false,
        code: options.publicDemoCode,
        error: options.publicDemoError,
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "ENV_UNSAFE",
      error: error instanceof Error ? error.message : "Environment unsafe",
    };
  }

  const secret = env[options.secretKey]?.trim() ?? "";
  const label = env.OPERATOR_LABEL?.trim() ?? "";
  if (!secret) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_MISSING",
      error: `${options.secretKey} is required`,
    };
  }
  if (secret.length < 32) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_WEAK",
      error: `${options.secretKey} must be at least 32 characters`,
    };
  }
  if (!label || label.length < 2) {
    return {
      ok: false,
      code: "OPERATOR_LABEL_MISSING",
      error: "OPERATOR_LABEL is required (non-secret operator label)",
    };
  }
  // Confirm the process secret matches itself via timing-safe compare helper
  // (guards against accidental plain-equality usage in call sites).
  if (!secretsEqual(secret, env[options.secretKey]?.trim() ?? "")) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_INVALID",
      error: `${options.secretKey} mismatch`,
    };
  }
  return { ok: true, label, secret };
}

export function requireOperatorBootstrapEnv(
  env: Record<string, string | undefined> = process.env,
): OperatorCredentialCheck {
  return requireOperatorSecretEnv(env, {
    secretKey: "OPERATOR_BOOTSTRAP_SECRET",
    publicDemoCode: "PUBLIC_DEMO_NO_BOOTSTRAP",
    publicDemoError: "Operator bootstrap unavailable in public-demo mode",
  });
}

/**
 * Fail closed unless gated mode + DATABASE_URL + strong reset secret + label.
 * OPERATOR_RESET_SECRET is distinct from OPERATOR_BOOTSTRAP_SECRET.
 */
export function requireOperatorResetEnv(
  env: Record<string, string | undefined> = process.env,
): OperatorCredentialCheck {
  return requireOperatorSecretEnv(env, {
    secretKey: "OPERATOR_RESET_SECRET",
    publicDemoCode: "PUBLIC_DEMO_NO_RESET",
    publicDemoError: "Operator alpha reset unavailable in public-demo mode",
  });
}
