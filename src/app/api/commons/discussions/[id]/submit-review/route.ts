import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const { loadMemberCommonsContext } = await import(
    "@/lib/commons/member-context"
  );
  const { submitForFormalReview } = await import("@/lib/commons/service");
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    gated.session.accountId,
  );
  if (!organizationId) {
    return NextResponse.json(
      {
        error: "Community membership is required to submit a proposal",
        code: "COMMONS_MEMBERSHIP_REQUIRED",
      },
      { status: 403 },
    );
  }

  const result = await submitForFormalReview(db, {
    principal,
    organizationId,
    publicId: id,
  });
  if (!result.ok) {
    const status =
      result.code === "AUTH_REQUIRED"
        ? 401
        : result.code === "COMMONS_MEMBERSHIP_REQUIRED" ||
            result.code === "COMMONS_AUTHOR_REQUIRED" ||
            result.code === "AUTHZ_DENIED"
          ? 403
          : result.code === "COMMONS_DISCUSSION_NOT_FOUND"
            ? 404
            : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json(result.value);
}
