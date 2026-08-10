import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Probe route: pending_onboarding must receive 403 for active-only capabilities. */
export async function POST() {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { requireActiveCapability } = await import("@/lib/auth/guard");
  const gated = await requireActiveCapability("institutional.vote");
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  return NextResponse.json({ ok: true, capability: "institutional.vote" });
}
