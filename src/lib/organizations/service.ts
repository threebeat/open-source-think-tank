import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import {
  authorizeOrganization,
  type OrganizationAuthzPrincipal,
} from "@/lib/authz/organization-context";
import type { FoundationDb } from "@/db/types";
import {
  CONSTITUTIONAL_FLOOR_VERSION,
  validateConstitutionalFloor,
} from "@/lib/organizations/constitutional-floor";
import {
  insertConfigVersion,
  listConfigVersions,
  publishConfigVersion,
} from "@/lib/organizations/config-repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import {
  getOrganization,
  listServiceAreaRegionCodes,
} from "@/lib/organizations/repository";
import type { OrganizationPublicProjection } from "@/lib/organizations/types";
import { projectOrganizationPublic } from "@/lib/organizations/public-projection";
import { assertOrganizationMutationAllowed } from "@/lib/v2/flags";

export async function readOrganizationPublic(
  db: FoundationDb,
  organizationId: string,
): Promise<AdapterResult<OrganizationPublicProjection>> {
  const id = requireOrganizationId(organizationId);
  const org = await getOrganization(db, id);
  if (!org) {
    return {
      ok: false,
      code: "ORGANIZATION_NOT_FOUND",
      error: "Organization not found",
    };
  }
  const regionCodes = await listServiceAreaRegionCodes(db, id);
  return {
    ok: true,
    value: projectOrganizationPublic({ ...org, regionCodes }),
  };
}

export async function publishOrganizationConfig(
  db: FoundationDb,
  input: {
    principal: OrganizationAuthzPrincipal;
    organizationId: string;
    config: Record<string, unknown>;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ configVersionId: string; version: number }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const decision = authorizeOrganization(
    input.principal,
    organizationId,
    "organization.config.publish",
  );
  if (!decision.ok) {
    return {
      ok: false,
      code: decision.code,
      error: decision.error,
    };
  }

  const floor = validateConstitutionalFloor(input.config, {
    synthetic: input.synthetic,
  });
  if (!floor.ok) {
    return floor;
  }

  const org = await getOrganization(db, organizationId);
  if (!org) {
    return {
      ok: false,
      code: "ORGANIZATION_NOT_FOUND",
      error: "Organization not found",
    };
  }

  const versions = await listConfigVersions(db, organizationId);
  const nextVersion =
    versions.reduce((max, row) => Math.max(max, row.version), 0) + 1;
  const configVersionId = newEntityId("orgcfg");
  const now = new Date();

  await insertConfigVersion(db, {
    id: configVersionId,
    organizationId,
    version: nextVersion,
    constitutionalFloorVersion: CONSTITUTIONAL_FLOOR_VERSION,
    config: floor.value,
    status: "draft",
    synthetic: input.synthetic,
  });

  const published = await publishConfigVersion(db, {
    organizationId,
    configVersionId,
    publishedAt: now,
    publishedByAccountId: input.principal.accountId,
  });
  if (!published) {
    return {
      ok: false,
      code: "CONFIG_PUBLISH_FAILED",
      error: "Failed to publish organization config",
    };
  }

  await appendAuthAudit(db, {
    actorRole: "organization_officer",
    actorAccountId: input.principal.accountId,
    action: "organization.config.published",
    subjectType: "organization",
    subjectId: organizationId,
    summary: "An organization configuration version was published.",
    reason: "Organization admin published a constitutional-floor config version.",
    privatePayload: {
      organizationPublicId: org.publicId,
      configVersionId,
      version: nextVersion,
      capability: "organization.config.publish",
    },
    synthetic: input.synthetic,
    organizationId,
    actorPrincipalKind: "organization_officer",
    capability: "organization.config.publish",
    projectionClass: "protected",
  });

  return {
    ok: true,
    value: { configVersionId, version: nextVersion },
  };
}
