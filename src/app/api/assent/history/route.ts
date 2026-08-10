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
  const { listAssentHistoryWithOutcomes } = await import("@/lib/assent/status");
  const history = await listAssentHistoryWithOutcomes(
    getGatedDb(),
    gated.session.accountId,
  );

  return NextResponse.json({
    accountId: gated.session.accountId,
    history,
    download: {
      format: "application/json",
      generatedAt: new Date().toISOString(),
      history,
    },
  });
}
