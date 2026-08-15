import { NextResponse } from "next/server";

import {
  clientIp,
  jsonStatus,
  rejectIfNotGated,
  rejectTrustedSystem,
} from "@/lib/bodies/http";

export async function POST(request: Request) {
  const gated = rejectIfNotGated();
  if (gated) {
    return gated;
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const session = await requireGatedSession();
  if (!session.ok) {
    return NextResponse.json(
      { error: session.error, code: session.code },
      { status: session.status },
    );
  }

  let body: {
    slug?: string;
    action?:
      | "accept_to_council_agenda"
      | "decline_council_intake"
      | "accept_disputed_to_council_agenda"
      | "decline_disputed_council_intake";
    reason?: string | null;
    trustedSystem?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const trusted = rejectTrustedSystem(body);
  if (trusted) {
    return trusted;
  }

  const { loadMemberCommonsContext } = await import(
    "@/lib/commons/member-context"
  );
  const { recordCouncilIntake } = await import("@/lib/bodies/service");
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.session.accountId,
  );
  if (!organizationId || !db) {
    return NextResponse.json(
      {
        error: "Community membership is required.",
        code: "AUTHZ_DENIED",
      },
      { status: 403 },
    );
  }

  const allowedActions = new Set([
    "accept_to_council_agenda",
    "decline_council_intake",
    "accept_disputed_to_council_agenda",
    "decline_disputed_council_intake",
  ]);
  if (!body.action || !allowedActions.has(body.action)) {
    return NextResponse.json(
      {
        error: "A Council intake action is required",
        code: "GOVERNANCE_UNKNOWN_ACTION",
      },
      { status: 400 },
    );
  }

  const result = await recordCouncilIntake(db, {
    principal,
    organizationId,
    slugOrPublicId: body.slug ?? "",
    action: body.action,
    reason: body.reason,
    clientIp: clientIp(request),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: jsonStatus(result.code) },
    );
  }
  return NextResponse.json(result.value);
}
