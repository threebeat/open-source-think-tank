import { and, eq } from "drizzle-orm";

import { organizationMembershipEvents, organizationMemberships } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationMembershipStatus } from "@/lib/organizations/types";

export async function listMembershipsForOrganization(
  db: FoundationDb,
  organizationId: string,
): Promise<
  Array<{
    id: string;
    organizationId: string;
    accountId: string;
    status: OrganizationMembershipStatus;
    isPrimary: boolean;
  }>
> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      accountId: organizationMemberships.accountId,
      status: organizationMemberships.status,
      isPrimary: organizationMemberships.isPrimary,
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, id));
  return rows;
}

export async function listMembershipsForAccount(
  db: FoundationDb,
  accountId: string,
): Promise<
  Array<{
    organizationId: string;
    status: OrganizationMembershipStatus;
    isPrimary: boolean;
  }>
> {
  if (!accountId.trim()) {
    throw new Error("ACCOUNT_ID_REQUIRED");
  }
  const rows = await db
    .select({
      organizationId: organizationMemberships.organizationId,
      status: organizationMemberships.status,
      isPrimary: organizationMemberships.isPrimary,
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.accountId, accountId));
  return rows;
}

export async function listMembershipEventsForAccount(
  db: FoundationDb,
  accountId: string,
): Promise<
  Array<{
    id: string;
    organizationId: string;
    eventKind: string;
    reason: string | null;
    ruleVersion: string;
    at: Date;
  }>
> {
  if (!accountId.trim()) {
    throw new Error("ACCOUNT_ID_REQUIRED");
  }
  const rows = await db
    .select({
      id: organizationMembershipEvents.id,
      organizationId: organizationMembershipEvents.organizationId,
      eventKind: organizationMembershipEvents.eventKind,
      reason: organizationMembershipEvents.reason,
      ruleVersion: organizationMembershipEvents.ruleVersion,
      at: organizationMembershipEvents.at,
    })
    .from(organizationMembershipEvents)
    .where(eq(organizationMembershipEvents.accountId, accountId));
  return rows;
}

export async function getPrimaryCommunityMembership(
  db: FoundationDb,
  accountId: string,
): Promise<{
  organizationId: string;
  status: OrganizationMembershipStatus;
  isPrimary: boolean;
} | null> {
  const rows = await listMembershipsForAccount(db, accountId);
  const eligible = rows.filter(
    (row) => row.status === "assigned" || row.status === "active",
  );
  return (
    eligible.find((row) => row.isPrimary) ??
    eligible[0] ??
    null
  );
}

export function hasCommunityMembershipInOrganization(
  memberships: Array<{
    organizationId: string;
    status: OrganizationMembershipStatus | string;
  }>,
  organizationId: string,
): boolean {
  const id = requireOrganizationId(organizationId);
  return memberships.some(
    (row) =>
      row.organizationId === id &&
      (row.status === "assigned" || row.status === "active"),
  );
}

export async function getMembership(
  db: FoundationDb,
  organizationId: string,
  membershipId: string,
) {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, id),
        eq(organizationMemberships.id, membershipId),
      ),
    )
    .limit(1);
  return row ?? null;
}
