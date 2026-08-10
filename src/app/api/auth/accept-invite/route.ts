import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: { inviteToken?: string; contactChannel?: string };
  try {
    body = (await request.json()) as {
      inviteToken?: string;
      contactChannel?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.inviteToken?.trim() || !body.contactChannel?.trim()) {
    return NextResponse.json(
      { error: "inviteToken and contactChannel are required" },
      { status: 400 },
    );
  }

  const { getAuthService } = await import("@/lib/auth/runtime");
  const result = await getAuthService().acceptInvite({
    inviteToken: body.inviteToken,
    contactChannel: body.contactChannel,
  });

  if (!result.ok) {
    const status = result.code === "AUTH_RATE_LIMITED" ? 429 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json(result.value);
}
