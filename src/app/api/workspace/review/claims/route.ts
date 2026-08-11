import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function GET(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      {
        status: gated.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId") ?? undefined;
  const workflowState =
    (url.searchParams.get("workflowState") as
      | "submitted"
      | "changes_requested"
      | "accepted"
      | "rejected"
      | "withdrawn"
      | "draft"
      | undefined) ?? "submitted";

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listClaimReviewQueue } = await import("@/lib/review/queues");
  const result = await listClaimReviewQueue(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    topicId,
    workflowState,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: result.code.startsWith("AUTHZ") ? 403 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}
