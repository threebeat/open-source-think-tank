/**
 * Operational rules for conversation-scoped pseudonyms (WP 2.10 / 2.11).
 * Not a counsel-approved retention schedule — see open-questions / legal gates.
 */

export const PSEUDONYM_PURPOSES = ["closed_test_consultation"] as const;
export type PseudonymPurpose = (typeof PSEUDONYM_PURPOSES)[number];

export const CLOSED_TEST_CONVERSATION_PURPOSE =
  "closed_test_consultation" satisfies PseudonymPurpose;

/** Default and maximum TTL for purpose-limited issuance. */
export const PSEUDONYM_TTL = {
  defaultMs: 30 * 24 * 60 * 60 * 1000,
  maxMs: 90 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Privileged incident lookup scope (explicit policy).
 * - Expired mappings: allowed (historical incident re-id).
 * - Rotated mappings: allowed (prior identifier still resolvable for incidents).
 * - Soft-deleted mappings: denied (tombstoned; not returned).
 */
export const PRIVILEGED_LOOKUP_SCOPE = {
  includeExpired: true,
  includeRotated: true,
  includeDeleted: false,
  rationale:
    "Incident responders may resolve expired or rotated identifiers with capability + reason + audit; soft-deleted mappings are not returned.",
} as const;

export const PSEUDONYM_RULES = {
  issuance:
    "Opaque random identifiers only; never derived from email, account id, or reusable public identifiers. Conversation must exist in closed_test_conversations with status=open.",
  mappingAccess:
    "Account↔pseudonym maps are security-restricted. Consultation providers receive only the opaque pseudonym.",
  reverseApis:
    "No public or moderator reverse-lookup API. Privileged lookup requires capability + reason + audit.",
  rotation:
    "Rotation issues a new random pseudonym, marks the prior row rotated, and audits the change in one transaction.",
  deletion:
    "Deletion is soft-delete with audit in one transaction; deleted pseudonym strings are never reissued.",
  export:
    "Account export (2.11) may include an account holder’s own conversation pseudonyms; never other accounts’ maps.",
  incidentAccess: PRIVILEGED_LOOKUP_SCOPE.rationale,
} as const;

export function isApprovedPseudonymPurpose(
  value: string,
): value is PseudonymPurpose {
  return (PSEUDONYM_PURPOSES as readonly string[]).includes(value);
}

export function resolvePseudonymExpiry(
  issuedAt: Date,
  ttlMs?: number,
): Date {
  const ttl = Math.min(
    Math.max(ttlMs ?? PSEUDONYM_TTL.defaultMs, 1_000),
    PSEUDONYM_TTL.maxMs,
  );
  return new Date(issuedAt.getTime() + ttl);
}
