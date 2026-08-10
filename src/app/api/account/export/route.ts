import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { exportOwnAccountData } from "@/lib/privacy/export";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const result = await exportOwnAccountData(getGatedDb(), gated.session.accountId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json({ ok: true, value: result.value });
}
