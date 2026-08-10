import { createHash } from "node:crypto";

/** Canonical digest fields for the continuity chain (order matters). */
export type ContinuityDigestInput = {
  id: string;
  prevHash: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  actorAccountId: string | null;
  reason: string | null;
  requestCorrelationId: string | null;
  synthetic: boolean;
};

export function computeContinuityDigest(input: ContinuityDigestInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: input.id,
        prev: input.prevHash,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        summary: input.summary,
        actorAccountId: input.actorAccountId,
        reason: input.reason,
        requestCorrelationId: input.requestCorrelationId,
        synthetic: input.synthetic,
      }),
    )
    .digest("hex");
}
