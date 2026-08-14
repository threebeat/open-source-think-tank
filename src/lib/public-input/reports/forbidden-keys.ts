/**
 * Shared forbidden-key vocabulary for Public Input aggregate projections and
 * canonical import payloads (ADR 0018). Never store participant rows, vote
 * matrices, `xid`, tokens, raw URLs, or secrets — this list plus the
 * recursive walker below is the belt-and-suspenders defense used by both:
 *   - the canonical import schema (src/lib/public-input/reports/canonical-schema.ts)
 *   - the public/staff DTO leak checks (src/features/public-input/aggregate-report.ts,
 *     src/lib/public-input/reports/projection.ts)
 *
 * Case-sensitive exact key match, checked at every depth of objects/arrays.
 */
export const PUBLIC_INPUT_FORBIDDEN_KEYS = [
  "providerParticipantId",
  "providerParticipantIds",
  "accountId",
  "accountIds",
  "voteRows",
  "perPersonVotes",
  "voteMatrix",
  "individualGroupMembership",
  "groupMembershipByPerson",
  "authorProviderLinkage",
  "crossConversationLinkage",
  "contact",
  "identity",
  "verification",
  "rawProviderUrl",
  "accessToken",
  "reportSecret",
  "embedSecret",
  "xid",
  "participantId",
  "participantIds",
  "email",
  "token",
  "secret",
  "password",
  "providerConversationRef",
] as const;

export type PublicInputForbiddenKey = (typeof PUBLIC_INPUT_FORBIDDEN_KEYS)[number];

/**
 * Recursive walker: collect forbidden keys found at any depth in objects/arrays.
 * Returns dotted/indexed paths for diagnostics (e.g. `nested.votes.0.xid`).
 */
export function findForbiddenPublicInputKeys(
  value: unknown,
  path: string[] = [],
): string[] {
  const hits: string[] = [];
  if (value == null) {
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(
        ...findForbiddenPublicInputKeys(item, [...path, String(index)]),
      );
    });
    return hits;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if ((PUBLIC_INPUT_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
        hits.push([...path, key].join("."));
      }
      hits.push(...findForbiddenPublicInputKeys(nested, [...path, key]));
    }
  }
  return hits;
}
