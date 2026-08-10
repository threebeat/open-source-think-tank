import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.token?.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const { getAuthService } = await import("@/lib/auth/runtime");
  const { signIn } = await import("@/lib/auth/next-auth");
  const result = await getAuthService().completeChallenge(body.token);

  if (!result.ok) {
    const status = result.code === "AUTH_RATE_LIMITED" ? 429 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  await signIn("session-token", {
    sessionToken: result.value.rawSessionToken,
    redirect: false,
  });

  return NextResponse.json({
    accountId: result.value.accountId,
    lifecycleState: result.value.lifecycleState,
    synthetic: result.value.synthetic,
    sessionId: result.value.sessionId,
  });
}
