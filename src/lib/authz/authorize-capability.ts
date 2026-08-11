import { authorize } from "@/lib/authz/authorize";
import type { AuthzDecision, AuthzPrincipal, Capability } from "@/lib/authz/types";
import type { GatedDb } from "@/lib/persistence/gated";
import { CAPABILITY_ASSURANCE } from "@/lib/verification/ladder";
import { evaluateAssurance } from "@/lib/verification/status";

/**
 * Server-side gate: role/lifecycle authorization **and** mapped assurance.
 * Use this for every protected action — not `authorize()` alone.
 */
export async function authorizeCapability(
  db: GatedDb,
  principal: AuthzPrincipal | null | undefined,
  capability: Capability,
): Promise<AuthzDecision> {
  const roleDecision = authorize(principal, capability);
  if (!roleDecision.ok) {
    return roleDecision;
  }

  if (!CAPABILITY_ASSURANCE[capability]) {
    return roleDecision;
  }

  const assurance = await evaluateAssurance(
    db,
    roleDecision.principal.accountId,
    capability,
  );
  if (!assurance.ok) {
    return {
      ok: false,
      status: 403,
      code: "AUTHZ_ASSURANCE_REQUIRED",
      error: `Capability ${capability} requires assurance ${assurance.requiredLevel} (missing: ${assurance.missingKinds.join(", ") || "none"}).`,
      missingKinds: assurance.missingKinds,
      requiredLevel: assurance.requiredLevel,
    };
  }

  return roleDecision;
}
