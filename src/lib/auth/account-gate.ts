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

const LEGACY_TO_MEMBER: Array<{ prefix: string; dest: string }> = [
  { prefix: "/idea-commons", dest: "/commons" },
  { prefix: "/formal-topics", dest: "/commons" },
  { prefix: "/deliberation", dest: "/chamber" },
  { prefix: "/decisions", dest: "/council" },
  { prefix: "/transparency", dest: "/records" },
  { prefix: "/actions", dest: "/records" },
  { prefix: "/topics", dest: "/agenda" },
  { prefix: "/process", dest: "/demo" },
  { prefix: "/about", dest: "/" },
];

export function authenticatedLegacyRedirect(pathname: string): string | null {
  for (const rule of LEGACY_TO_MEMBER) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.dest;
    }
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
