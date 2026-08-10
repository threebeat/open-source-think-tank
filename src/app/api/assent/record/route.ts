import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: {
    documentVersionId?: string;
    presentedContentHash?: string;
    method?: string;
    noticesAcknowledged?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.documentVersionId?.trim() ||
    !body.presentedContentHash?.trim() ||
    !body.method?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "documentVersionId, presentedContentHash, and method are required",
      },
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
  const { recordAssent } = await import("@/lib/assent/record-assent");
  const result = await recordAssent(getGatedDb(), {
    accountId: gated.session.accountId,
    documentVersionId: body.documentVersionId,
    presentedContentHash: body.presentedContentHash,
    method: body.method,
    noticesAcknowledged: body.noticesAcknowledged ?? [],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }

  return NextResponse.json(result.value);
}
