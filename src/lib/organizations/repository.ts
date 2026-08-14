import { and, eq } from "drizzle-orm";

import {
  organizationServiceAreas,
  organizations,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationRecord } from "@/lib/organizations/types";

function mapOrg(row: {
  id: string;
  publicId: string;
  slug: string;
  displayName: string;
  serviceStatus: OrganizationRecord["serviceStatus"];
  synthetic: boolean;
}): OrganizationRecord {
  return {
    id: row.id,
    publicId: row.publicId,
    slug: row.slug,
    displayName: row.displayName,
    serviceStatus: row.serviceStatus,
    synthetic: row.synthetic,
  };
}

export async function getOrganization(
  db: FoundationDb,
  organizationId: string,
): Promise<OrganizationRecord | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return row ? mapOrg(row) : null;
}

export async function getOrganizationByPublicId(
  db: FoundationDb,
  organizationId: string,
  publicId: string,
): Promise<OrganizationRecord | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(organizations)
    .where(
      and(eq(organizations.id, id), eq(organizations.publicId, publicId)),
    )
    .limit(1);
  return row ? mapOrg(row) : null;
}

export async function listServiceAreaRegionCodes(
  db: FoundationDb,
  organizationId: string,
): Promise<string[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select({ regionCode: organizationServiceAreas.regionCode })
    .from(organizationServiceAreas)
    .where(eq(organizationServiceAreas.organizationId, id));
  return rows.map((row) => row.regionCode);
}

export async function insertOrganization(
  db: FoundationDb,
  input: {
    id: string;
    publicId: string;
    slug: string;
    displayName: string;
    serviceStatus: OrganizationRecord["serviceStatus"];
    synthetic: boolean;
    regionCodes: string[];
  },
): Promise<OrganizationRecord> {
  const organizationId = requireOrganizationId(input.id);
  await db.insert(organizations).values({
    id: organizationId,
    publicId: input.publicId,
    slug: input.slug,
    displayName: input.displayName,
    serviceStatus: input.serviceStatus,
    synthetic: input.synthetic,
  });
  for (const regionCode of input.regionCodes) {
    await db.insert(organizationServiceAreas).values({
      id: `${organizationId}-area-${regionCode}`,
      organizationId,
      regionCode,
      synthetic: input.synthetic,
    });
  }
  const created = await getOrganization(db, organizationId);
  if (!created) {
    throw new Error("ORGANIZATION_INSERT_FAILED");
  }
  return created;
}
