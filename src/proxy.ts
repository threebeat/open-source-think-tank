import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { assertCsrfSafe, csrfDeniedResponse } from "@/lib/security/csrf";
import { applySecurityHeaders } from "@/lib/security/headers";

/** Next.js 16 network proxy — security headers + CSRF for mutating API routes. */
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

  const response = NextResponse.next();
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
