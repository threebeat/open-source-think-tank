import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Allowlisted public audit projections only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");

  if (resolveAppMode() === "gated") {
    const { getGatedDb } = await import("@/lib/auth/runtime");
    const { listPublicAuditFeed } = await import("@/lib/audit/ledger");
    const events = await listPublicAuditFeed(getGatedDb(), limit);
    return NextResponse.json({ events });
  }

  // Public-demo: fixture-backed transparency remains on /transparency.
  return NextResponse.json({ events: [] });
}
