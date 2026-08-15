import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";
import { isOpenEnrollmentEnabled } from "@/lib/v2/flags";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return enrollOnThisDevice(request);
  }
  if (!isOpenEnrollmentEnabled()) {
    return NextResponse.json(
      { error: "Open enrollment is not available.", code: "ENROLLMENT_DISABLED" },
      { status: 403 },
    );
  }

  let body: {
    identifier?: string;
    password?: string;
    honeypot?: string;
    formOpenedAt?: number;
    communityStandardsAssent?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { enrollOpenAccount } = await import("@/lib/auth/enrollment");
  const { signIn } = await import("@/lib/auth/next-auth");
  const result = await enrollOpenAccount(getGatedDb(), {
    identifier: body.identifier ?? "",
    password: body.password ?? "",
    honeypot: body.honeypot,
    formOpenedAt: body.formOpenedAt,
    communityStandardsAssent: Boolean(body.communityStandardsAssent),
    clientIp: clientIp(request),
  });

  if (!result.ok) {
    const status =
      result.code === "ENROLLMENT_RATE_LIMITED"
        ? 429
        : result.code === "ENROLLMENT_DISABLED"
          ? 403
          : result.code === "ENROLLMENT_DUPLICATE"
            ? 409
            : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  await signIn("session-token", {
    sessionToken: result.value.rawSessionToken,
    redirect: false,
  });

  return NextResponse.json({
    accountId: result.value.accountId,
    lifecycleState: result.value.lifecycleState,
    synthetic: result.value.synthetic,
    sessionId: result.value.sessionId,
    assignmentExplanation: result.value.assignmentExplanation,
    communityStandardsVersion: result.value.communityStandardsVersion,
  });
}

async function enrollOnThisDevice(request: Request) {
  let body: {
    identifier?: string;
    password?: string;
    honeypot?: string;
    formOpenedAt?: number;
    communityStandardsAssent?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    enrollLocalAccount,
    parseCookieHeader,
    PRE_ALPHA_ACCOUNTS_COOKIE,
    readLocalAccounts,
  } = await import("@/lib/auth/pre-alpha-local");
  const { attachPreAlphaCookies } = await import("@/lib/auth/pre-alpha-cookies");
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const result = await enrollLocalAccount(
    readLocalAccounts(cookies[PRE_ALPHA_ACCOUNTS_COOKIE]),
    {
      identifier: body.identifier ?? "",
      password: body.password ?? "",
      honeypot: body.honeypot,
      formOpenedAt: body.formOpenedAt,
      communityStandardsAssent: Boolean(body.communityStandardsAssent),
    },
  );
  if (!result.ok) {
    const status = result.code === "ENROLLMENT_DUPLICATE" ? 409 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  const response = NextResponse.json({
    accountId: result.session.accountId,
    lifecycleState: result.session.lifecycleState,
    synthetic: true,
    sessionId: result.session.sessionId,
    assignmentExplanation: result.assignmentExplanation,
    communityStandardsVersion: "v1-prealpha",
  });
  return attachPreAlphaCookies(response, result.accounts, result.session);
}
