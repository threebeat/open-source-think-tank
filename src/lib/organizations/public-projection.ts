import type { OrganizationPublicProjection } from "@/lib/organizations/types";

const PUBLIC_ORG_KEYS = [
  "publicId",
  "slug",
  "displayName",
  "serviceStatus",
  "regionCodes",
] as const;

const FORBIDDEN_PUBLIC_KEYS = [
  "id",
  "accountId",
  "xid",
  "providerConversationRef",
  "privateNote",
  "staffNotes",
  "latitude",
  "longitude",
  "street",
  "ideology",
  "agreement",
] as const;

export function projectOrganizationPublic(input: {
  publicId: string;
  slug: string;
  displayName: string;
  serviceStatus: OrganizationPublicProjection["serviceStatus"];
  regionCodes: string[];
}): OrganizationPublicProjection {
  return {
    publicId: input.publicId,
    slug: input.slug,
    displayName: input.displayName,
    serviceStatus: input.serviceStatus,
    regionCodes: [...input.regionCodes],
  };
}

export function assertOrganizationPublicAllowlist(
  projection: Record<string, unknown>,
): void {
  for (const key of Object.keys(projection)) {
    if (!(PUBLIC_ORG_KEYS as readonly string[]).includes(key)) {
      throw new Error(`ORGANIZATION_PUBLIC_DTO_FORBIDDEN_KEY:${key}`);
    }
  }
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (key in projection) {
      throw new Error(`ORGANIZATION_PUBLIC_DTO_FORBIDDEN_KEY:${key}`);
    }
  }
}
