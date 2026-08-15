import { NextResponse } from "next/server";

import {
  cookieOptions,
  encodeAccountsCookie,
  encodeSessionCookie,
  PRE_ALPHA_ACCOUNTS_COOKIE,
  PRE_ALPHA_SESSION_COOKIE,
  type PreAlphaLocalAccount,
  type PreAlphaLocalSession,
} from "@/lib/auth/pre-alpha-local";

export function attachPreAlphaCookies(
  response: NextResponse,
  accounts: PreAlphaLocalAccount[],
  session: PreAlphaLocalSession | null,
): NextResponse {
  const options = cookieOptions();
  response.cookies.set(PRE_ALPHA_ACCOUNTS_COOKIE, encodeAccountsCookie(accounts), options);
  if (session) {
    response.cookies.set(PRE_ALPHA_SESSION_COOKIE, encodeSessionCookie(session), options);
  } else {
    response.cookies.set(PRE_ALPHA_SESSION_COOKIE, "", { ...options, maxAge: 0 });
  }
  return response;
}

export function clearPreAlphaSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(PRE_ALPHA_SESSION_COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
  return response;
}
