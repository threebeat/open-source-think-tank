import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Restricted audit search — never returns privatePayload. */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { searchRestrictedAudit } = await import("@/lib/audit/ledger");
  const result = await searchRestrictedAudit(
    getGatedDb(),
    gated.session.accountId,
    {
      query: url.searchParams.get("q") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "50"),
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 403 },
    );
  }

  return NextResponse.json({ events: result.value });
}
