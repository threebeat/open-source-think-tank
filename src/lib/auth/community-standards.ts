/**
 * Versioned community-standards text presented at open enrollment.
 * Engineering placeholder derived from docs/v2/community-standards.md joining
 * commitments. Not counsel-cleared production terms (V2-02).
 */

export const COMMUNITY_STANDARDS_DOCUMENT_ID =
  "doc-ostt-ops-community-standards-v1";
export const COMMUNITY_STANDARDS_VERSION_LABEL = "v1-prealpha";
export const COMMUNITY_STANDARDS_NOTICE_ID = "community-standards-v1-prealpha";

export const COMMUNITY_STANDARDS_TITLE =
  "Commonhall community standards (pre-alpha)";

export const COMMUNITY_STANDARDS_BODY = [
  "By creating a Commonhall community account you agree to these behavioral and procedural commitments.",
  "This is organization community membership in a pre-alpha synthetic hall — not nonprofit membership, statutory membership, or government standing.",
  "You will not make credible threats, incite violence, or engage in targeted harassment, stalking, or intimidation.",
  "You will not dox or expose private, sensitive, or security-relevant information.",
  "You will not direct hate or dehumanization at a person or group based on protected or analogous characteristics.",
  "You will not engage in sexual harassment or share non-consensual sexual content.",
  "You will not impersonate others, commit fraud, coordinate inauthentic participation, manipulate votes, or evade an active restriction.",
  "You will not spam, distribute malware, collect credentials, or interfere destructively with the service.",
  "You will not post unlawful content the service is required to remove, or repeatedly disrupt others after clear notice.",
  "Disagreement, criticism of institutions or ideologies, and good-faith challenges to norms are not violations merely because they cause discomfort.",
  "Moderators judge conduct, safety, completeness, and published criteria — not viewpoint, ideology, popularity, or personal agreement.",
  "This text is a pre-alpha engineering placeholder and is not counsel-approved legal language.",
].join(" ");

export const PRE_ALPHA_ASSIGNMENT_REASON =
  "pre-alpha synthetic primary organization (V2-04)";
export const PRE_ALPHA_ASSIGNMENT_RULE_VERSION = "v2-prealpha-assignment-2026-08";
export const PRE_ALPHA_ASSIGNMENT_EXPLANATION = [
  "You are assigned to Synthetic Alpha Hall because this pre-alpha Commonhall uses one seeded synthetic primary organization.",
  "This is not a production matching algorithm and does not use ideology, consultation responses, or hidden behavioral profiles.",
  "You may request a correction or appeal of this assignment from your Account → Membership page. Transfer to another organization is not available in this phase.",
].join(" ");

/** Minimum time the enrollment form must be open before submit (V2-23). */
export const ENROLLMENT_MIN_FILL_MS = 1_500;
