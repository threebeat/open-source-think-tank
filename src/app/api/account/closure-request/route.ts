import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

export const dynamic = "force-dynamic";

const EXPECTED_CLOSURE_CODES = new Set([
  "CLOSURE_REASON_REQUIRED",
  "CLOSURE_REQUEST_EXISTS",
  "CLOSURE_SELF_ONLY",
  "CLOSURE_ALREADY_CLOSED",
  "ACCOUNT_NOT_FOUND",
  "PUBLIC_DEMO_NO_CLOSURE",
  "AUTHZ_DENIED",
  "AUTHZ_ACTIVE_REQUIRED",
  "AUTHZ_ASSURANCE_REQUIRED",
  "AUTHZ_ACCOUNT_DISABLED",
  "AUTH_REQUIRED",
]);

const STABLE_PUBLIC_CLOSURE_FAILURE = {
  ok: false as const,
  error: "Could not submit the closure request. Your account was not closed.",
  code: "CLOSURE_REQUEST_FAILED",
};

function statusForClosure(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED"
  ) {
    return 403;
  }
  if (code === "CLOSURE_REQUEST_EXISTS") {
    return 409;
  }
  if (code === "ACCOUNT_NOT_FOUND") {
    return 404;
  }
  if (
    code === "CLOSURE_TX_FAILED" ||
    code === "CLOSURE_REQUEST_FAILED"
  ) {
    return 500;
  }
  return 400;
}

function toPublicClosureFailure(result: {
  ok: false;
  error: string;
  code: string;
}): { ok: false; error: string; code: string } {
  if (EXPECTED_CLOSURE_CODES.has(result.code)) {
    return { ok: false, error: result.error, code: result.code };
  }
  // Unexpected / internal failures — never echo raw exception text.
  return STABLE_PUBLIC_CLOSURE_FAILURE;
}

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { ok: false, error: gated.error, code: gated.code },
      { status: gated.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const gatedBody = await gateAuthenticatedMutation({
    request,
    accountId: gated.session.accountId,
    family: "privacy_request",
  });
  if (!gatedBody.ok) {
    return gatedBody.response;
  }

  const reason =
    typeof gatedBody.body.reason === "string" ? gatedBody.body.reason : "";

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { requestAccountClosure } = await import("@/lib/privacy/closure");
  const result = await requestAccountClosure(getGatedDb(), {
    accountId: gated.session.accountId,
    actorAccountId: gated.session.accountId,
    reason,
  });
  if (!result.ok) {
    const publicFailure = toPublicClosureFailure(result);
    return NextResponse.json(publicFailure, {
      status: statusForClosure(publicFailure.code),
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json(
    { ok: true, value: result.value },
    { headers: { "Cache-Control": "no-store" } },
  );
}
