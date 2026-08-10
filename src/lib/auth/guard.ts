import { auth } from "@/lib/auth/next-auth";
import type { AuthSession } from "@/lib/adapters/auth";
import { resolveAppMode } from "@/lib/env/app-mode";
import type { Capability } from "@/lib/authz/types";

export type GuardFailure =
  | { ok: false; status: 401 | 403 | 404; code: string; error: string }
  | { ok: true; session: AuthSession };

export async function requireGatedSession(): Promise<GuardFailure> {
  if (resolveAppMode() !== "gated") {
    return {
      ok: false,
      status: 404,
      code: "PUBLIC_DEMO_NO_AUTH",
      error: "Not found",
    };
  }

  const session = await auth();
  const user = session?.user as
    | {
        accountId?: string;
        sessionId?: string;
        lifecycleState?: AuthSession["lifecycleState"];
        synthetic?: boolean;
      }
    | undefined;

  if (!user?.accountId || !user.sessionId || !user.lifecycleState) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      error: "Authentication required",
    };
  }

  return {
    ok: true,
    session: {
      accountId: user.accountId,
      sessionId: user.sessionId,
      lifecycleState: user.lifecycleState,
      synthetic: Boolean(user.synthetic),
    },
  };
}

/** @deprecated Prefer requireCapability from @/lib/authz/server */
export async function requireActiveCapability(
  capability: Extract<
    Capability,
    | "institutional.vote"
    | "institutional.council_deliberation"
    | "institutional.council_policy"
    | "institutional.publish_decision"
  >,
): Promise<GuardFailure> {
  const { requireCapability } = await import("@/lib/authz/server");
  const decision = await requireCapability(capability);
  if (!decision.ok) {
    return {
      ok: false,
      status: decision.status,
      code: decision.code,
      error: decision.error,
    };
  }
  return {
    ok: true,
    session: {
      accountId: decision.principal.accountId,
      sessionId: "",
      lifecycleState: decision.principal.lifecycleState,
      synthetic: decision.principal.synthetic,
    },
  };
}
