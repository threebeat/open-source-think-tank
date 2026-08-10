import { createHash } from "node:crypto";

/** Canonical digest fields for the continuity chain (order matters). */
export type ContinuityDigestInput = {
  id: string;
  prevHash: string | null;
  /** Explicit event timestamp (ISO-8601), never left to an unhashed DB default. */
  at: string;
  actorRole: string;
  actorAccountId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  reason: string | null;
  requestCorrelationId: string | null;
  /** Validated/redacted private payload, or null when absent. */
  privatePayload: Record<string, unknown> | null;
  synthetic: boolean;
};

/** Stable JSON for digesting nested payloads (sorted object keys). */
export function canonicalizeForDigest(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForDigest);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalizeForDigest(obj[key]);
    }
    return out;
  }
  return value;
}

export function computeContinuityDigest(input: ContinuityDigestInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: input.id,
        prev: input.prevHash,
        at: input.at,
        actorRole: input.actorRole,
        actorAccountId: input.actorAccountId,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        summary: input.summary,
        reason: input.reason,
        requestCorrelationId: input.requestCorrelationId,
        privatePayload: canonicalizeForDigest(input.privatePayload),
        synthetic: input.synthetic,
      }),
    )
    .digest("hex");
}
