import { NextResponse } from "next/server";

import {
  clientIp,
  jsonStatus,
  rejectIfNotGated,
  rejectTrustedSystem,
} from "@/lib/bodies/http";

export async function POST(request: Request) {
  const gated = rejectIfNotGated();
  if (gated) {
    return gated;
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const session = await requireGatedSession();
  if (!session.ok) {
    return NextResponse.json(
      { error: session.error, code: session.code },
      { status: session.status },
    );
  }

  let body: {
    slug?: string;
    rationale?: string;
    minorityReasoning?: string | null;
    rollCall?: Array<{ memberPublicId: string; position: string }>;
    trustedSystem?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const trusted = rejectTrustedSystem(body);
  if (trusted) {
    return trusted;
  }

  const { loadMemberCommonsContext } = await import(
    "@/lib/commons/member-context"
  );
  const { publishCouncilRecommendations } = await import("@/lib/bodies/service");
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.session.accountId,
  );
  if (!organizationId) {
    return NextResponse.json(
      {
        error: "Community membership is required.",
        code: "AUTHZ_DENIED",
      },
      { status: 403 },
    );
  }

  const result = await publishCouncilRecommendations(db, {
    principal,
    organizationId,
    slugOrPublicId: body.slug ?? "",
    rationale: body.rationale ?? "",
    minorityReasoning: body.minorityReasoning,
    rollCall: body.rollCall ?? [],
    clientIp: clientIp(request),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: jsonStatus(result.code) },
    );
  }
  return NextResponse.json(result.value);
}
