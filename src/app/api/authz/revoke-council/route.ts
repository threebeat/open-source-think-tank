import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { COUNCIL_ROLES, type CouncilRole } from "@/lib/authz/types";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: {
    subjectAccountId?: string;
    councilRole?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.subjectAccountId?.trim() ||
    !body.councilRole ||
    !COUNCIL_ROLES.includes(body.councilRole as CouncilRole) ||
    !body.reason?.trim()
  ) {
    return NextResponse.json(
      { error: "subjectAccountId, councilRole, and reason are required" },
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
  const { revokeCouncilSeat } = await import("@/lib/authz/role-changes");
  const result = await revokeCouncilSeat(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    subjectAccountId: body.subjectAccountId,
    councilRole: body.councilRole as CouncilRole,
    reason: body.reason,
  });

  if (!result.ok) {
    const status =
      result.code === "AUTHZ_SELF_CONTINUITY_FORBIDDEN" ||
      result.code === "AUTH_REQUIRED" ||
      result.code === "AUTHZ_DENIED" ||
      result.code === "AUTHZ_ACTIVE_REQUIRED" ||
      result.code === "AUTHZ_ACCOUNT_DISABLED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json(result.value);
}
