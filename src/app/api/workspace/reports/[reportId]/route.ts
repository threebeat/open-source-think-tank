import { NextResponse } from "next/server";

import { reportMutationStatusFor } from "@/app/api/workspace/consultations/_report-status";
import { resolveAppMode } from "@/lib/env/app-mode";

type RouteContext = { params: Promise<{ reportId: string }> };

/** GET — staff report detail (includes raw shares for review; never public). */
export async function GET(_request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { reportId } = await context.params;
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

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getStaffReportDetail } = await import(
    "@/lib/public-input/reports/service"
  );
  const result = await getStaffReportDetail(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    reportId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: reportMutationStatusFor(result.code),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  if (!result.value) {
    return NextResponse.json(
      { error: "Public Input report not found", code: "PUBLIC_INPUT_REPORT_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}
