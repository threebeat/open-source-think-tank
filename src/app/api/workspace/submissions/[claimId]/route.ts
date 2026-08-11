import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";

type RouteContext = { params: Promise<{ claimId: string }> };

function statusFor(code: string): number {
  if (
    code === "AUTH_REQUIRED" ||
    code === "AUTHZ_DENIED" ||
    code === "AUTHZ_ACTIVE_REQUIRED" ||
    code === "AUTHZ_ASSURANCE_REQUIRED" ||
    code === "AUTHZ_ACCOUNT_DISABLED" ||
    code === "SUBMISSION_NOT_OWNED"
  ) {
    return 403;
  }
  if (code === "SUBMISSION_STATE_CONFLICT") {
    return 409;
  }
  if (code === "CLAIM_NOT_FOUND") {
    return 404;
  }
  return 400;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    assertCsrfSafe(request);
  } catch (error) {
    return csrfDeniedResponse(error);
  }

  const { claimId } = await context.params;
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

  const action = String(body.action ?? "update");
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const {
    resubmitOwnSubmission,
    updateOwnSubmission,
    withdrawOwnSubmission,
  } = await import("@/lib/submissions/submit");

  if (action === "withdraw") {
    const result = await withdrawOwnSubmission(getGatedDb(), {
      actorAccountId: gated.session.accountId,
      claimId,
      expectedClaimWorkflowState: String(
        body.expectedClaimWorkflowState ?? "",
      ) as "draft" | "submitted" | "changes_requested",
      expectedEvidenceWorkflowState: String(
        body.expectedEvidenceWorkflowState ?? "",
      ) as "draft" | "submitted" | "changes_requested",
      reason: typeof body.reason === "string" ? body.reason : undefined,
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

  if (action === "resubmit") {
    const result = await resubmitOwnSubmission(getGatedDb(), {
      actorAccountId: gated.session.accountId,
      claimId,
      expectedClaimWorkflowState: "changes_requested",
      expectedEvidenceWorkflowState: "changes_requested",
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

  const result = await updateOwnSubmission(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId,
    expectedClaimUpdatedAt: String(body.expectedClaimUpdatedAt ?? ""),
    expectedEvidenceUpdatedAt: String(body.expectedEvidenceUpdatedAt ?? ""),
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
