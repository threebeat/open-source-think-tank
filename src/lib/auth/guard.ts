import { auth } from "@/lib/auth/next-auth";
import {
  canExerciseActiveCapability,
  type ActiveOnlyCapability,
} from "@/lib/auth/capabilities";
import type { AuthSession } from "@/lib/adapters/auth";
import { resolveAppMode } from "@/lib/env/app-mode";

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

  if (
    !user?.accountId ||
    !user.sessionId ||
    !user.lifecycleState
  ) {
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

export async function requireActiveCapability(
  capability: ActiveOnlyCapability,
): Promise<GuardFailure> {
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return gated;
  }
  if (!canExerciseActiveCapability(gated.session.lifecycleState)) {
    return {
      ok: false,
      status: 403,
      code: "ACTIVE_CAPABILITY_REQUIRED",
      error: `Capability ${capability} requires an active account`,
    };
  }
  return gated;
}
