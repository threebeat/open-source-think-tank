import { createHash } from "node:crypto";

/**
 * Deterministic canonical JSON: object keys are sorted recursively so
 * semantically identical import payloads hash identically regardless of
 * caller key order. Array order is preserved (display order is meaningful
 * for `opinionGroups` / findings). Used to compute `canonicalHash` for
 * `public_input_report_imports` (ADR 0018) — idempotent re-import keys off
 * this hash within a conversation.
 */
export function canonicalStringify(value: unknown): string {
  return stringifyCanonical(value);
}

function stringifyCanonical(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("CANONICAL_JSON_NON_FINITE_NUMBER");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const body = keys
      .map(
        (key) => `${JSON.stringify(key)}:${stringifyCanonical(record[key])}`,
      )
      .join(",");
    return `{${body}}`;
  }
  throw new Error(`CANONICAL_JSON_UNSUPPORTED_TYPE:${typeof value}`);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Canonicalize then sha256-hex — the value stored as `canonicalHash`. */
export function canonicalHashOf(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

export const CANONICAL_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isValidCanonicalHash(value: string): boolean {
  return CANONICAL_HASH_PATTERN.test(value);
}
