import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  authenticatedLegacyRedirect,
  hasAuthJsSessionCookie,
  unauthenticatedProductRedirect,
} from "@/lib/auth/account-gate";
import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";

/** Next.js 16 network proxy — security headers, CSRF, and V2-21 account gate. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    try {
      assertCsrfSafe(request);
    } catch (error) {
      const denied = csrfDeniedResponse(error);
      applySecurityHeaders(denied.headers);
      return denied;
    }
  }

  const pathname = request.nextUrl.pathname;
  const authed = hasAuthJsSessionCookie(request.headers.get("cookie"));

  if (!authed) {
    const dest = unauthenticatedProductRedirect(pathname);
    if (dest) {
      const url = request.nextUrl.clone();
      url.pathname = dest;
      url.search = "";
      const redirected = NextResponse.redirect(url);
      applySecurityHeaders(redirected.headers);
      return redirected;
    }
  } else {
    const dest = authenticatedLegacyRedirect(pathname);
    if (dest) {
      const url = request.nextUrl.clone();
      url.pathname = dest;
      url.search = "";
      const redirected = NextResponse.redirect(url);
      applySecurityHeaders(redirected.headers);
      return redirected;
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
