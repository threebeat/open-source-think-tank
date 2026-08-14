export const ORGANIZATION_APPOINTMENT_KINDS = [
  "chamber_member",
  "chamber_clerk",
  "council_member",
  "council_clerk",
  "moderator",
  "organization_admin",
] as const;

export type OrganizationAppointmentKind =
  (typeof ORGANIZATION_APPOINTMENT_KINDS)[number];

export const ORGANIZATION_CAPABILITIES = [
  "organization.membership.read",
  "organization.appointment.grant",
  "organization.appointment.revoke",
  "organization.config.publish",
  "organization.governance.transition",
] as const;

export type OrganizationCapability =
  (typeof ORGANIZATION_CAPABILITIES)[number];

export const ORGANIZATION_MEMBERSHIP_STATUSES = [
  "assigned",
  "active",
  "suspended",
  "closed",
  "appeal_pending",
] as const;

export type OrganizationMembershipStatus =
  (typeof ORGANIZATION_MEMBERSHIP_STATUSES)[number];

export type OrganizationPublicProjection = {
  publicId: string;
  slug: string;
  displayName: string;
  serviceStatus: "proposed" | "seeded_synthetic" | "disabled";
  regionCodes: string[];
};

export type OrganizationRecord = {
  id: string;
  publicId: string;
  slug: string;
  displayName: string;
  serviceStatus: "proposed" | "seeded_synthetic" | "disabled";
  synthetic: boolean;
};

export type OrganizationConfigRecord = {
  id: string;
  organizationId: string;
  version: number;
  constitutionalFloorVersion: string;
  config: Record<string, unknown>;
  status: "draft" | "published" | "superseded";
  publishedAt: Date | null;
  publishedByAccountId: string | null;
  synthetic: boolean;
};
