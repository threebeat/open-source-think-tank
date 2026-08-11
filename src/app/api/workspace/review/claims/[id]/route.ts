import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";

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
  if (code === "CLAIM_STATE_CONFLICT" || code === "CLAIM_REVIEW_SOURCE_STATE") {
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
  const { getClaimReviewDetail } = await import("@/lib/review/queues");
  const result = await getClaimReviewDetail(getGatedDb(), {
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
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
  const { reviewClaim } = await import("@/lib/claims/review");
  const result = await reviewClaim(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId: id,
    decision: String(body.decision ?? "") as
      | "changes_requested"
      | "accepted"
      | "rejected",
    publicRationale: String(body.publicRationale ?? ""),
    privateNotes:
      body.privateNotes == null ? null : String(body.privateNotes),
    expectedWorkflowState: "submitted",
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
