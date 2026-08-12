import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

type RouteContext = { params: Promise<{ id: string }> };

function statusFor(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED"
  ) {
    return 403;
  }
  if (code === "MODERATION_STATE_CONFLICT") {
    return 409;
  }
  if (code === "CLAIM_NOT_FOUND" || code === "TOPIC_NOT_FOUND") {
    return 404;
  }
  return 400;
}

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
  const { getClaimModerationDetail } = await import("@/lib/moderation/queues");
  const result = await getClaimModerationDetail(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId: id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: statusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}

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
      {
        status: gated.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const gatedBody = await gateAuthenticatedMutation({
    request,
    accountId: gated.session.accountId,
    family: "moderation_action",
  });
  if (!gatedBody.ok) {
    return gatedBody.response;
  }
  const body = gatedBody.body;

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { moderateClaim } = await import("@/lib/moderation/service");
  const result = await moderateClaim(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId: id,
    action: String(body.action ?? "") as "hold" | "hide" | "restore",
    publicRationale: String(body.publicRationale ?? ""),
    privateNotes: body.privateNotes == null ? null : String(body.privateNotes),
    expectedVisibility: String(body.expectedVisibility ?? "") as
      "visible" | "held" | "hidden",
    expectedUpdatedAt: String(body.expectedUpdatedAt ?? ""),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: statusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      claimId: result.value.claim.id,
      moderationVisibility: result.value.claim.moderationVisibility,
      updatedAt: result.value.claim.updatedAt.toISOString(),
      actionId: result.value.action.id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
