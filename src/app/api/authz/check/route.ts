import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { CAPABILITIES, type Capability } from "@/lib/authz/types";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: { capability?: string };
  try {
    body = (await request.json()) as { capability?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.capability ||
    !CAPABILITIES.includes(body.capability as Capability)
  ) {
    return NextResponse.json(
      { error: "Unknown capability", code: "AUTHZ_UNKNOWN_CAPABILITY" },
      { status: 400 },
    );
  }

  const { requireCapability } = await import("@/lib/authz/server");
  const decision = await requireCapability(body.capability as Capability);
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, code: decision.code },
      { status: decision.status },
    );
  }

  return NextResponse.json({
    ok: true,
    capability: body.capability,
    accountId: decision.principal.accountId,
  });
}
