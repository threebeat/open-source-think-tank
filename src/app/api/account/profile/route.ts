import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST(request: Request) {
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

  let body: { preferredDisplayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { updatePreferredDisplayName } = await import(
    "@/lib/auth/account-profile"
  );
  const result = await updatePreferredDisplayName(
    getGatedDb(),
    gated.session.accountId,
    body.preferredDisplayName ?? "",
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
