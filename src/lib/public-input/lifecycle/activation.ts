/**
 * Live Pol.is activation checklist (Phase 4.3 domain layer).
 *
 * This is a documentation-as-code gate list, not a live control panel: every
 * gate is hard-coded `"unresolved"` in this package. There is no environment
 * variable, database row, or admin toggle that can flip a gate to `"resolved"`
 * from inside this repository — doing so requires its own explicitly-approved
 * future package (permitted-services register addendum + owner authorization;
 * see docs/phase-4-plan.md §4, ADR 0012). `embed-url.ts` and the lifecycle
 * service consult {@link isLiveProviderActivationComplete}, which can only
 * ever return `false` while any gate below is unresolved.
 */

export type ActivationGateId =
  | "permitted_services_register_addendum"
  | "vendor_agreement_signed"
  | "data_processing_addendum_signed"
  | "privacy_review_completed"
  | "counsel_disposition_cleared"
  | "credentials_provisioned_out_of_band"
  | "owner_written_authorization";

export type ActivationGateStatus = "unresolved" | "resolved";

export type ActivationGate = {
  id: ActivationGateId;
  label: string;
  status: ActivationGateStatus;
  notes: string;
};

/**
 * Every gate starts (and, absent a new authorized package, stays) unresolved.
 * Keep this list exhaustive — an empty list would vacuously satisfy
 * `.every()` and must never be treated as "activation complete".
 */
export const LIVE_PUBLIC_INPUT_ACTIVATION_GATES: readonly ActivationGate[] = [
  {
    id: "permitted_services_register_addendum",
    label: "Permitted-services register addendum for live Pol.is",
    status: "unresolved",
    notes: "docs/phase-2-plan.md §4 has no live-provider entry yet.",
  },
  {
    id: "vendor_agreement_signed",
    label: "Vendor agreement / terms of service executed",
    status: "unresolved",
    notes: "No hosted or self-hosted Pol.is vendor relationship exists.",
  },
  {
    id: "data_processing_addendum_signed",
    label: "Data processing addendum (DPA) signed",
    status: "unresolved",
    notes: "Required before any real participant opinion data reaches a provider.",
  },
  {
    id: "privacy_review_completed",
    label: "Privacy review of small-cell suppression and retention",
    status: "unresolved",
    notes: "docs/phase-4-plan.md §7 privacy contract remains a design doc only.",
  },
  {
    id: "counsel_disposition_cleared",
    label: "Counsel disposition cleared",
    status: "unresolved",
    notes: "See docs/phase-2-plan.md §7 counsel gates; none recorded for live Pol.is.",
  },
  {
    id: "credentials_provisioned_out_of_band",
    label: "Provider credentials provisioned out-of-band (never via env var here)",
    status: "unresolved",
    notes: "No credential or env var for a live provider exists in this repository.",
  },
  {
    id: "owner_written_authorization",
    label: "Owner written authorization to enable a live embed",
    status: "unresolved",
    notes: "docs/phase-4-plan.md §12 stop condition: owner approval required before 4.3 live install.",
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

/**
 * Throws if activation is ever (unexpectedly) complete — a canary a future
 * package must explicitly remove, never silently satisfy.
 */
export function assertLiveProviderDisabled(
  gates: readonly ActivationGate[] = LIVE_PUBLIC_INPUT_ACTIVATION_GATES,
): void {
  if (isLiveProviderActivationComplete(gates)) {
    throw new Error(
      "LIVE_PUBLIC_INPUT_ACTIVATION_UNEXPECTEDLY_COMPLETE: a live provider requires its own authorized package, not a silent gate flip.",
    );
  }
}
