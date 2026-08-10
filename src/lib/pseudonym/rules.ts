/**
 * Operational rules for conversation-scoped pseudonyms (WP 2.10).
 * Not a counsel-approved retention schedule — see open-questions / legal gates.
 */

export const CLOSED_TEST_CONVERSATION_PURPOSE = "closed_test_consultation";

/** Default and maximum TTL for purpose-limited issuance. */
export const PSEUDONYM_TTL = {
  defaultMs: 30 * 24 * 60 * 60 * 1000,
  maxMs: 90 * 24 * 60 * 60 * 1000,
} as const;

export const PSEUDONYM_RULES = {
  issuance:
    "Opaque random identifiers only; never derived from email, account id, or reusable public identifiers.",
  mappingAccess:
    "Account↔pseudonym maps are security-restricted. Consultation providers receive only the opaque pseudonym.",
  reverseApis:
    "No public or moderator reverse-lookup API. Privileged lookup requires capability + reason + audit.",
  rotation:
    "Rotation issues a new random pseudonym, marks the prior row rotated, and audits the change.",
  deletion:
    "Deletion is soft-delete with audit; deleted pseudonym strings are never reissued.",
  export:
    "Account export (2.11) may include an account holder’s own conversation pseudonyms; never other accounts’ maps.",
  incidentAccess:
    "Incident re-identification uses privileged lookup with a non-empty reason and optional incident correlation id.",
} as const;

export function resolvePseudonymExpiry(ttlMs?: number): Date {
  const ttl = Math.min(
    Math.max(ttlMs ?? PSEUDONYM_TTL.defaultMs, 1_000),
    PSEUDONYM_TTL.maxMs,
  );
  return new Date(Date.now() + ttl);
}
