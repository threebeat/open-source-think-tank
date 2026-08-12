/**
 * CSRF defense for cookie-authenticated mutating API routes.
 * Allows same-origin browser requests and non-browser clients without Origin
 * when Sec-Fetch-Site is absent or `none` (e.g. server-to-server / Playwright).
 */

export function assertCsrfSafe(request: Request): void {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (curl, server jobs) often omit Origin.
    return;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    throw new Error("CSRF_HOST_MISSING");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("CSRF_ORIGIN_INVALID");
  }

  if (originHost !== host) {
    throw new Error("CSRF_ORIGIN_MISMATCH");
  }
}

export function csrfDeniedResponse(error: unknown): Response {
  return Response.json(
    {
      ok: false,
      error: "CSRF validation failed",
      code:
        error instanceof Error && error.message.startsWith("CSRF_")
          ? error.message
          : "CSRF_DENIED",
    },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
