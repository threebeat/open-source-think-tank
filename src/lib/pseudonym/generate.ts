import { randomBytes } from "node:crypto";

/**
 * Opaque conversation pseudonym. Intentionally ignores account/conversation
 * inputs so callers cannot accidentally derive correlatable identifiers.
 */
export function generateConversationPseudonym(): string {
  return `cpsp_${randomBytes(18).toString("base64url")}`;
}

export function assertPseudonymNotDerivedFrom(
  pseudonym: string,
  forbidden: Array<string | null | undefined>,
): void {
  const lowered = pseudonym.toLowerCase();
  for (const value of forbidden) {
    if (!value) {
      continue;
    }
    const needle = value.toLowerCase();
    if (needle.length >= 4 && lowered.includes(needle)) {
      throw new Error("PSEUDONYM_DERIVED_FROM_IDENTIFIER");
    }
  }
}
