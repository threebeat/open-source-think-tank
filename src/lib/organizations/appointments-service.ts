import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import {
  authorizeOrganization,
  type OrganizationAuthzPrincipal,
} from "@/lib/authz/organization-context";
import type { FoundationDb } from "@/db/types";
import {
  insertAppointment,
  revokeAppointment,
} from "@/lib/organizations/appointment-repository";
import { getOrganization } from "@/lib/organizations/repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationAppointmentKind } from "@/lib/organizations/types";
import { assertOrganizationMutationAllowed } from "@/lib/v2/flags";

export async function grantOrganizationAppointment(
  db: FoundationDb,
  input: {
    principal: OrganizationAuthzPrincipal;
    organizationId: string;
    subjectAccountId: string;
    appointmentKind: OrganizationAppointmentKind;
    termStartsAt: Date;
    termEndsAt?: Date | null;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ appointmentId: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const decision = authorizeOrganization(
    input.principal,
    organizationId,
    "organization.appointment.grant",
  );
  if (!decision.ok) {
    return { ok: false, code: decision.code, error: decision.error };
  }
  if (input.principal.accountId === input.subjectAccountId) {
    return {
      ok: false,
      code: "APPOINTMENT_SELF_GRANT_FORBIDDEN",
      error: "An actor cannot grant themselves an organization appointment",
    };
  }

  const org = await getOrganization(db, organizationId);
  if (!org) {
    return {
      ok: false,
      code: "ORGANIZATION_NOT_FOUND",
      error: "Organization not found",
    };
  }

  const appointmentId = newEntityId("orgappt");
  try {
    await insertAppointment(db, {
      id: appointmentId,
      organizationId,
      accountId: input.subjectAccountId,
      appointmentKind: input.appointmentKind,
      termStartsAt: input.termStartsAt,
      termEndsAt: input.termEndsAt ?? null,
      issuedByAccountId: input.principal.accountId,
      issuedByPrincipalKind: "organization_officer",
      synthetic: input.synthetic,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("organization_appointments_no_self_grant")) {
      return {
        ok: false,
        code: "APPOINTMENT_SELF_GRANT_FORBIDDEN",
        error: "Database rejected a self-grant appointment",
      };
    }
    throw error;
  }

  await appendAuthAudit(db, {
    actorRole: "organization_officer",
    actorAccountId: input.principal.accountId,
    action: "organization.appointment.granted",
    subjectType: "organization_appointment",
    subjectId: appointmentId,
    summary: "An organization appointment was granted.",
    reason: "Organization admin granted an appointment to another account.",
    privatePayload: {
      organizationPublicId: org.publicId,
      appointmentKind: input.appointmentKind,
      capability: "organization.appointment.grant",
    },
    synthetic: input.synthetic,
    organizationId,
    actorPrincipalKind: "organization_officer",
    capability: "organization.appointment.grant",
    projectionClass: "protected",
  });

  return { ok: true, value: { appointmentId } };
}

export async function revokeOrganizationAppointment(
  db: FoundationDb,
  input: {
    principal: OrganizationAuthzPrincipal;
    organizationId: string;
    appointmentId: string;
    reason: string;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ appointmentId: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const decision = authorizeOrganization(
    input.principal,
    organizationId,
    "organization.appointment.revoke",
  );
  if (!decision.ok) {
    return { ok: false, code: decision.code, error: decision.error };
  }
  const org = await getOrganization(db, organizationId);
  if (!org) {
    return {
      ok: false,
      code: "ORGANIZATION_NOT_FOUND",
      error: "Organization not found",
    };
  }
  const revoked = await revokeAppointment(db, {
    organizationId,
    appointmentId: input.appointmentId,
    revokedAt: new Date(),
    revocationReason: input.reason,
  });
  if (!revoked) {
    return {
      ok: false,
      code: "APPOINTMENT_NOT_FOUND",
      error: "Active appointment not found in this organization",
    };
  }
  await appendAuthAudit(db, {
    actorRole: "organization_officer",
    actorAccountId: input.principal.accountId,
    action: "organization.appointment.revoked",
    subjectType: "organization_appointment",
    subjectId: input.appointmentId,
    summary: "An organization appointment was revoked.",
    reason: input.reason,
    privatePayload: {
      organizationPublicId: org.publicId,
      capability: "organization.appointment.revoke",
    },
    synthetic: input.synthetic,
    organizationId,
    actorPrincipalKind: "organization_officer",
    capability: "organization.appointment.revoke",
    projectionClass: "protected",
  });
  return { ok: true, value: { appointmentId: input.appointmentId } };
}
