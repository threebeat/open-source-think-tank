import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Sole production pending_onboarding → active transition. */
export async function POST() {
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
  const { activateAccount } = await import("@/lib/onboarding/activate");
  const result = await activateAccount(getGatedDb(), {
    accountId: gated.session.accountId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }

  return NextResponse.json(result.value);
}
