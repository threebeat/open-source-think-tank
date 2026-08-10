import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST() {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { auth, signOut } = await import("@/lib/auth/next-auth");
  const { getAuthService } = await import("@/lib/auth/runtime");
  const session = await auth();
  const sessionId = (session?.user as { sessionId?: string } | undefined)
    ?.sessionId;

  await getAuthService().signOut({ sessionId });
  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
