import { newEntityId } from "@/lib/auth/tokens";

/** Opaque public organization identifier — never a sequential/guessable number. */
export function newOrganizationPublicId(): string {
  return newEntityId("orgpub");
}

export function newOrganizationId(): string {
  return newEntityId("org");
}

/**
 * Every organization repository/service read or write requires an organization
 * id. There is no list-all default.
 */
export function requireOrganizationId(
  organizationId: string | null | undefined,
): string {
  if (typeof organizationId !== "string" || organizationId.trim().length === 0) {
    throw new Error("ORGANIZATION_ID_REQUIRED");
  }
  return organizationId.trim();
}
