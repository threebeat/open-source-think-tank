import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { gateAuthenticatedMutation } from "@/lib/security/mutation-gate";

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
  if (
    code === "EVIDENCE_STATE_CONFLICT" ||
    code === "EVIDENCE_QUALITY_CONFLICT" ||
    code === "EVIDENCE_REVIEW_SOURCE_STATE"
  ) {
    return 409;
  }
  if (code === "EVIDENCE_NOT_FOUND" || code === "TOPIC_NOT_FOUND") {
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
      {
        status: gated.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getEvidenceReviewDetail } = await import("@/lib/review/queues");
  const result = await getEvidenceReviewDetail(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    evidenceSubmissionId: id,
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

  const gatedBody = await gateAuthenticatedMutation({
    request,
    accountId: gated.session.accountId,
    family: "claim_evidence_review_quality",
  });
  if (!gatedBody.ok) {
    return gatedBody.response;
  }
  const body = gatedBody.body;

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const action = String(body.action ?? "");

  if (action === "workflow") {
    const { reviewEvidenceWorkflow } = await import("@/lib/evidence/review");
    const result = await reviewEvidenceWorkflow(getGatedDb(), {
      actorAccountId: gated.session.accountId,
      evidenceSubmissionId: id,
      decision: String(body.decision ?? "") as
        | "changes_requested"
        | "accepted"
        | "rejected",
      publicRationale: String(body.publicRationale ?? ""),
      privateNotes:
        body.privateNotes == null ? null : String(body.privateNotes),
      expectedWorkflowState: "submitted",
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

  if (action === "quality") {
    const { decideEvidenceQuality } = await import("@/lib/evidence/review");
    const result = await decideEvidenceQuality(getGatedDb(), {
      actorAccountId: gated.session.accountId,
      evidenceSubmissionId: id,
      qualityStatus: String(body.qualityStatus ?? "") as
        | "accepted"
        | "limited"
        | "disputed"
        | "rejected",
      publicRationale: String(body.publicRationale ?? ""),
      privateNotes:
        body.privateNotes == null ? null : String(body.privateNotes),
      expectedQualityStatus: String(body.expectedQualityStatus ?? "") as
        | "pending"
        | "accepted"
        | "limited"
        | "disputed"
        | "rejected",
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

  return NextResponse.json(
    { error: "Unknown evidence review action", code: "EVIDENCE_REVIEW_INPUT_INVALID" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
