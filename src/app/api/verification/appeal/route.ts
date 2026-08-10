import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Account-scoped appeal — case must belong to the session account. */
export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: { caseId?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.caseId?.trim() || !body.reason?.trim()) {
    return NextResponse.json(
      { error: "caseId and reason are required" },
      { status: 400 },
    );
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
  const { appealCase } = await import("@/lib/verification/cases");
  const result = await appealCase(getGatedDb(), {
    caseId: body.caseId,
    accountId: gated.session.accountId,
    reason: body.reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
