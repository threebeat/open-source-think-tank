import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import type { FoundationDb } from "@/db/types";
import { resolveAppMode } from "@/lib/env/app-mode";
import { getPrimaryCommunityMembership } from "@/lib/organizations/membership-repository";

export async function loadMemberCommonsContext(accountId: string): Promise<{
  db: FoundationDb | null;
  principal: AuthzPrincipal | null;
  organizationId: string | null;
}> {
  if (resolveAppMode() !== "gated") {
    return { db: null, principal: null, organizationId: null };
  }
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, accountId);
  const membership = await getPrimaryCommunityMembership(db, accountId);
  return {
    db,
    principal,
    organizationId: membership?.organizationId ?? null,
  };
}
