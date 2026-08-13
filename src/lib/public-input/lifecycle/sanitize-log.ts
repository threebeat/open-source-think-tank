/**
 * Redact provider conversation references from arbitrary log strings/objects.
 *
 * Belt-and-suspenders alongside `types.ts` DTO allowlisting and
 * `src/lib/auth/redact.ts`: even if a caller mistakenly stringifies a raw
 * repository record, this strips both the known opaque-token shape
 * (`fixture-conv:...`, `pinconv_...`-style) and any field literally named
 * `providerConversationRef` / `embedUrl` before it reaches a log line.
 */

const OPAQUE_REF_KEY_PATTERN = /providerConversationRef|embedUrl|conversationRef/i;

/** Matches the fixture provider's `fixture-conv:<topicId>` token shape and similar `kind:token` opaque refs. */
const OPAQUE_TOKEN_VALUE_PATTERN = /\b[a-z][a-z0-9_-]{2,30}:[a-zA-Z0-9_-]{3,120}\b/g;

const REDACTED_MARKER = "[redacted-provider-ref]";

export function redactProviderRefsFromString(input: string): string {
  return input.replace(OPAQUE_TOKEN_VALUE_PATTERN, REDACTED_MARKER);
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactProviderRefsFromString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    return sanitizeForLog(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Recursively strip provider-ref-shaped keys/values before logging or
 * auditing a payload that might reference a Public Input conversation.
 */
export function sanitizeForLog(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (OPAQUE_REF_KEY_PATTERN.test(key)) {
      out[key] = REDACTED_MARKER;
      continue;
    }
    out[key] = redactValue(value);
  }
  return out;
}

/** Throws if a raw provider ref value is about to be written to a log/audit summary string. */
export function assertNoProviderRefInText(
  text: string,
  providerConversationRef: string | null | undefined,
): void {
  if (providerConversationRef && text.includes(providerConversationRef)) {
    throw new Error(
      "Refusing to log/audit a string that contains a raw provider conversation reference",
    );
  }
}
