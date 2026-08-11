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
      | undefined) ?? "submitted";
  const qualityStatus =
    (url.searchParams.get("qualityStatus") as
      | "pending"
      | "accepted"
      | "limited"
      | "disputed"
      | "rejected"
      | undefined) ?? undefined;

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listEvidenceReviewQueue } = await import("@/lib/review/queues");
  const result = await listEvidenceReviewQueue(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    topicId,
    workflowState,
    qualityStatus,
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
