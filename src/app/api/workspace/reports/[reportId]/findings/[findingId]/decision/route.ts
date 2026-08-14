import { NextResponse } from "next/server";

import { reportMutationStatusFor } from "@/app/api/workspace/consultations/_report-status";
import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

type RouteContext = {
  params: Promise<{ reportId: string; findingId: string }>;
};

const ACTIONS = new Set(["include", "withhold", "supersede_finding"] as const);

/** POST — institutional finding publication decision (not provider moderation). */
export async function POST(request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  const { reportId, findingId } = await context.params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const gatedBody = await gateAuthenticatedMutation({
    request,
    accountId: gated.session.accountId,
    family: "consultation_reports",
  });
  if (!gatedBody.ok) {
    return gatedBody.response;
  }

  const action = String(gatedBody.body.action ?? "");
  if (!ACTIONS.has(action as "include" | "withhold" | "supersede_finding")) {
    return NextResponse.json(
      {
        error: "action must be include, withhold, or supersede_finding",
        code: "FINDING_DECISION_ACTION_INVALID",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const expectedConcurrencyVersion = Number(
    gatedBody.body.expectedConcurrencyVersion,
  );
  if (!Number.isInteger(expectedConcurrencyVersion)) {
    return NextResponse.json(
      {
        error: "expectedConcurrencyVersion is required",
        code: "PUBLIC_INPUT_REPORT_INPUT_INVALID",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { decideFindingPublication } = await import(
    "@/lib/public-input/moderation/service"
  );
  const result = await decideFindingPublication(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    reportId,
    findingId,
    action: action as "include" | "withhold" | "supersede_finding",
    expectedConcurrencyVersion,
    publicRationale:
      typeof gatedBody.body.publicRationale === "string"
        ? gatedBody.body.publicRationale
        : undefined,
    privateNote:
      typeof gatedBody.body.privateNote === "string"
        ? gatedBody.body.privateNote
        : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: reportMutationStatusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}
