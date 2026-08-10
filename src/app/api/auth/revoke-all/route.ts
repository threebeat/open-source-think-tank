import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

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

  const { getAuthService } = await import("@/lib/auth/runtime");
  const { signOut } = await import("@/lib/auth/next-auth");
  await getAuthService().revokeAllSessions(gated.session.accountId);
  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
