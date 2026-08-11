/**
 * Server-readable counsel disposition configuration (phase-2-plan §7).
 *
 * Status vocabulary matches the plan. Owner risk acceptance must never appear
 * here as `cleared` without an interim-council / counsel public summary.
 * Updates require provenance in docs/phase-2-plan.md §7.
 *
 * Review packet: docs/counsel-review-packet-2.12.md (issued 2026-08-10).
 * Alpha-test interim council return: docs/decisions/0007-alpha-test-interim-council-dispositions.md
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

const INTERIM_COUNCIL =
  "docs/decisions/0007-alpha-test-interim-council-dispositions.md — public summary of interim council return to counsel-review-packet-2.12.md (2026-08-10)";

const RECORDED_BY =
  "Interim council (project owner acting as council until alpha test)";

const OWNER_APPROVAL =
  "Project owner / 2026-08-10 (sole builder until alpha test; same actor as interim council)";

export const COUNSEL_DISPOSITIONS: Record<string, CounselDisposition> = {
  data_map_retention: {
    id: "data_map_retention",
    status: "cleared",
    scope:
      "Alpha-test foundation: proposed retention postures may run to prove efficacy; project must be able to reset all included alpha-test data — no users or topic discussion carry over after the test. Not a permanent post-alpha privacy schedule.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.11", "2.12"],
  },
  statutory_membership: {
    id: "statutory_membership",
    status: "cleared",
    scope:
      "Alpha-test foundation: “member” may appear if test purpose is communicated clearly at assent and continually during the test; preferred synonym is “delegate”. Does not settle permanent statutory membership.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.1", "2.4", "2.5", "2.8", "2.12"],
  },
  electronic_assent: {
    id: "electronic_assent",
    status: "cleared",
    scope:
      "Alpha-test foundation: keep current electronic assent; bot/activity metrics and engineering discretion may inform later authentication strategy. Not a permanent post-alpha legal assent determination.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.6", "2.8", "2.12"],
  },
  eligibility_geography: {
    id: "eligibility_geography",
    status: "cleared",
    scope:
      "Alpha-test foundation: implement no geographical eligibility requirements until the test ends; keep eligibility open for travel/demo; use the test to learn later eligibility design.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.7", "2.8", "2.12"],
  },
  political_opinion_verification: {
    id: "political_opinion_verification",
    status: "cleared",
    scope:
      "Alpha-test foundation: existing separation of identity/verification from opinion/pseudonym maps is adequate for now; no further action required before the test ends.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.7", "2.9", "2.10", "2.11", "2.12"],
  },
  account_council_authority: {
    id: "account_council_authority",
    status: "cleared",
    scope:
      "Alpha-test foundation: continual communication of test purpose/authority limits is sufficient; no additional authority steps until after the alpha test. Formal council/board forms during the test.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
    affectedPackages: ["2.5", "2.8", "2.9", "2.12"],
  },
  formation_fiscal: {
    id: "formation_fiscal",
    status: "cleared",
    scope:
      "Alpha-test foundation: existing proposed-project / not-incorporated framing is adequate for now; no entity/tax claims beyond that framing.",
    recordedDate: "2026-08-10",
    recordedBy: RECORDED_BY,
    counselSource: INTERIM_COUNCIL,
    projectOwnerApproval: OWNER_APPROVAL,
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
