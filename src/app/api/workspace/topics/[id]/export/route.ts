import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { exportStaffTopicPackage } = await import(
    "@/lib/topics/staff-export"
  );

  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { ok: false, error: gated.error, code: gated.code },
      { status: gated.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id } = await context.params;
  const result = await exportStaffTopicPackage(
    getGatedDb(),
    gated.session.accountId,
    id,
  );
  if (!result.ok) {
    const status =
      result.code === "TOPIC_NOT_FOUND"
        ? 404
        : result.code === "STAFF_EXPORT_REDACTION_BLOCKED"
          ? 500
          : 403;
    return NextResponse.json(
      {
        ok: false,
        error:
          result.code === "TOPIC_NOT_FOUND"
            ? "Topic not found"
            : "Staff export unavailable",
        code: result.code,
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, value: result.value.bundle },
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.value.filename}"`,
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
