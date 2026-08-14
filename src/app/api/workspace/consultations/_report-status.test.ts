import { describe, expect, it } from "vitest";

import { reportMutationStatusFor } from "@/app/api/workspace/consultations/_report-status";

describe("reportMutationStatusFor (4.5A.1)", () => {
  it("maps the production small-cell privacy gate to 403 (operator approval, not a workflow conflict)", () => {
    expect(
      reportMutationStatusFor(
        "PUBLIC_INPUT_REPORT_PRODUCTION_PRIVACY_UNAPPROVED",
      ),
    ).toBe(403);
  });

  it("maps workflow-shape conflicts to 409", () => {
    expect(
      reportMutationStatusFor("PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW"),
    ).toBe(409);
    expect(
      reportMutationStatusFor("PUBLIC_INPUT_REPORT_REQUIRES_REIMPORT"),
    ).toBe(409);
    expect(reportMutationStatusFor("PUBLIC_INPUT_REPORT_STATE_CONFLICT")).toBe(
      409,
    );
    expect(reportMutationStatusFor("CONSULTATION_VERSION_CONFLICT")).toBe(
      409,
    );
  });

  it("still maps existing authz/not-found/payload codes as before", () => {
    expect(reportMutationStatusFor("AUTHZ_DENIED")).toBe(403);
    expect(reportMutationStatusFor("AUTH_REQUIRED")).toBe(403);
    expect(reportMutationStatusFor("CONSULTATION_NOT_FOUND")).toBe(404);
    expect(reportMutationStatusFor("PUBLIC_INPUT_REPORT_NOT_FOUND")).toBe(404);
    expect(reportMutationStatusFor("PUBLIC_INPUT_FINDING_NOT_FOUND")).toBe(
      404,
    );
    expect(reportMutationStatusFor("PAYLOAD_TOO_LARGE")).toBe(413);
  });

  it("defaults unknown codes to 400", () => {
    expect(reportMutationStatusFor("SOMETHING_UNMAPPED")).toBe(400);
  });
});
