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
  if (code === "CLAIM_NOT_FOUND" || code === "EVIDENCE_NOT_FOUND") {
    return 404;
  }
  return 400;
}

/**
 * Subject-specific own-submission mutations (3.7).
 * Body.subject must be "claim" or "evidence"; evidence actions require
 * evidenceSubmissionId — never inferred from links[0].
 */
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
  const subject = String(body.subject ?? "");
  const evidenceSubmissionId =
    typeof body.evidenceSubmissionId === "string"
      ? body.evidenceSubmissionId
      : "";

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const {
    resubmitOwnClaim,
    resubmitOwnEvidence,
    updateOwnClaimContent,
    updateOwnEvidenceContent,
    withdrawOwnClaim,
    withdrawOwnEvidence,
  } = await import("@/lib/submissions/submit");

  const db = getGatedDb();
  const actorAccountId = gated.session.accountId;
  const noStore = { "Cache-Control": "no-store" };

  if (action === "withdraw") {
    if (subject === "evidence") {
      if (!evidenceSubmissionId) {
        return NextResponse.json(
          {
            error: "evidenceSubmissionId is required",
            code: "SUBMISSION_INPUT_INVALID",
          },
          { status: 400, headers: noStore },
        );
      }
      const result = await withdrawOwnEvidence(db, {
        actorAccountId,
        evidenceSubmissionId,
        expectedWorkflowState: String(
          body.expectedWorkflowState ?? "",
        ) as "draft" | "submitted" | "changes_requested",
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: statusFor(result.code), headers: noStore },
        );
      }
      return NextResponse.json(result.value, { headers: noStore });
    }

    if (subject !== "claim") {
      return NextResponse.json(
        { error: "subject must be claim or evidence", code: "SUBMISSION_INPUT_INVALID" },
        { status: 400, headers: noStore },
      );
    }

    const result = await withdrawOwnClaim(db, {
      actorAccountId,
      claimId,
      expectedWorkflowState: String(
        body.expectedWorkflowState ?? "",
      ) as "draft" | "submitted" | "changes_requested",
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusFor(result.code), headers: noStore },
      );
    }
    return NextResponse.json(result.value, { headers: noStore });
  }

  if (action === "resubmit") {
    if (subject === "evidence") {
      if (!evidenceSubmissionId) {
        return NextResponse.json(
          {
            error: "evidenceSubmissionId is required",
            code: "SUBMISSION_INPUT_INVALID",
          },
          { status: 400, headers: noStore },
        );
      }
      const result = await resubmitOwnEvidence(db, {
        actorAccountId,
        evidenceSubmissionId,
        expectedWorkflowState: "changes_requested",
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: statusFor(result.code), headers: noStore },
        );
      }
      return NextResponse.json(result.value, { headers: noStore });
    }

    if (subject !== "claim") {
      return NextResponse.json(
        { error: "subject must be claim or evidence", code: "SUBMISSION_INPUT_INVALID" },
        { status: 400, headers: noStore },
      );
    }

    const result = await resubmitOwnClaim(db, {
      actorAccountId,
      claimId,
      expectedWorkflowState: "changes_requested",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusFor(result.code), headers: noStore },
      );
    }
    return NextResponse.json(result.value, { headers: noStore });
  }

  if (action !== "update") {
    return NextResponse.json(
      { error: "Unknown action", code: "SUBMISSION_INPUT_INVALID" },
      { status: 400, headers: noStore },
    );
  }

  if (subject === "evidence") {
    if (!evidenceSubmissionId) {
      return NextResponse.json(
        {
          error: "evidenceSubmissionId is required",
          code: "SUBMISSION_INPUT_INVALID",
        },
        { status: 400, headers: noStore },
      );
    }
    const result = await updateOwnEvidenceContent(db, {
      actorAccountId,
      evidenceSubmissionId,
      expectedUpdatedAt: String(body.expectedUpdatedAt ?? ""),
      sourceUrl: String(body.sourceUrl ?? ""),
      title: String(body.evidenceTitle ?? body.title ?? ""),
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
        { status: statusFor(result.code), headers: noStore },
      );
    }
    return NextResponse.json(result.value, { headers: noStore });
  }

  if (subject !== "claim") {
    return NextResponse.json(
      { error: "subject must be claim or evidence", code: "SUBMISSION_INPUT_INVALID" },
      { status: 400, headers: noStore },
    );
  }

  const result = await updateOwnClaimContent(db, {
    actorAccountId,
    claimId,
    expectedUpdatedAt: String(body.expectedUpdatedAt ?? ""),
    title: String(body.claimTitle ?? body.title ?? ""),
    summary: String(body.claimSummary ?? body.summary ?? ""),
    approachLabel: String(body.approachLabel ?? ""),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: statusFor(result.code), headers: noStore },
    );
  }

  return NextResponse.json(result.value, { headers: noStore });
}
