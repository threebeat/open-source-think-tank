import { getGatedDb } from "@/lib/auth/runtime";
import { requireGatedSession } from "@/lib/auth/guard";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzDecision, Capability } from "@/lib/authz/types";

/** Load the session principal and evaluate a capability (deny by default). */
export async function requireCapability(
  capability: Capability,
): Promise<AuthzDecision> {
  const gated = await requireGatedSession();
  if (!gated.ok) {
    return {
      ok: false,
      status: gated.status,
      code: gated.code,
      error: gated.error,
    };
  }

  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  return authorize(principal, capability);
}
