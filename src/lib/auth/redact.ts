const SECRETISH =
  /(token|secret|password|authorization|cookie|session|recovery|magic)/i;

/**
 * Strip credential-like keys before audit privatePayload / logs.
 * Raw invite tokens, recovery tokens, and session secrets must never be stored.
 */
export function redactSensitiveFields(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRETISH.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 64 && /^[A-Za-z0-9_-]+$/.test(value)) {
      out[key] = "[redacted-opaque]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function assertNoSecretsInText(text: string, secrets: string[]) {
  for (const secret of secrets) {
    if (secret && text.includes(secret)) {
      throw new Error("Refusing to audit or log a value that contains a raw secret");
    }
  }
}
