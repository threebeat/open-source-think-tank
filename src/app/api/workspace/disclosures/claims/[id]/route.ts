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
  if (code === "DISCLOSURE_STATE_CONFLICT") {
    return 409;
  }
  if (
    code === "DISCLOSURE_NOT_OWNED" ||
    code === "CLAIM_NOT_FOUND" ||
    code === "TOPIC_NOT_FOUND"
  ) {
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
  const { getOwnClaimDisclosure } = await import("@/lib/conflicts/disclose");
  const result = await getOwnClaimDisclosure(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId: id,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.code === "DISCLOSURE_NOT_OWNED" ? "Not Found" : result.error,
        code:
          result.code === "DISCLOSURE_NOT_OWNED" ? "NOT_FOUND" : result.code,
      },
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

export async function PATCH(request: Request, context: RouteContext) {
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
  const { upsertOwnClaimDisclosure } = await import("@/lib/conflicts/disclose");
  const { toOwnerOrReviewerConflictDisclosure } =
    await import("@/lib/conflicts/audiences");
  const result = await upsertOwnClaimDisclosure(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId: id,
    disclosureChoice:
      body.disclosureChoice === "disclose" ? "disclose" : "none",
    publicSummary:
      typeof body.publicSummary === "string" ? body.publicSummary : undefined,
    privateDetail:
      body.privateDetail == null ? null : String(body.privateDetail),
    expectedUpdatedAt:
      typeof body.expectedUpdatedAt === "string"
        ? body.expectedUpdatedAt
        : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.code === "DISCLOSURE_NOT_OWNED" ? "Not Found" : result.error,
        code:
          result.code === "DISCLOSURE_NOT_OWNED" ? "NOT_FOUND" : result.code,
      },
      {
        status: statusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      created: result.value.created,
      disclosure: toOwnerOrReviewerConflictDisclosure(result.value.disclosure),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
