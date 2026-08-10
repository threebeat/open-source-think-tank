const SECRETISH =
  /(token|secret|password|authorization|cookie|session|recovery|magic|credential)/i;

/** Keys that must never appear as raw identifiers in security logs. */
const IDENTIFIERISH =
  /^(accountId|actorAccountId|otherAccountId|subjectId|personId|contactChannel|email|intendedContactChannel|placedByAccountId|releasedByAccountId|requestedByAccountId|approvedByAccountId|subjectAccountId|foreignSubjectRef)$/i;

const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_ID_VALUE = /^account-[a-z0-9-]+$/i;
const PERSON_ID_VALUE = /^person-[a-z0-9-]+$/i;

export type RedactOptions = {
  /**
   * When true (security logs), also redact account/email identifier keys and
   * identifier-shaped string values. Audit privatePayload keeps institutional
   * subject identifiers after secret redaction only.
   */
  redactIdentifiers?: boolean;
};

function redactStringValue(value: string, redactIdentifiers: boolean): string {
  if (redactIdentifiers) {
    if (EMAIL_VALUE.test(value)) {
      return "[redacted-email]";
    }
    if (ACCOUNT_ID_VALUE.test(value) || PERSON_ID_VALUE.test(value)) {
      return "[redacted-id]";
    }
  }
  if (value.length > 64 && /^[A-Za-z0-9_-]+$/.test(value)) {
    return "[redacted-opaque]";
  }
  return value;
}

function redactUnknown(value: unknown, options: RedactOptions): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return redactStringValue(value, Boolean(options.redactIdentifiers));
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, options));
  }
  if (typeof value === "object") {
    return (
      redactSensitiveFields(value as Record<string, unknown>, options) ?? {}
    );
  }
  return "[redacted-unsupported]";
}

/**
 * Recursively strip credential-like keys (and optionally identifiers) before
 * audit privatePayload / security logs.
 */
export function redactSensitiveFields(
  input: Record<string, unknown> | undefined,
  options: RedactOptions = {},
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  const redactIdentifiers = Boolean(options.redactIdentifiers);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRETISH.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (redactIdentifiers && IDENTIFIERISH.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = redactUnknown(value, options);
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
