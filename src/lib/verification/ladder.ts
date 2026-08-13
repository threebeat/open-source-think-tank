import type { Capability } from "@/lib/authz/types";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";

/**
 * Configurable assurance ladder (WP 2.7).
 *
 * Levels do **not** assume government ID. `legal_identity` is optional and only
 * mapped where a documented higher-impact action requires it. Eligibility /
 * residency / legal-identity production claims remain counsel-gated
 * (phase-2-plan §7; LQ10–14).
 *
 * This ladder is not proof of ideology, credibility, or policy expertise.
 */
export const ASSURANCE_LEVELS = {
  L0_none: {
    id: "L0_none",
    rank: 0,
    label: "No assurance",
    requiredKinds: [] as VerificationAssertionKind[],
  },
  L1_bot_resistance: {
    id: "L1_bot_resistance",
    rank: 1,
    label: "Bot resistance",
    requiredKinds: ["bot_resistance"] as VerificationAssertionKind[],
  },
  L2_contact_continuity: {
    id: "L2_contact_continuity",
    rank: 2,
    label: "Contact continuity",
    requiredKinds: [
      "bot_resistance",
      "contact_continuity",
    ] as VerificationAssertionKind[],
  },
  L3_uniqueness: {
    id: "L3_uniqueness",
    rank: 3,
    label: "Uniqueness",
    requiredKinds: [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
    ] as VerificationAssertionKind[],
  },
  L4_eligibility: {
    id: "L4_eligibility",
    rank: 4,
    label: "Eligibility",
    requiredKinds: [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
    ] as VerificationAssertionKind[],
  },
  L5_residency: {
    id: "L5_residency",
    rank: 5,
    label: "Residency",
    requiredKinds: [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
      "residency",
    ] as VerificationAssertionKind[],
  },
  L6_legal_identity: {
    id: "L6_legal_identity",
    rank: 6,
    label: "Legal identity (optional higher-impact)",
    requiredKinds: [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
      "residency",
      "legal_identity",
    ] as VerificationAssertionKind[],
  },
} as const;

export type AssuranceLevelId = keyof typeof ASSURANCE_LEVELS;

/** Minimum data collected for each distinct assertion kind (no ideology fields). */
export const ASSERTION_MINIMUM_DATA: Record<
  VerificationAssertionKind,
  { fields: string[]; storesRawArtifact: boolean; notes: string }
> = {
  bot_resistance: {
    fields: ["challenge_completion_at", "challenge_method"],
    storesRawArtifact: false,
    notes: "Challenge outcome only; no behavioral ideology signals.",
  },
  contact_continuity: {
    fields: ["contact_channel_verified_at"],
    storesRawArtifact: false,
    notes: "Verified channel ownership timestamp; not a public identifier.",
  },
  uniqueness: {
    fields: ["uniqueness_attestation_summary"],
    storesRawArtifact: false,
    notes: "Status summary only; no biometric store in Phase 2.",
  },
  eligibility: {
    fields: ["eligibility_assertion_summary"],
    storesRawArtifact: false,
    notes:
      "Configurable; no national-mandate claim until counsel clears LQ12–14.",
  },
  residency: {
    fields: ["residency_assertion_summary"],
    storesRawArtifact: false,
    notes: "Optional higher step; counsel-gated geography rules.",
  },
  legal_identity: {
    fields: ["legal_identity_assertion_summary"],
    storesRawArtifact: false,
    notes:
      "Optional; government ID is not assumed. Raw documents use short-lived holds only.",
  },
};

/**
 * Protected capabilities → minimum assurance. Higher assurance only for
 * documented higher-impact actions. Participant voting does not require
 * legal_identity by default.
 */
export const CAPABILITY_ASSURANCE: Partial<
  Record<Capability, AssuranceLevelId>
> = {
  "institutional.vote": "L3_uniqueness",
  "institutional.council_deliberation": "L4_eligibility",
  "institutional.council_policy": "L4_eligibility",
  "institutional.publish_decision": "L4_eligibility",
  "documents.publish": "L3_uniqueness",
  "roles.grant_platform": "L3_uniqueness",
  "roles.revoke_platform": "L3_uniqueness",
  "roles.grant_council": "L3_uniqueness",
  "roles.revoke_council": "L3_uniqueness",
  "verification.review_case": "L2_contact_continuity",
  "onboarding.staff_read": "L2_contact_continuity",
  "moderation.act": "L3_uniqueness",
  "audit.read_restricted": "L2_contact_continuity",
  "pseudonym.privileged_lookup": "L3_uniqueness",
  "privacy.manage_legal_hold": "L3_uniqueness",
  "privacy.execute_closure": "L3_uniqueness",
  "privacy.dual_control_request": "L3_uniqueness",
  "privacy.dual_control_approve": "L3_uniqueness",
  // Phase 3.3 institutional mutations — L3 uniqueness (no legal_identity default)
  "topics.create": "L3_uniqueness",
  "topics.update": "L3_uniqueness",
  "topics.open": "L3_uniqueness",
  "topics.publish": "L3_uniqueness",
  "topics.pause": "L3_uniqueness",
  "topics.archive": "L3_uniqueness",
  "claims.submit": "L3_uniqueness",
  "claims.edit_own": "L3_uniqueness",
  "claims.withdraw_own": "L3_uniqueness",
  "claims.review": "L3_uniqueness",
  "evidence.submit": "L3_uniqueness",
  "evidence.edit_own": "L3_uniqueness",
  "evidence.withdraw_own": "L3_uniqueness",
  "evidence.review": "L3_uniqueness",
  "conflicts.disclose_own": "L3_uniqueness",
  "moderation.review_submission": "L3_uniqueness",
  "workspace.search": "L3_uniqueness",
  "topics.export_staff": "L3_uniqueness",
  "invites.issue": "L3_uniqueness",
  // Phase 4.3 — Public Input conversation lifecycle: administrator-only
  // institutional mutations, same default as topics.* above.
  "consultations.create": "L3_uniqueness",
  "consultations.transition": "L3_uniqueness",
  "consultations.manage_provider_mapping": "L3_uniqueness",
  "consultations.set_availability": "L3_uniqueness",
};

export function assuranceForCapability(
  capability: Capability,
): (typeof ASSURANCE_LEVELS)[AssuranceLevelId] {
  const id = CAPABILITY_ASSURANCE[capability] ?? "L0_none";
  return ASSURANCE_LEVELS[id];
}

/** Strip verification fields from any object before public consultation output. */
const PUBLIC_STRIP_KEYS = [
  "verification",
  "verificationStatus",
  "verificationArtifacts",
  "assuranceLevel",
  "evidencePointer",
] as const;

export function toPublicConsultationSafeProjection<T extends Record<string, unknown>>(
  input: T,
): Omit<
  T,
  | "verification"
  | "verificationStatus"
  | "verificationArtifacts"
  | "assuranceLevel"
  | "evidencePointer"
> {
  const rest = { ...input };
  for (const key of PUBLIC_STRIP_KEYS) {
    delete rest[key];
  }
  return rest;
}
