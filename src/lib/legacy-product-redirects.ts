/**
 * Thin destination map from retired think-tank URLs onto Commonhall halls.
 * Kept outside `@/lib/auth` so public-demo redirect pages do not import
 * gated auth/db modules (scripts/security-checks.mjs).
 */

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
export function legacyProductRedirect(pathname: string): string | null {
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
  return null;
}
