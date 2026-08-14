import { resolveAppMode, type EnvMap } from "@/lib/env/app-mode";

/**
 * Unauthenticated visitors may use `/`, `/demo/**`, `/join`, and `/auth/**`
 * (V2-21). Everything else is an account-gated product or legacy think-tank
 * surface. API routes handle their own auth and are not redirected here.
 */

const STATIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
] as const;

export function isStaticOrInternalPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname);
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPublicUnauthenticatedPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  if (pathname === "/join" || pathname.startsWith("/join/")) {
    return true;
  }
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return true;
  }
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return true;
  }
  return false;
}

function firstPathSegment(pathname: string, prefix: string): string | null {
  if (pathname === prefix) {
    return null;
  }
  if (!pathname.startsWith(`${prefix}/`)) {
    return null;
  }
  const segment = pathname.slice(prefix.length + 1).split("/").find(Boolean);
  return segment ?? null;
}

/**
 * Authenticated think-tank URLs map onto Commonhall member halls.
 * Unauthenticated traffic is redirected by `unauthenticatedProductRedirect`
 * before these destinations apply. `/demo/workflow` is also listed so the
 * public demo path can thin-redirect after the proxy allows `/demo/**`.
 */
export function authenticatedLegacyRedirect(pathname: string): string | null {
  if (pathname === "/demo/workflow" || pathname.startsWith("/demo/workflow/")) {
    return "/demo";
  }
  if (pathname === "/topics" || pathname.startsWith("/topics/")) {
    const slug = firstPathSegment(pathname, "/topics");
    return slug ? `/agenda/topics/${slug}` : "/agenda";
  }
  if (pathname === "/idea-commons" || pathname.startsWith("/idea-commons/")) {
    return "/commons";
  }
  if (pathname === "/formal-topics" || pathname.startsWith("/formal-topics/")) {
    const slug = firstPathSegment(pathname, "/formal-topics");
    return slug ? `/agenda/topics/${slug}` : "/agenda";
  }
  if (pathname === "/deliberation" || pathname.startsWith("/deliberation/")) {
    const slug = firstPathSegment(pathname, "/deliberation");
    return slug ? `/chamber/topics/${slug}` : "/chamber";
  }
  if (pathname === "/decisions" || pathname.startsWith("/decisions/")) {
    const slug = firstPathSegment(pathname, "/decisions");
    return slug ? `/council/topics/${slug}` : "/council";
  }
  if (pathname === "/transparency" || pathname.startsWith("/transparency/")) {
    return "/records";
  }
  if (pathname === "/actions" || pathname.startsWith("/actions/")) {
    const slug = firstPathSegment(pathname, "/actions");
    return slug ? `/records/topics/${slug}` : "/records";
  }
  if (pathname === "/process" || pathname.startsWith("/process/")) {
    return "/demo";
  }
  if (pathname === "/about" || pathname.startsWith("/about/")) {
    return "/";
  }
  return null;
}

export function hasAuthJsSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }
  return /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/.test(cookieHeader);
}

export function unauthenticatedProductRedirect(
  pathname: string,
  env: EnvMap = process.env,
): string | null {
  if (isStaticOrInternalPath(pathname) || isApiPath(pathname)) {
    return null;
  }
  if (isPublicUnauthenticatedPath(pathname)) {
    return null;
  }
  // Public-demo workspace/staff pages keep their existing 404 isolation.
  if (resolveAppMode(env) === "public-demo") {
    if (pathname.startsWith("/workspace") || pathname.startsWith("/staff")) {
      return null;
    }
    return "/";
  }
  return "/auth/sign-in";
}
