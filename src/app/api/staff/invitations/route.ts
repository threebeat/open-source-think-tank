import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function GET() {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listIssuedInvitations } = await import("@/lib/invites/issue");
  const result = await listIssuedInvitations(
    getGatedDb(),
    gated.session.accountId,
  );
  if (!result.ok) {
    const status =
      result.code === "AUTH_REQUIRED" ||
      result.code === "AUTHZ_DENIED" ||
      result.code === "AUTHZ_ACTIVE_REQUIRED" ||
      result.code === "AUTHZ_ASSURANCE_REQUIRED" ||
      result.code === "AUTHZ_ACCOUNT_DISABLED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: { intendedContactChannel?: string; expiresInMs?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { issueParticipantInvitation } = await import("@/lib/invites/issue");
  const result = await issueParticipantInvitation(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    intendedContactChannel: body.intendedContactChannel ?? "",
    expiresInMs: body.expiresInMs,
  });

  if (!result.ok) {
    const status =
      result.code === "AUTH_REQUIRED" ||
      result.code === "AUTHZ_DENIED" ||
      result.code === "AUTHZ_ACTIVE_REQUIRED" ||
      result.code === "AUTHZ_ASSURANCE_REQUIRED" ||
      result.code === "AUTHZ_ACCOUNT_DISABLED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}
