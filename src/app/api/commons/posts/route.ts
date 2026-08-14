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

  let body: { title?: string; body?: string; category?: string; formal?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { loadMemberCommonsContext } = await import(
    "@/lib/commons/member-context"
  );
  const { createPost } = await import("@/lib/commons/service");
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    gated.session.accountId,
  );
  if (!organizationId) {
    return NextResponse.json(
      {
        error:
          "Posting requires community membership in this organization. Organization-admin or Chamber status is not a substitute.",
        code: "COMMONS_MEMBERSHIP_REQUIRED",
      },
      { status: 403 },
    );
  }

  const result = await createPost(db, {
    principal,
    organizationId,
    title: body.title ?? "",
    body: body.body ?? "",
    category: body.category ?? "",
    formal: body.formal,
    clientIp: clientIp(request),
  });
  if (!result.ok) {
    const status =
      result.code === "COMMONS_RATE_LIMITED"
        ? 429
        : result.code === "AUTH_REQUIRED"
          ? 401
          : result.code === "COMMONS_MEMBERSHIP_REQUIRED" ||
              result.code === "COMMONS_CATEGORY_FORBIDDEN" ||
              result.code === "COMMONS_FORMAL_FORBIDDEN"
            ? 403
            : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }
  return NextResponse.json(result.value);
}
