import type { VerificationAssertionKind } from "@/lib/adapters/verification";

/**
 * Production-neutral assertion-kind sets for the assurance ladder.
 * Not a seed/test helper — operational services (onboarding, bootstrap, authz)
 * import from here. Synthetic seeding stays in `seed-assurance.ts`.
 */

/** Kinds required for L2 (reviewer / auditor floor). */
export const L2_KINDS: VerificationAssertionKind[] = [
  "bot_resistance",
  "contact_continuity",
];

/** Kinds required for L3 (vote / publish / role changes). */
export const L3_KINDS: VerificationAssertionKind[] = [
  ...L2_KINDS,
  "uniqueness",
];

/** Kinds required for L4 (council). */
export const L4_KINDS: VerificationAssertionKind[] = [
  ...L3_KINDS,
  "eligibility",
];
