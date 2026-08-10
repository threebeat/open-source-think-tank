import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import type { VerificationAssertionKind } from "@/lib/adapters/verification";

const KINDS: VerificationAssertionKind[] = [
  "bot_resistance",
  "contact_continuity",
  "uniqueness",
  "eligibility",
  "residency",
  "legal_identity",
];

/** Account-scoped: opens a verification case for the session account only. */
export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: {
    kind?: string;
    assertionSummary?: string;
    artifactPurpose?: string;
    artifactPayload?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.kind ||
    !KINDS.includes(body.kind as VerificationAssertionKind) ||
    !body.assertionSummary?.trim()
  ) {
    return NextResponse.json(
      { error: "kind and assertionSummary are required" },
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
  const { openVerificationCase } = await import("@/lib/verification/cases");

  // Subject is always the session account — never accept a client accountId.
  const result = await openVerificationCase(getGatedDb(), {
    accountId: gated.session.accountId,
    actorAccountId: gated.session.accountId,
    kind: body.kind as VerificationAssertionKind,
    assertionSummary: body.assertionSummary,
    artifact:
      body.artifactPurpose && body.artifactPayload
        ? {
            purpose: body.artifactPurpose,
            sensitivePayload: body.artifactPayload,
          }
        : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 },
    );
  }

  return NextResponse.json(result.value);
}
