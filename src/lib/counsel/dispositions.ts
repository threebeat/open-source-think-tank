/**
 * Server-readable counsel disposition configuration (phase-2-plan §7).
 *
 * Status vocabulary matches the plan. Owner risk acceptance must never appear
 * here as `cleared`. Updates require provenance in docs/phase-2-plan.md §7.
 *
 * Review packet: docs/counsel-review-packet-2.12.md (issued 2026-08-10).
 * Dispositions remain blocking until counsel returns recorded outcomes.
 */

export type CounselDispositionStatus =
  | "blocking"
  | "conditionally_cleared"
  | "cleared";

export type CounselDisposition = {
  id: string;
  status: CounselDispositionStatus;
  /** Human-readable scope; not a product claim that the matter is settled. */
  scope: string;
  recordedDate: string;
  recordedBy: string;
  counselSource: string;
  projectOwnerApproval: string;
  affectedPackages: string[];
};

/**
 * Applicable gates that must be cleared/conditionally cleared before a
 * **real** (non-synthetic) account may become `active`.
 */
export const ACTIVATION_COUNSEL_GATE_IDS = [
  "electronic_assent",
  "eligibility_geography",
  "statutory_membership",
  "political_opinion_verification",
] as const;

export type ActivationCounselGateId =
  (typeof ACTIVATION_COUNSEL_GATE_IDS)[number];

/**
 * Gates that must be cleared/conditionally cleared before the Phase 2
 * foundation readiness tag (in addition to gated E2E green).
 */
export const READINESS_COUNSEL_GATE_IDS = [
  "data_map_retention",
  "electronic_assent",
  "statutory_membership",
  "eligibility_geography",
  "account_council_authority",
  "political_opinion_verification",
  "formation_fiscal",
] as const;

export type ReadinessCounselGateId =
  (typeof READINESS_COUNSEL_GATE_IDS)[number];

const PACKET =
  "docs/counsel-review-packet-2.12.md — issued 2026-08-10; awaiting counsel disposition return";

export const COUNSEL_DISPOSITIONS: Record<string, CounselDisposition> = {
  data_map_retention: {
    id: "data_map_retention",
    status: "blocking",
    scope:
      "Full gate; data map and retention postures are planning aids only until counsel disposition — not a privacy policy or legal retention schedule",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.11", "2.12"],
  },
  statutory_membership: {
    id: "statutory_membership",
    status: "blocking",
    scope:
      "Full gate; no product claim of statutory membership — use account holder / community participant",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.1", "2.4", "2.5", "2.8", "2.12"],
  },
  electronic_assent: {
    id: "electronic_assent",
    status: "blocking",
    scope:
      "Full gate; no “not legally reviewed” doc may become active assent for real accounts",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.6", "2.8", "2.12"],
  },
  eligibility_geography: {
    id: "eligibility_geography",
    status: "blocking",
    scope: "Full gate; no national-mandate or settled residency rule",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.7", "2.8", "2.12"],
  },
  political_opinion_verification: {
    id: "political_opinion_verification",
    status: "blocking",
    scope:
      "Full gate; keep identity store separated from opinion/pseudonym maps; no live consultation participation in Phase 2",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.7", "2.9", "2.10", "2.11", "2.12"],
  },
  account_council_authority: {
    id: "account_council_authority",
    status: "blocking",
    scope: "Full gate; recommendations only; no board-binding claims",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.5", "2.8", "2.9", "2.12"],
  },
  formation_fiscal: {
    id: "formation_fiscal",
    status: "blocking",
    scope: "Full gate; no entity/tax claims",
    recordedDate: "2026-08-10",
    recordedBy: "Phase 2 readiness engineering",
    counselSource: PACKET,
    projectOwnerApproval: "n/a",
    affectedPackages: ["2.1", "2.2", "2.12"],
  },
};

export function getCounselDisposition(id: string): CounselDisposition | null {
  return COUNSEL_DISPOSITIONS[id] ?? null;
}

function gateAllows(status: CounselDispositionStatus | undefined): boolean {
  return status === "cleared" || status === "conditionally_cleared";
}

/** True only when every activation-applicable gate is cleared or conditionally cleared. */
export function activationCounselAllowsRealAccounts(): boolean {
  return ACTIVATION_COUNSEL_GATE_IDS.every((id) =>
    gateAllows(COUNSEL_DISPOSITIONS[id]?.status),
  );
}

export function blockingActivationCounselGates(): CounselDisposition[] {
  return ACTIVATION_COUNSEL_GATE_IDS.map((id) => COUNSEL_DISPOSITIONS[id]!).filter(
    (row) => row.status === "blocking",
  );
}

/** True only when readiness counsel gates allow a foundation tag (E2E separate). */
export function readinessCounselAllowsFoundationTag(): boolean {
  return READINESS_COUNSEL_GATE_IDS.every((id) =>
    gateAllows(COUNSEL_DISPOSITIONS[id]?.status),
  );
}

export function blockingReadinessCounselGates(): CounselDisposition[] {
  return READINESS_COUNSEL_GATE_IDS.map((id) => COUNSEL_DISPOSITIONS[id]!).filter(
    (row) => row.status === "blocking",
  );
}
