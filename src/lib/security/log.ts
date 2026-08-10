import { redactSensitiveFields } from "@/lib/auth/redact";

export type SecurityLogLevel = "info" | "warn" | "error";

export type SecurityLogEvent = {
  level: SecurityLogLevel;
  event: string;
  accountId?: string | null;
  requestCorrelationId?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Structured security logging with sensitive-field redaction.
 * Never write raw tokens/secrets into details.
 */
export function securityLog(input: SecurityLogEvent): void {
  const details = redactSensitiveFields(input.details) ?? {};
  const line = {
    ts: new Date().toISOString(),
    channel: "security",
    level: input.level,
    event: input.event,
    accountId: input.accountId ?? null,
    requestCorrelationId: input.requestCorrelationId ?? null,
    details,
  };
  const serialized = JSON.stringify(line);
  if (input.level === "error") {
    console.error(serialized);
    return;
  }
  if (input.level === "warn") {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}
