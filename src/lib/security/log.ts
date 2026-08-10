import { createHash, createHmac } from "node:crypto";

import { redactSensitiveFields } from "@/lib/auth/redact";

export type SecurityLogLevel = "info" | "warn" | "error";

export type SecurityLogEvent = {
  level: SecurityLogLevel;
  event: string;
  /**
   * Opaque operational subject reference (HMAC/hash). Never pass a raw account id.
   * Prefer {@link operationalSubjectRef}.
   */
  subjectRef?: string | null;
  requestCorrelationId?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Stable keyed operational pseudonym for correlating security logs without
 * emitting raw account identifiers.
 */
export function operationalSubjectRef(accountId: string): string {
  const key =
    process.env.AUTH_SECRET ?? process.env.SECURITY_LOG_HMAC_KEY ?? null;
  const material = `account:${accountId}`;
  if (key) {
    return `subj_${createHmac("sha256", key).update(material).digest("hex").slice(0, 24)}`;
  }
  // Unkeyed environments (e.g. public-demo) still must not emit raw ids.
  return `subj_${createHash("sha256").update(`unkeyed:${material}`).digest("hex").slice(0, 24)}`;
}

function looksLikeRawAccountId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^account-[a-z0-9-]+$/i.test(value) || value.includes("@");
}

/**
 * Structured security logging with recursive sensitive-field redaction.
 * Never write raw tokens, account ids, or emails into the channel.
 */
export function securityLog(input: SecurityLogEvent): void {
  if (looksLikeRawAccountId(input.subjectRef)) {
    throw new Error(
      "securityLog refuses raw account identifiers in subjectRef — use operationalSubjectRef()",
    );
  }
  if (looksLikeRawAccountId(input.requestCorrelationId)) {
    throw new Error(
      "securityLog refuses raw account identifiers in requestCorrelationId",
    );
  }

  const details =
    redactSensitiveFields(input.details, { redactIdentifiers: true }) ?? {};
  const line = {
    ts: new Date().toISOString(),
    channel: "security",
    level: input.level,
    event: input.event,
    subjectRef: input.subjectRef ?? null,
    requestCorrelationId: input.requestCorrelationId ?? null,
    details,
  };
  const serialized = JSON.stringify(line);
  // Defense in depth: refuse lines that still embed raw account/email shapes.
  if (
    /"account-[a-z0-9-]+"/i.test(serialized) ||
    /"[^"\s]+@[^"\s]+\.[^"\s]+"/i.test(serialized)
  ) {
    console.error(
      JSON.stringify({
        ts: line.ts,
        channel: "security",
        level: "error",
        event: "security.log_refused_sensitive_payload",
        subjectRef: null,
        requestCorrelationId: null,
        details: { originalEvent: input.event },
      }),
    );
    return;
  }
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
