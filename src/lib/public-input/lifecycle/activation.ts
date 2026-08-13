/**
 * Live Pol.is activation checklist (Phase 4.3).
 *
 * Engineering readiness for institutional lifecycle + fail-closed embed shell
 * does NOT authorize a live provider. Every gate below ships as `unresolved`.
 * There is no environment variable, database row, or admin toggle that can flip
 * a gate to `resolved` from inside this repository — that requires an
 * explicitly approved future package plus documented owner language equivalent to:
 * `ENABLE LIVE POLIS FOR GATED ALPHA`.
 *
 * Owner risk acceptance is never equivalent to counsel `cleared`.
 */

export type ActivationGateId =
  | "hosted_vs_self_hosted_selection"
  | "dpa_and_processing_roles"
  | "complete_subprocessors"
  | "data_residency"
  | "retention_deletion_export"
  | "breach_incident_notification"
  | "accessibility_mobile_acceptance"
  | "csp_iframe_third_party_script"
  | "permitted_services_register_addendum"
  | "counsel_terms_and_agpl_review"
  | "xid_forbidden_confirmed"
  | "remote_alpha_reset_verified"
  | "owner_enable_live_polis_authorization";

export type ActivationGateStatus = "unresolved" | "resolved";

export type ActivationGate = {
  id: ActivationGateId;
  label: string;
  status: ActivationGateStatus;
  notes: string;
};

/**
 * Exhaustive checklist from Phase 4.3 STEP 6. Keep non-empty — an empty list
 * would vacuously satisfy `.every()` and must never mean "activation complete".
 */
export const LIVE_PUBLIC_INPUT_ACTIVATION_GATES: readonly ActivationGate[] = [
  {
    id: "hosted_vs_self_hosted_selection",
    label: "Hosted versus self-hosted deployment selection",
    status: "unresolved",
    notes: "docs/public-input-provider-assessment.md — selection not authorized.",
  },
  {
    id: "dpa_and_processing_roles",
    label: "Data Processing Agreement and processing roles",
    status: "unresolved",
    notes: "No written DPA with controller/processor roles for gated alpha.",
  },
  {
    id: "complete_subprocessors",
    label: "Complete subprocessors (including report/model providers)",
    status: "unresolved",
    notes: "Hosted privacy names LLM processors; no complete schedule/DPA found.",
  },
  {
    id: "data_residency",
    label: "Data residency commitment",
    status: "unresolved",
    notes: "Residency option requires written vendor confirmation (OQ26).",
  },
  {
    id: "retention_deletion_export",
    label: "Retention, deletion, and export procedures",
    status: "unresolved",
    notes: "Alpha wipe vs remote retention mismatch remains open (OQ29).",
  },
  {
    id: "breach_incident_notification",
    label: "Breach and incident-notification terms",
    status: "unresolved",
    notes: "No contractual SLA located in public ToS review.",
  },
  {
    id: "accessibility_mobile_acceptance",
    label: "Accessibility and mobile acceptance",
    status: "unresolved",
    notes: "No WCAG conformance statement located for provider UIs.",
  },
  {
    id: "csp_iframe_third_party_script",
    label: "CSP, iframe, and third-party-script decision",
    status: "unresolved",
    notes: "OQ33 — official embed requires third-party JS; CSP frame-src unchanged.",
  },
  {
    id: "permitted_services_register_addendum",
    label: "Permitted-services register / addendum",
    status: "unresolved",
    notes: "docs/phase-2-plan.md §4 has no live Pol.is install authorization.",
  },
  {
    id: "counsel_terms_and_agpl_review",
    label: "Counsel review of applicable terms and AGPL implications",
    status: "unresolved",
    notes: "Counsel disposition not cleared; owner risk ≠ cleared.",
  },
  {
    id: "xid_forbidden_confirmed",
    label: "Confirmation that xid / stable participant identifiers will not be used",
    status: "unresolved",
    notes: "OQ28 — xid remains unsupported_forbidden until explicit approval.",
  },
  {
    id: "remote_alpha_reset_verified",
    label: "Verified handling of remote data during alpha reset",
    status: "unresolved",
    notes: "Local reset must not claim remote deletion without verified execution.",
  },
  {
    id: "owner_enable_live_polis_authorization",
    label: 'Owner authorization equivalent to "ENABLE LIVE POLIS FOR GATED ALPHA"',
    status: "unresolved",
    notes: "Starting Phase 4.3 engineering is not live-provider authorization.",
  },
] as const;

export function isLiveProviderActivationComplete(
  gates: readonly ActivationGate[] = LIVE_PUBLIC_INPUT_ACTIVATION_GATES,
): boolean {
  return gates.length > 0 && gates.every((gate) => gate.status === "resolved");
}

export function unresolvedActivationGates(
  gates: readonly ActivationGate[] = LIVE_PUBLIC_INPUT_ACTIVATION_GATES,
): ActivationGate[] {
  return gates.filter((gate) => gate.status !== "resolved");
}

export function assertLiveProviderDisabled(
  gates: readonly ActivationGate[] = LIVE_PUBLIC_INPUT_ACTIVATION_GATES,
): void {
  if (isLiveProviderActivationComplete(gates)) {
    throw new Error(
      "LIVE_PUBLIC_INPUT_ACTIVATION_UNEXPECTEDLY_COMPLETE: a live provider requires its own authorized package, not a silent gate flip.",
    );
  }
}
