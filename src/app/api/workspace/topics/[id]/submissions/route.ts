import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";

type RouteContext = { params: Promise<{ id: string }> };

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
  if (code === "SUBMISSION_STATE_CONFLICT" || code === "TOPIC_STATE_CONFLICT") {
    return 409;
  }
  if (code === "TOPIC_NOT_FOUND" || code === "CLAIM_NOT_FOUND") {
    return 404;
  }
  return 400;
}

export async function GET(_request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { id } = await context.params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listOwnClaimsForTopic } = await import("@/lib/submissions/submit");
  const result = await listOwnClaimsForTopic(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    topicId: id,
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

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return NextResponse.json(
      { error: gated.error, code: gated.code },
      { status: gated.status },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { createAndSubmitClaimEvidence } = await import(
    "@/lib/submissions/submit"
  );
  const result = await createAndSubmitClaimEvidence(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    topicId: id,
    claimTitle: String(body.claimTitle ?? ""),
    claimSummary: String(body.claimSummary ?? ""),
    approachLabel: String(body.approachLabel ?? ""),
    sourceUrl: String(body.sourceUrl ?? ""),
    evidenceTitle: String(body.evidenceTitle ?? ""),
    organization: String(body.organization ?? ""),
    authorType: body.authorType as
      | "agency"
      | "researcher"
      | "journalist"
      | "civil_society"
      | "industry"
      | "other",
    sourceType: body.sourceType as
      | "report"
      | "dataset"
      | "peer_reviewed"
      | "news"
      | "memo"
      | "other",
    limitations: String(body.limitations ?? ""),
    relationship: body.relationship as "supporting" | "counterevidence",
    disclosureChoice:
      body.disclosureChoice === "disclose" ? "disclose" : "none",
    disclosurePublicSummary:
      typeof body.disclosurePublicSummary === "string"
        ? body.disclosurePublicSummary
        : undefined,
    disclosurePrivateDetail:
      typeof body.disclosurePrivateDetail === "string"
        ? body.disclosurePrivateDetail
        : null,
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
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
