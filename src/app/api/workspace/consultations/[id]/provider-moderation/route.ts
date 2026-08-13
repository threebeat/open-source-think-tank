import { NextResponse } from "next/server";

import { reportMutationStatusFor } from "@/app/api/workspace/consultations/_report-status";
import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES = new Set(["pending", "accepted", "rejected"] as const);

/**
 * POST — observational provider-side moderation record.
 * Does not execute remote provider moderation and never stores statement text.
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

  const status = String(gatedBody.body.status ?? "");
  if (!STATUSES.has(status as "pending" | "accepted" | "rejected")) {
    return NextResponse.json(
      {
        error: "status must be pending, accepted, or rejected",
        code: "PROVIDER_MODERATION_STATUS_INVALID",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const opaqueStatementRef =
    typeof gatedBody.body.opaqueStatementRef === "string"
      ? gatedBody.body.opaqueStatementRef
      : "";
  const reasonCode =
    typeof gatedBody.body.reasonCode === "string"
      ? gatedBody.body.reasonCode
      : "";

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { recordProviderModeration } = await import(
    "@/lib/public-input/moderation/service"
  );
  const result = await recordProviderModeration(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    conversationId: id,
    opaqueStatementRef,
    status: status as "pending" | "accepted" | "rejected",
    reasonCode,
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
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
