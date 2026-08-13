import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";
import { createConversationInputSchema } from "@/lib/public-input/lifecycle/service";

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
  if (
    code === "TOPIC_ALREADY_HAS_CURRENT_CONVERSATION" ||
    code === "CONSULTATION_VERSION_CONFLICT"
  ) {
    return 409;
  }
  if (code === "TOPIC_NOT_FOUND" || code === "CONSULTATION_NOT_FOUND") {
    return 404;
  }
  return 400;
}

/** POST — create a current Public Input conversation for a topic (admin). */
export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
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

  const parsed = createConversationInputSchema.safeParse(gatedBody.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid consultation create body", code: "CONSULTATION_INPUT_INVALID" },
      { status: 400 },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { createConversation } = await import(
    "@/lib/public-input/lifecycle/service"
  );
  const result = await createConversation(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    ...parsed.data,
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
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
