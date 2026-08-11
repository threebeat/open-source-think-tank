import { and, eq, isNull } from "drizzle-orm";

import {
  accounts,
  councilAppointments,
  roleAssignments,
} from "@/db/schema";
import type { GatedDb } from "@/lib/persistence/gated";
import type {
  AuthzPrincipal,
  CouncilRole,
  PlatformRole,
} from "@/lib/authz/types";

export async function loadPrincipal(
  db: GatedDb,
  accountId: string,
): Promise<AuthzPrincipal | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    return null;
  }

  const roles = await db
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.accountId, accountId),
        isNull(roleAssignments.revokedAt),
      ),
    );

  const seats = await db
    .select({ councilRole: councilAppointments.councilRole })
    .from(councilAppointments)
    .where(
      and(
        eq(councilAppointments.accountId, accountId),
        isNull(councilAppointments.revokedAt),
      ),
    );

  return {
    accountId: account.id,
    lifecycleState: account.lifecycleState,
    synthetic: account.synthetic,
    platformRoles: roles.map((row) => row.role as PlatformRole),
    councilRoles: seats.map((row) => row.councilRole as CouncilRole),
  };
}
