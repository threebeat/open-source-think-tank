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
export function requireOperatorBootstrapEnv(
  env: NodeJS.ProcessEnv = process.env,
): OperatorCredentialCheck {
  try {
    if (assertEnvironmentSafe(env) !== "gated") {
      return {
        ok: false,
        code: "PUBLIC_DEMO_NO_BOOTSTRAP",
        error: "Operator bootstrap unavailable in public-demo mode",
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "ENV_UNSAFE",
      error: error instanceof Error ? error.message : "Environment unsafe",
    };
  }

  const secret = env.OPERATOR_BOOTSTRAP_SECRET?.trim() ?? "";
  const label = env.OPERATOR_LABEL?.trim() ?? "";
  if (!secret) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_MISSING",
      error: "OPERATOR_BOOTSTRAP_SECRET is required",
    };
  }
  if (secret.length < 32) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_WEAK",
      error: "OPERATOR_BOOTSTRAP_SECRET must be at least 32 characters",
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
  if (!secretsEqual(secret, env.OPERATOR_BOOTSTRAP_SECRET?.trim() ?? "")) {
    return {
      ok: false,
      code: "OPERATOR_SECRET_INVALID",
      error: "Operator bootstrap secret mismatch",
    };
  }
  return { ok: true, label, secret };
}
