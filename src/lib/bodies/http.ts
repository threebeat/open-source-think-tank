import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

export function rejectIfNotGated(): NextResponse | null {
  if (resolveAppMode() !== "gated") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return null;
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

export function rejectTrustedSystem(body: { trustedSystem?: unknown }): NextResponse | null {
  if (body.trustedSystem === true) {
    return NextResponse.json(
      {
        error: "Members cannot invoke the system actor",
        code: "GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED",
      },
      { status: 403 },
    );
  }
  return null;
}

export function jsonStatus(code: string): number {
  if (code === "BODY_RATE_LIMITED") {
    return 429;
  }
  if (code === "AUTH_REQUIRED") {
    return 401;
  }
  if (code === "AUTHZ_DENIED" || code === "GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED") {
    return 403;
  }
  if (code === "GOVERNANCE_REASON_REQUIRED") {
    return 400;
  }
  return 400;
}
