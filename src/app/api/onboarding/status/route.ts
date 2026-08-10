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
  const { getOnboardingProgress } = await import("@/lib/onboarding/progress");
  const progress = await getOnboardingProgress(
    getGatedDb(),
    gated.session.accountId,
  );
  if (!progress) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({
    progress,
    disclaimer:
      "Account holder / community participant language only — not statutory membership.",
  });
}
