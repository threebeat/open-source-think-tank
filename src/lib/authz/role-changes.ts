import { and, eq, isNull } from "drizzle-orm";

import { councilAppointments, roleAssignments } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { CouncilRole, PlatformRole } from "@/lib/authz/types";

function requireReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    return "A substantive reason (at least 8 characters) is required.";
  }
  return null;
}

export async function grantPlatformRole(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    subjectAccountId: string;
    role: PlatformRole;
    reason: string;
  },
): Promise<AdapterResult<{ assignmentId: string }>> {
  const reasonError = requireReason(input.reason);
  if (reasonError) {
    return { ok: false, error: reasonError, code: "AUTHZ_REASON_REQUIRED" };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = authorize(actor, "roles.grant_platform");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  if (
    input.role === "administrator" &&
    input.actorAccountId === input.subjectAccountId
  ) {
    return {
      ok: false,
      error: "Administrators cannot grant themselves administrator.",
      code: "AUTHZ_SELF_ELEVATION_FORBIDDEN",
    };
  }

  const subject = await loadPrincipal(db, input.subjectAccountId);
  if (!subject) {
    return { ok: false, error: "Subject account not found", code: "AUTHZ_SUBJECT_MISSING" };
  }

  if (subject.platformRoles.includes(input.role)) {
    return {
      ok: false,
      error: "Subject already holds this platform role.",
      code: "AUTHZ_ROLE_ALREADY_HELD",
    };
  }

  const assignmentId = newEntityId("role");
  await db.transaction(async (tx) => {
    await tx.insert(roleAssignments).values({
      id: assignmentId,
      accountId: input.subjectAccountId,
      role: input.role,
      grantedByLabel: input.actorAccountId,
      reason: input.reason.trim(),
    });

    await appendAuthAudit(tx, {
      actorRole: "administrator",
      actorAccountId: input.actorAccountId,
      action: "authz.platform_role_granted",
      subjectType: "account",
      subjectId: input.subjectAccountId,
      summary: `Platform role ${input.role} granted.`,
      reason: input.reason.trim(),
      privatePayload: { role: input.role, assignmentId },
      synthetic: subject.synthetic,
    });
  });

  return { ok: true, value: { assignmentId } };
}

export async function grantCouncilSeat(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    subjectAccountId: string;
    councilRole: CouncilRole;
    reason: string;
    selectionPath: string;
  },
): Promise<AdapterResult<{ appointmentId: string }>> {
  const reasonError = requireReason(input.reason);
  if (reasonError) {
    return { ok: false, error: reasonError, code: "AUTHZ_REASON_REQUIRED" };
  }

  if (!input.selectionPath.trim()) {
    return {
      ok: false,
      error: "selectionPath is required for council appointments.",
      code: "AUTHZ_SELECTION_PATH_REQUIRED",
    };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = authorize(actor, "roles.grant_council");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  if (input.actorAccountId === input.subjectAccountId) {
    return {
      ok: false,
      error:
        "Administrators cannot grant themselves institutional council authority.",
      code: "AUTHZ_SELF_ELEVATION_FORBIDDEN",
    };
  }

  const subject = await loadPrincipal(db, input.subjectAccountId);
  if (!subject) {
    return { ok: false, error: "Subject account not found", code: "AUTHZ_SUBJECT_MISSING" };
  }

  if (subject.councilRoles.includes(input.councilRole)) {
    return {
      ok: false,
      error: "Subject already holds this council seat.",
      code: "AUTHZ_SEAT_ALREADY_HELD",
    };
  }

  const appointmentId = newEntityId("council");
  await db.transaction(async (tx) => {
    await tx.insert(councilAppointments).values({
      id: appointmentId,
      accountId: input.subjectAccountId,
      councilRole: input.councilRole,
      selectionPath: input.selectionPath.trim(),
      termStartsOn: new Date(),
    });

    await appendAuthAudit(tx, {
      actorRole: "administrator",
      actorAccountId: input.actorAccountId,
      action: "authz.council_seat_granted",
      subjectType: "account",
      subjectId: input.subjectAccountId,
      summary: `Council seat ${input.councilRole} granted.`,
      reason: input.reason.trim(),
      privatePayload: {
        councilRole: input.councilRole,
        appointmentId,
      },
      synthetic: subject.synthetic,
    });
  });

  return { ok: true, value: { appointmentId } };
}

export async function revokePlatformRole(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    subjectAccountId: string;
    role: PlatformRole;
    reason: string;
  },
): Promise<AdapterResult<{ assignmentId: string }>> {
  const reasonError = requireReason(input.reason);
  if (reasonError) {
    return { ok: false, error: reasonError, code: "AUTHZ_REASON_REQUIRED" };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = authorize(actor, "roles.revoke_platform");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const subject = await loadPrincipal(db, input.subjectAccountId);
  if (!subject) {
    return { ok: false, error: "Subject account not found", code: "AUTHZ_SUBJECT_MISSING" };
  }

  const [row] = await db
    .select()
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.accountId, input.subjectAccountId),
        eq(roleAssignments.role, input.role),
        isNull(roleAssignments.revokedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error: "No active assignment for that role.",
      code: "AUTHZ_ROLE_NOT_HELD",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(roleAssignments)
      .set({
        revokedAt: new Date(),
        revocationReason: input.reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(roleAssignments.id, row.id));

    await appendAuthAudit(tx, {
      actorRole: "administrator",
      actorAccountId: input.actorAccountId,
      action: "authz.platform_role_revoked",
      subjectType: "account",
      subjectId: input.subjectAccountId,
      summary: `Platform role ${input.role} revoked.`,
      reason: input.reason.trim(),
      privatePayload: { role: input.role, assignmentId: row.id },
      synthetic: subject.synthetic,
    });
  });

  return { ok: true, value: { assignmentId: row.id } };
}
