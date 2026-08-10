/**
 * Provisional retention / closure rules for WP 2.11.
 * Not counsel-cleared legal retention schedules (LQ10–11 remain blocking).
 */

export const RETENTION_RULES = {
  status: "provisional_engineering",
  counselGate: "political_opinion_verification / LQ10–11 still blocking",
  closure:
    "Closure revokes sessions and sets lifecycle=closed. Assent records and audit events are retained. No silent destruction of institutional history.",
  deletionRequest:
    "Deletion requests are workflow records. Destructive anonymization of real accounts is blocked while counsel gates remain blocking; synthetic fixtures may advance to anonymization-pending for drills.",
  export:
    "Exports include only the requesting account holder’s rows (profile, assent metadata, own verification case metadata, own pseudonyms). Never other accounts’ maps or private audit payloads.",
  legalHold:
    "Active legal holds block closure execution and retention purges for the held subject. Holds are staff-restricted and never public.",
  jobs:
    "Expiration jobs are configurable via retention_policy_settings and marked provisional until counsel clears retention.",
} as const;
