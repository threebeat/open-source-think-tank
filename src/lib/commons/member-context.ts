import { loadPrincipal } from "@/lib/authz/load-principal";
import type { AuthzPrincipal } from "@/lib/authz/types";
import type { FoundationDb } from "@/db/types";
import { getPrimaryCommunityMembership } from "@/lib/organizations/membership-repository";

export async function loadMemberCommonsContext(accountId: string): Promise<{
  db: FoundationDb;
  principal: AuthzPrincipal | null;
  organizationId: string | null;
}> {
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
