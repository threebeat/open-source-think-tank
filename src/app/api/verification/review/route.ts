import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/**
 * Staff-restricted verification review actions.
 * Never accepts or returns raw identity document bytes.
 */
export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: {
    action?: "assign" | "reassign" | "approve" | "deny" | "revoke";
    caseId?: string;
    reviewerAccountId?: string;
    reason?: string;
    expiresAt?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.action || !body.caseId?.trim()) {
    return NextResponse.json(
      { error: "action and caseId are required" },
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
  const {
    assignReviewer,
    reassignReviewer,
    approveCase,
    denyCase,
    revokeCase,
  } = await import("@/lib/verification/cases");
  const db = getGatedDb();
  const actorAccountId = gated.session.accountId;

  let result;
  switch (body.action) {
    case "assign":
      if (!body.reviewerAccountId?.trim()) {
        return NextResponse.json(
          { error: "reviewerAccountId is required for assign" },
          { status: 400 },
        );
      }
      result = await assignReviewer(db, {
        caseId: body.caseId,
        reviewerAccountId: body.reviewerAccountId,
        actorAccountId,
      });
      break;
    case "reassign":
      if (!body.reviewerAccountId?.trim() || !body.reason?.trim()) {
        return NextResponse.json(
          { error: "reviewerAccountId and reason are required for reassign" },
          { status: 400 },
        );
      }
      result = await reassignReviewer(db, {
        caseId: body.caseId,
        reviewerAccountId: body.reviewerAccountId,
        actorAccountId,
        reason: body.reason,
      });
      break;
    case "approve":
      result = await approveCase(db, {
        caseId: body.caseId,
        actorAccountId,
        reason: body.reason ?? "",
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });
      break;
    case "deny":
      result = await denyCase(db, {
        caseId: body.caseId,
        actorAccountId,
        reason: body.reason ?? "",
      });
      break;
    case "revoke":
      result = await revokeCase(db, {
        caseId: body.caseId,
        actorAccountId,
        reason: body.reason ?? "",
      });
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!result.ok) {
    const status =
      result.code === "AUTH_REQUIRED"
        ? 401
        : result.code === "AUTHZ_DENIED" ||
            result.code === "AUTHZ_ACTIVE_REQUIRED" ||
            result.code === "VERIFY_REVIEWER_UNAUTHORIZED" ||
            result.code === "VERIFY_SELF_REVIEW"
          ? 403
          : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json({ ok: true });
}
