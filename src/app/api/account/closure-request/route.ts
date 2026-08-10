import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { requestAccountClosure } from "@/lib/privacy/closure";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { ok: false, error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const result = await requestAccountClosure(getGatedDb(), {
    accountId: gated.session.accountId,
    actorAccountId: gated.session.accountId,
    reason: body.reason ?? "",
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true, value: result.value });
}
