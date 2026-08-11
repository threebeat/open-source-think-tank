/**
 * Retention / closure rules for WP 2.11.
 * Alpha-test interim council clearance (ADR 0007): postures may run to prove
 * efficacy; alpha-test data must remain fully resettable (no user/topic carry-over).
 */

export const RETENTION_RULES = {
  status: "alpha_test_efficacy",
  counselGate:
    "data_map_retention / political_opinion_verification cleared for alpha-test scopes (ADR 0007); must reset alpha-test data after the test",
  closure:
    "Closure revokes sessions and sets lifecycle=closed. Assent records and audit events are retained during the alpha test. Alpha-test users and topic discussion must not carry over after the test.",
  deletionRequest:
    "Deletion requests are workflow records. Alpha-test environments must support full reset; synthetic fixtures may advance to anonymization-pending for drills.",
  export:
    "Exports include only the requesting account holder’s rows (profile, assent metadata, own verification case metadata, own pseudonyms). Never other accounts’ maps or private audit payloads.",
  legalHold:
    "Active legal holds block closure execution and retention purges for the held subject. Holds are staff-restricted and never public.",
  jobs:
    "Expiration jobs are configurable via retention_policy_settings and may run in alpha-test to prove efficacy under the resettable-data requirement.",
} as const;
