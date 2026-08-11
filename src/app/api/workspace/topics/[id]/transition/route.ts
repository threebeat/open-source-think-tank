import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import type { TopicTransitionAction } from "@/lib/topics/authoring";
import type { TopicWorkflowState } from "@/lib/topics/repository";

type RouteContext = { params: Promise<{ id: string }> };

const ACTIONS = new Set<TopicTransitionAction>([
  "open",
  "begin_review",
  "reopen",
  "pause",
  "archive",
]);

function statusFor(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED"
  ) {
    return 403;
  }
  if (code === "TOPIC_STATE_CONFLICT") {
    return 409;
  }
  if (code === "TOPIC_NOT_FOUND") {
    return 404;
  }
  return 400;
}

export async function POST(request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "") as TopicTransitionAction;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Unknown transition action", code: "TOPIC_INPUT_INVALID" },
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
  const { transitionTopic } = await import("@/lib/topics/authoring");
  const result = await transitionTopic(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    topicId: id,
    action,
    expectedWorkflowState: String(
      body.expectedWorkflowState ?? "",
    ) as TopicWorkflowState,
    reason: body.reason ? String(body.reason) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: statusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}
