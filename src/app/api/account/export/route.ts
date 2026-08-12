import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

const EXPORT_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Disposition": 'attachment; filename="ostt-account-export.json"',
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
} as const;

function sanitizedUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: "Account export temporarily unavailable",
      code: "ACCOUNT_EXPORT_UNAVAILABLE",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { requireGatedSession } = await import("@/lib/auth/guard");
    const { getGatedDb } = await import("@/lib/auth/runtime");
    const { exportOwnAccountData } = await import("@/lib/privacy/export");

    const gated = await requireGatedSession();
    if (!gated.ok) {
      return NextResponse.json(
        { ok: false, error: gated.error, code: gated.code },
        { status: gated.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await exportOwnAccountData(
      getGatedDb(),
      gated.session.accountId,
    );
    if (!result.ok) {
      const status =
        result.code === "ACCOUNT_EXPORT_UNAVAILABLE"
          ? 503
          : result.code === "EXPORT_CROSS_ACCOUNT_BLOCKED"
            ? 500
            : 403;
      return NextResponse.json(
        {
          ok: false,
          error:
            result.code === "ACCOUNT_EXPORT_UNAVAILABLE"
              ? "Account export temporarily unavailable"
              : result.error,
          code: result.code,
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, value: result.value },
      { headers: EXPORT_HEADERS },
    );
  } catch {
    return sanitizedUnavailable();
  }
}
