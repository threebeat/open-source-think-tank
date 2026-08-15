import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

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

  let body: {
    slug?: string;
    statementPublicId?: string;
    position?: string;
    trustedSystem?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.trustedSystem === true) {
    return NextResponse.json(
      {
        error: "Members cannot invoke the system actor",
        code: "GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED",
      },
      { status: 403 },
    );
  }

  const { loadMemberCommonsContext } = await import(
    "@/lib/commons/member-context"
  );
  const { recordMemberPosition } = await import("@/lib/agenda/service");
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    gated.session.accountId,
  );
  if (!organizationId || !db) {
    return NextResponse.json(
      {
        error:
          "Recording a position requires community membership in this organization.",
        code: "AGENDA_MEMBERSHIP_REQUIRED",
      },
      { status: 403 },
    );
  }

  const result = await recordMemberPosition(db, {
    principal,
    organizationId,
    slugOrPublicId: body.slug ?? "",
    statementPublicId: body.statementPublicId ?? "",
    position: body.position ?? "",
    clientIp: clientIp(request),
  });
  if (!result.ok) {
    const status =
      result.code === "AGENDA_RATE_LIMITED"
        ? 429
        : result.code === "AUTH_REQUIRED"
          ? 401
          : result.code === "AGENDA_MEMBERSHIP_REQUIRED"
            ? 403
            : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json(result.value);
}
