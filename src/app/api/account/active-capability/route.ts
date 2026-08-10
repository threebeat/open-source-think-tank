import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Probe route: pending_onboarding must receive 403 for active-only capabilities. */
export async function POST() {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { requireCapability } = await import("@/lib/authz/server");
  const decision = await requireCapability("institutional.vote");
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, code: decision.code },
      { status: decision.status },
    );
  }

  return NextResponse.json({ ok: true, capability: "institutional.vote" });
}
