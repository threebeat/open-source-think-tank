/** Shared HTTP status mapping for Public Input report / moderation mutations. */
export function reportMutationStatusFor(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED" ||
    // Production small-cell suppression has not cleared privacy review — an
    // explicit operator approval gate, not a workflow-state conflict (4.5A.1).
    code === "PUBLIC_INPUT_REPORT_PRODUCTION_PRIVACY_UNAPPROVED"
  ) {
    return 403;
  }
  if (
    code === "PUBLIC_INPUT_REPORT_STATE_CONFLICT" ||
    code === "CONSULTATION_VERSION_CONFLICT" ||
    // Workflow-shape conflicts — the request is well-formed and authorized
    // but the report is not in a state that allows it right now (4.5A.1).
    code === "PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW" ||
    code === "PUBLIC_INPUT_REPORT_REQUIRES_REIMPORT"
  ) {
    return 409;
  }
  if (
    code === "CONSULTATION_NOT_FOUND" ||
    code === "PUBLIC_INPUT_REPORT_NOT_FOUND" ||
    code === "PUBLIC_INPUT_FINDING_NOT_FOUND"
  ) {
    return 404;
  }
  if (code === "PAYLOAD_TOO_LARGE") {
    return 413;
  }
  return 400;
}
