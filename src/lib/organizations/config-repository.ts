import { and, desc, eq } from "drizzle-orm";

import { organizationConfigVersions } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationConfigRecord } from "@/lib/organizations/types";

function mapConfig(row: {
  id: string;
  organizationId: string;
  version: number;
  constitutionalFloorVersion: string;
  config: Record<string, unknown>;
  status: OrganizationConfigRecord["status"];
  publishedAt: Date | null;
  publishedByAccountId: string | null;
  synthetic: boolean;
}): OrganizationConfigRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    version: row.version,
    constitutionalFloorVersion: row.constitutionalFloorVersion,
    config: row.config,
    status: row.status,
    publishedAt: row.publishedAt,
    publishedByAccountId: row.publishedByAccountId,
    synthetic: row.synthetic,
  };
}

export async function getConfigVersion(
  db: FoundationDb,
  organizationId: string,
  configVersionId: string,
): Promise<OrganizationConfigRecord | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(organizationConfigVersions)
    .where(
      and(
        eq(organizationConfigVersions.organizationId, id),
        eq(organizationConfigVersions.id, configVersionId),
      ),
    )
    .limit(1);
  return row ? mapConfig(row) : null;
}

export async function listConfigVersions(
  db: FoundationDb,
  organizationId: string,
): Promise<OrganizationConfigRecord[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select()
    .from(organizationConfigVersions)
    .where(eq(organizationConfigVersions.organizationId, id))
    .orderBy(desc(organizationConfigVersions.version));
  return rows.map(mapConfig);
}

export async function insertConfigVersion(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    version: number;
    constitutionalFloorVersion: string;
    config: Record<string, unknown>;
    status: OrganizationConfigRecord["status"];
    publishedAt?: Date | null;
    publishedByAccountId?: string | null;
    synthetic: boolean;
  },
): Promise<OrganizationConfigRecord> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(organizationConfigVersions).values({
    id: input.id,
    organizationId,
    version: input.version,
    constitutionalFloorVersion: input.constitutionalFloorVersion,
    config: input.config,
    status: input.status,
    publishedAt: input.publishedAt ?? null,
    publishedByAccountId: input.publishedByAccountId ?? null,
    synthetic: input.synthetic,
  });
  const created = await getConfigVersion(db, organizationId, input.id);
  if (!created) {
    throw new Error("CONFIG_INSERT_FAILED");
  }
  return created;
}

export async function publishConfigVersion(
  db: FoundationDb,
  input: {
    organizationId: string;
    configVersionId: string;
    publishedAt: Date;
    publishedByAccountId: string;
  },
): Promise<OrganizationConfigRecord | null> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db
    .update(organizationConfigVersions)
    .set({
      status: "superseded",
      updatedAt: input.publishedAt,
    })
    .where(
      and(
        eq(organizationConfigVersions.organizationId, organizationId),
        eq(organizationConfigVersions.status, "published"),
      ),
    );
  const [updated] = await db
    .update(organizationConfigVersions)
    .set({
      status: "published",
      publishedAt: input.publishedAt,
      publishedByAccountId: input.publishedByAccountId,
      updatedAt: input.publishedAt,
    })
    .where(
      and(
        eq(organizationConfigVersions.organizationId, organizationId),
        eq(organizationConfigVersions.id, input.configVersionId),
      ),
    )
    .returning();
  return updated ? mapConfig(updated) : null;
}
