import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST() {
  if (resolveAppMode() !== "gated") {
    const { clearPreAlphaSessionCookie } = await import(
      "@/lib/auth/pre-alpha-cookies"
    );
    return clearPreAlphaSessionCookie(NextResponse.json({ ok: true }));
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
