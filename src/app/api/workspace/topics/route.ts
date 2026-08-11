import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";

function authzStatus(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED"
  ) {
    return 403;
  }
  if (code === "TOPIC_SLUG_CONFLICT" || code === "TOPIC_STATE_CONFLICT") {
    return 409;
  }
  if (code === "TOPIC_NOT_FOUND") {
    return 404;
  }
  return 400;
}

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
  const { authorizeCapability } = await import(
    "@/lib/authz/authorize-capability"
  );
  const { loadPrincipal } = await import("@/lib/authz/load-principal");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  const decision = await authorizeCapability(db, principal, "topics.create");
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, code: decision.code },
      { status: 403 },
    );
  }

  const { listTopics } = await import("@/lib/topics/repository");
  const listed = await listTopics(db);
  if (!listed.ok) {
    return NextResponse.json(
      { error: listed.error, code: listed.code },
      { status: 400 },
    );
  }

  return NextResponse.json(listed.value, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
  const { createTopic } = await import("@/lib/topics/authoring");
  const result = await createTopic(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    slug: String(body.slug ?? ""),
    title: String(body.title ?? ""),
    question: String(body.question ?? ""),
    background: String(body.background ?? ""),
    scope: String(body.scope ?? ""),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: authzStatus(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
