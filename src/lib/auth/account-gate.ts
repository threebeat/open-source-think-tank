import { resolveAppMode, type EnvMap } from "@/lib/env/app-mode";
import { legacyProductRedirect } from "@/lib/legacy-product-redirects";

/**
 * Unauthenticated visitors may use `/`, `/demo/**`, `/about`, `/join`, and `/auth/**`
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
  if (pathname === "/about" || pathname.startsWith("/about/")) {
    return true;
  }
  return false;
}

export function authenticatedLegacyRedirect(pathname: string): string | null {
  return legacyProductRedirect(pathname);
}

export function hasAuthJsSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }
  if (/(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/.test(cookieHeader)) {
    return true;
  }
  return /(?:^|;\s*)ch_prealpha_session=/.test(cookieHeader);
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
    return "/auth/sign-in";
  }
  return "/auth/sign-in";
}
