import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/** Staff-restricted redacted onboarding + invitation queues. */
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
  const { listStaffInvitations, listStaffOnboardingStatuses } = await import(
    "@/lib/onboarding/staff"
  );
  const db = getGatedDb();
  const [onboarding, invitations] = await Promise.all([
    listStaffOnboardingStatuses(db, gated.session.accountId),
    listStaffInvitations(db, gated.session.accountId),
  ]);

  if (!onboarding.ok) {
    return NextResponse.json(
      { error: onboarding.error, code: onboarding.code },
      { status: 403 },
    );
  }
  if (!invitations.ok) {
    return NextResponse.json(
      { error: invitations.error, code: invitations.code },
      { status: 403 },
    );
  }

  return NextResponse.json({
    onboarding: onboarding.value,
    invitations: invitations.value,
  });
}
