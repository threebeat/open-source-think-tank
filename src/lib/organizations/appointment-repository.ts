import { and, eq, isNull } from "drizzle-orm";

import { organizationAppointments } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationAppointmentKind } from "@/lib/organizations/types";

export type AppointmentRow = {
  id: string;
  organizationId: string;
  accountId: string;
  appointmentKind: OrganizationAppointmentKind;
  termStartsAt: Date;
  termEndsAt: Date | null;
  issuedByAccountId: string;
  revokedAt: Date | null;
};

function isActiveAt(row: AppointmentRow, at: Date): boolean {
  if (row.revokedAt) {
    return false;
  }
  if (row.termStartsAt.getTime() > at.getTime()) {
    return false;
  }
  if (row.termEndsAt && row.termEndsAt.getTime() <= at.getTime()) {
    return false;
  }
  return true;
}

export async function listAppointmentsForOrganization(
  db: FoundationDb,
  organizationId: string,
): Promise<AppointmentRow[]> {
  const id = requireOrganizationId(organizationId);
  return db
    .select({
      id: organizationAppointments.id,
      organizationId: organizationAppointments.organizationId,
      accountId: organizationAppointments.accountId,
      appointmentKind: organizationAppointments.appointmentKind,
      termStartsAt: organizationAppointments.termStartsAt,
      termEndsAt: organizationAppointments.termEndsAt,
      issuedByAccountId: organizationAppointments.issuedByAccountId,
      revokedAt: organizationAppointments.revokedAt,
    })
    .from(organizationAppointments)
    .where(eq(organizationAppointments.organizationId, id));
}

export async function listActiveAppointmentsForOrganization(
  db: FoundationDb,
  organizationId: string,
  kinds: readonly OrganizationAppointmentKind[],
  at: Date = new Date(),
): Promise<AppointmentRow[]> {
  const rows = await listAppointmentsForOrganization(db, organizationId);
  return rows.filter(
    (row) => kinds.includes(row.appointmentKind) && isActiveAt(row, at),
  );
}

export async function listActiveAppointmentsForAccount(
  db: FoundationDb,
  accountId: string,
  at: Date = new Date(),
): Promise<AppointmentRow[]> {
  if (!accountId.trim()) {
    throw new Error("ACCOUNT_ID_REQUIRED");
  }
  const rows = await db
    .select({
      id: organizationAppointments.id,
      organizationId: organizationAppointments.organizationId,
      accountId: organizationAppointments.accountId,
      appointmentKind: organizationAppointments.appointmentKind,
      termStartsAt: organizationAppointments.termStartsAt,
      termEndsAt: organizationAppointments.termEndsAt,
      issuedByAccountId: organizationAppointments.issuedByAccountId,
      revokedAt: organizationAppointments.revokedAt,
    })
    .from(organizationAppointments)
    .where(
      and(
        eq(organizationAppointments.accountId, accountId),
        isNull(organizationAppointments.revokedAt),
      ),
    );
  return rows.filter((row) => isActiveAt(row, at));
}

export async function insertAppointment(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    accountId: string;
    appointmentKind: OrganizationAppointmentKind;
    termStartsAt: Date;
    termEndsAt?: Date | null;
    issuedByAccountId: string;
    issuedByPrincipalKind:
      | "service_operator"
      | "organization_officer"
      | "community_member"
      | "system";
    synthetic: boolean;
  },
): Promise<AppointmentRow> {
  const organizationId = requireOrganizationId(input.organizationId);
  if (input.issuedByAccountId === input.accountId) {
    throw new Error("APPOINTMENT_SELF_GRANT_FORBIDDEN");
  }
  await db.insert(organizationAppointments).values({
    id: input.id,
    organizationId,
    accountId: input.accountId,
    appointmentKind: input.appointmentKind,
    termStartsAt: input.termStartsAt,
    termEndsAt: input.termEndsAt ?? null,
    issuedByAccountId: input.issuedByAccountId,
    issuedByPrincipalKind: input.issuedByPrincipalKind,
    synthetic: input.synthetic,
  });
  const [row] = await db
    .select({
      id: organizationAppointments.id,
      organizationId: organizationAppointments.organizationId,
      accountId: organizationAppointments.accountId,
      appointmentKind: organizationAppointments.appointmentKind,
      termStartsAt: organizationAppointments.termStartsAt,
      termEndsAt: organizationAppointments.termEndsAt,
      issuedByAccountId: organizationAppointments.issuedByAccountId,
      revokedAt: organizationAppointments.revokedAt,
    })
    .from(organizationAppointments)
    .where(
      and(
        eq(organizationAppointments.organizationId, organizationId),
        eq(organizationAppointments.id, input.id),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error("APPOINTMENT_INSERT_FAILED");
  }
  return row;
}

export async function revokeAppointment(
  db: FoundationDb,
  input: {
    organizationId: string;
    appointmentId: string;
    revokedAt: Date;
    revocationReason: string;
  },
): Promise<boolean> {
  const organizationId = requireOrganizationId(input.organizationId);
  const updated = await db
    .update(organizationAppointments)
    .set({
      revokedAt: input.revokedAt,
      revocationReason: input.revocationReason,
      updatedAt: input.revokedAt,
    })
    .where(
      and(
        eq(organizationAppointments.organizationId, organizationId),
        eq(organizationAppointments.id, input.appointmentId),
        isNull(organizationAppointments.revokedAt),
      ),
    )
    .returning();
  return updated.length > 0;
}
