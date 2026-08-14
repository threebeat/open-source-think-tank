import { and, eq, isNull } from "drizzle-orm";

import {
  accounts,
  councilAppointments,
  organizationAppointments,
  organizationMemberships,
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

  const memberships = await db
    .select({
      organizationId: organizationMemberships.organizationId,
      status: organizationMemberships.status,
      isPrimary: organizationMemberships.isPrimary,
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.accountId, accountId));

  const appointments = await db
    .select({
      organizationId: organizationAppointments.organizationId,
      kind: organizationAppointments.appointmentKind,
      appointmentId: organizationAppointments.id,
      termStartsAt: organizationAppointments.termStartsAt,
      termEndsAt: organizationAppointments.termEndsAt,
    })
    .from(organizationAppointments)
    .where(
      and(
        eq(organizationAppointments.accountId, accountId),
        isNull(organizationAppointments.revokedAt),
      ),
    );

  const now = Date.now();
  const activeAppointments = appointments.filter((row) => {
    if (row.termStartsAt.getTime() > now) {
      return false;
    }
    if (row.termEndsAt && row.termEndsAt.getTime() <= now) {
      return false;
    }
    return true;
  });

  return {
    accountId: account.id,
    lifecycleState: account.lifecycleState,
    synthetic: account.synthetic,
    platformRoles: roles.map((row) => row.role as PlatformRole),
    councilRoles: seats.map((row) => row.councilRole as CouncilRole),
    organizationMemberships: memberships.map((row) => ({
      organizationId: row.organizationId,
      status: row.status,
      isPrimary: row.isPrimary,
    })),
    organizationAppointments: activeAppointments.map((row) => ({
      organizationId: row.organizationId,
      kind: row.kind,
      appointmentId: row.appointmentId,
    })),
  };
}
