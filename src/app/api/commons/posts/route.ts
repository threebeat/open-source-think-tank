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
    return createLocalPost(request);
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
  if (!organizationId || !db) {
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

async function createLocalPost(request: Request) {
  let body: { title?: string; body?: string; category?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    addLocalPost,
    parseCookieHeader,
    PRE_ALPHA_ACCOUNTS_COOKIE,
    PRE_ALPHA_SESSION_COOKIE,
    readLocalAccounts,
    readLocalSession,
  } = await import("@/lib/auth/pre-alpha-local");
  const { isMemberCreateCategory } = await import("@/lib/commons/categories");
  const { attachPreAlphaCookies } = await import("@/lib/auth/pre-alpha-cookies");
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const accounts = readLocalAccounts(cookies[PRE_ALPHA_ACCOUNTS_COOKIE]);
  const session = readLocalSession(
    cookies[PRE_ALPHA_SESSION_COOKIE],
    cookies[PRE_ALPHA_ACCOUNTS_COOKIE],
  );
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  if (!isMemberCreateCategory(body.category ?? "")) {
    return NextResponse.json(
      { error: "That category is not open for member posts.", code: "COMMONS_CATEGORY_FORBIDDEN" },
      { status: 403 },
    );
  }
  const result = addLocalPost(accounts, session.accountId, {
    title: body.title ?? "",
    body: body.body ?? "",
    category: body.category as "topic_proposals" | "approach_proposals" | "general_discussion",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }
  const response = NextResponse.json({
    publicId: result.post.publicId,
    title: result.post.title,
  });
  return attachPreAlphaCookies(response, result.accounts, session);
}
