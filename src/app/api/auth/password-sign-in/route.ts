import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export async function POST(request: Request) {
  if (resolveAppMode() !== "gated") {
    return signInOnThisDevice(request);
  }

  let body: { identifier?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.identifier?.trim() || !body.password) {
    return NextResponse.json(
      { error: "Identifier and password are required." },
      { status: 400 },
    );
  }

  const { getAuthService } = await import("@/lib/auth/runtime");
  const { signIn } = await import("@/lib/auth/next-auth");
  const result = await getAuthService().signInWithPassword(
    body.identifier,
    body.password,
  );

  if (!result.ok) {
    const status =
      result.code === "AUTH_RATE_LIMITED"
        ? 429
        : result.code === "AUTH_PASSWORD_INVALID"
          ? 401
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
  });
}

async function signInOnThisDevice(request: Request) {
  let body: { identifier?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.identifier?.trim() || !body.password) {
    return NextResponse.json(
      { error: "Identifier and password are required." },
      { status: 400 },
    );
  }

  const {
    parseCookieHeader,
    PRE_ALPHA_ACCOUNTS_COOKIE,
    readLocalAccounts,
    signInLocalAccount,
  } = await import("@/lib/auth/pre-alpha-local");
  const { attachPreAlphaCookies } = await import("@/lib/auth/pre-alpha-cookies");
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const accounts = readLocalAccounts(cookies[PRE_ALPHA_ACCOUNTS_COOKIE]);
  const result = await signInLocalAccount(
    accounts,
    body.identifier,
    body.password,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    accountId: result.session.accountId,
    lifecycleState: result.session.lifecycleState,
    synthetic: true,
    sessionId: result.session.sessionId,
  });
  return attachPreAlphaCookies(response, accounts, result.session);
}
