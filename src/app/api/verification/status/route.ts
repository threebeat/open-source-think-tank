import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Account-private verification status (no artifacts, no evidence pointers). */
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
  const { listAccountVerificationStatus, describeAssuranceLadder } =
    await import("@/lib/verification/status");

  const statuses = await listAccountVerificationStatus(
    getGatedDb(),
    gated.session.accountId,
  );

  return NextResponse.json({
    statuses,
    ladder: describeAssuranceLadder(),
    disclaimer:
      "Verification status is not proof of ideology, credibility, or policy expertise.",
  });
}
