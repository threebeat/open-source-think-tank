import { NextResponse } from "next/server";

import { reportMutationStatusFor } from "@/app/api/workspace/consultations/_report-status";
import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — list report versions for a conversation (staff). */
export async function GET(_request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { id } = await context.params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      {
        status: gated.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listStaffReportsForConversation } = await import(
    "@/lib/public-input/reports/service"
  );
  const result = await listStaffReportsForConversation(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    conversationId: id,
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

  return NextResponse.json(
    { reports: result.value },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * POST — import an aggregate-only canonical bundle.
 * Body: `{ publicTitle?: string, payload: unknown }`.
 * Never logs the request body or rejected field values.
 */
export async function POST(request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  const { id } = await context.params;
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

  const payload = gatedBody.body.payload;
  if (payload === undefined) {
    return NextResponse.json(
      {
        error: "payload is required (aggregate-only canonical bundle)",
        code: "IMPORT_PAYLOAD_REQUIRED",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const publicTitle =
    typeof gatedBody.body.publicTitle === "string"
      ? gatedBody.body.publicTitle
      : "";

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { importAggregateReport } = await import(
    "@/lib/public-input/reports/service"
  );
  const result = await importAggregateReport(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    conversationId: id,
    publicTitle,
    payload,
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
    status: result.value.isIdempotentReplay ? 200 : 201,
    headers: { "Cache-Control": "no-store" },
  });
}
