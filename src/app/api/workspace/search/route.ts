import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { workspaceSearchQuerySchema } from "@/lib/search/schemas";

export const dynamic = "force-dynamic";

function parseEntities(raw: string | null): string[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { searchWorkspace } = await import("@/lib/search/workspace-search");

  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { ok: false, error: gated.error, code: gated.code },
      { status: gated.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const parsed = workspaceSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    entities: parseEntities(url.searchParams.get("entities")),
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid search query",
        code: "SEARCH_VALIDATION_FAILED",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await searchWorkspace(
    getGatedDb(),
    gated.session.accountId,
    parsed.data,
  );
  if (!result.ok) {
    const status = result.code.startsWith("AUTHZ") ? 403 : 503;
    return NextResponse.json(
      {
        ok: false,
        error: "Workspace search temporarily unavailable",
        code: result.code.startsWith("AUTHZ")
          ? result.code
          : "WORKSPACE_SEARCH_UNAVAILABLE",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, value: result.value },
    { headers: { "Cache-Control": "no-store" } },
  );
}
