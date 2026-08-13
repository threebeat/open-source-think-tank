import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";
import { setProviderAvailabilityInputSchema } from "@/lib/public-input/lifecycle/service";

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
  if (code === "CONSULTATION_VERSION_CONFLICT") {
    return 409;
  }
  if (code === "CONSULTATION_NOT_FOUND") {
    return 404;
  }
  return 400;
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
      { status: gated.status },
    );
  }

  const gatedBody = await gateAuthenticatedMutation({
    request,
    accountId: gated.session.accountId,
    family: "consultation_lifecycle",
  });
  if (!gatedBody.ok) {
    return gatedBody.response;
  }

  const parsed = setProviderAvailabilityInputSchema.safeParse(gatedBody.body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid availability body",
        code: "CONSULTATION_INPUT_INVALID",
      },
      { status: 400 },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { setProviderAvailability } = await import(
    "@/lib/public-input/lifecycle/service"
  );
  const result = await setProviderAvailability(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    conversationId: id,
    expectedVersion: parsed.data.expectedVersion,
    availability: parsed.data.availability,
    reason: parsed.data.reason,
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
