import { and, eq, isNull, sql } from "drizzle-orm";

import { councilAppointments, roleAssignments } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { classifyMultiAccountSynthetic } from "@/lib/authz/synthetic-classification";
import type { CouncilRole, PlatformRole } from "@/lib/authz/types";

function requireReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    return "A substantive reason (at least 8 characters) is required.";
  }
  return null;
}

async function countActiveRoleHolders(
  db: FoundationDb,
  role: PlatformRole,
): Promise<number> {
  const rows = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(
      and(eq(roleAssignments.role, role), isNull(roleAssignments.revokedAt)),
    );
  return rows.length;
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
  const decision = await authorizeCapability(
    db,
    actor,
    "roles.grant_platform",
  );
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
    return {
      ok: false,
      error: "Subject account not found",
      code: "AUTHZ_SUBJECT_MISSING",
    };
  }

  if (subject.platformRoles.includes(input.role)) {
    return {
      ok: false,
      error: "Subject already holds this platform role.",
      code: "AUTHZ_ROLE_ALREADY_HELD",
    };
  }

  const assignmentId = newEntityId("role");
  const synthetic = classifyMultiAccountSynthetic(
    decision.principal.synthetic,
    subject.synthetic,
  );

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
      privatePayload: {
        role: input.role,
        assignmentId,
        actorSynthetic: decision.principal.synthetic,
        subjectSynthetic: subject.synthetic,
      },
      synthetic,
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
  const decision = await authorizeCapability(
    db,
    actor,
    "roles.grant_council",
  );
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
    return {
      ok: false,
      error: "Subject account not found",
      code: "AUTHZ_SUBJECT_MISSING",
    };
  }

  if (subject.councilRoles.includes(input.councilRole)) {
    return {
      ok: false,
      error: "Subject already holds this council seat.",
      code: "AUTHZ_SEAT_ALREADY_HELD",
    };
  }

  const appointmentId = newEntityId("council");
  const synthetic = classifyMultiAccountSynthetic(
    decision.principal.synthetic,
    subject.synthetic,
  );

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
        actorSynthetic: decision.principal.synthetic,
        subjectSynthetic: subject.synthetic,
      },
      synthetic,
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
  const decision = await authorizeCapability(
    db,
    actor,
    "roles.revoke_platform",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const subject = await loadPrincipal(db, input.subjectAccountId);
  if (!subject) {
    return {
      ok: false,
      error: "Subject account not found",
      code: "AUTHZ_SUBJECT_MISSING",
    };
  }

  if (
    input.role === "administrator" &&
    input.actorAccountId === input.subjectAccountId
  ) {
    return {
      ok: false,
      error: "Administrators cannot revoke their own administrator role.",
      code: "AUTHZ_SELF_CONTINUITY_FORBIDDEN",
    };
  }

  if (input.role === "administrator") {
    const adminCount = await countActiveRoleHolders(db, "administrator");
    if (adminCount <= 1) {
      return {
        ok: false,
        error: "Cannot revoke the last active administrator.",
        code: "AUTHZ_LAST_ADMIN_FORBIDDEN",
      };
    }
  }

  if (input.role === "auditor") {
    const auditorCount = await countActiveRoleHolders(db, "auditor");
    if (auditorCount <= 1) {
      return {
        ok: false,
        error: "Cannot revoke the last active auditor.",
        code: "AUTHZ_LAST_AUDITOR_FORBIDDEN",
      };
    }
  }

  const now = new Date();
  const synthetic = classifyMultiAccountSynthetic(
    decision.principal.synthetic,
    subject.synthetic,
  );

  try {
    const assignmentId = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(roleAssignments)
        .set({
          revokedAt: now,
          revocationReason: input.reason.trim(),
          updatedAt: now,
        })
        .where(
          and(
            eq(roleAssignments.accountId, input.subjectAccountId),
            eq(roleAssignments.role, input.role),
            isNull(roleAssignments.revokedAt),
          ),
        )
        .returning();

      if (!claimed) {
        throw new Error("AUTHZ_ROLE_NOT_HELD");
      }

      // Re-check continuity inside the transaction for concurrent revokes.
      if (input.role === "administrator" || input.role === "auditor") {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(roleAssignments)
          .where(
            and(
              eq(roleAssignments.role, input.role),
              isNull(roleAssignments.revokedAt),
            ),
          );
        if (count < 1) {
          throw new Error(
            input.role === "administrator"
              ? "AUTHZ_LAST_ADMIN_FORBIDDEN"
              : "AUTHZ_LAST_AUDITOR_FORBIDDEN",
          );
        }
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "authz.platform_role_revoked",
        subjectType: "account",
        subjectId: input.subjectAccountId,
        summary: `Platform role ${input.role} revoked.`,
        reason: input.reason.trim(),
        privatePayload: {
          role: input.role,
          assignmentId: claimed.id,
          actorSynthetic: decision.principal.synthetic,
          subjectSynthetic: subject.synthetic,
        },
        synthetic,
      });

      return claimed.id;
    });

    return { ok: true, value: { assignmentId } };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHZ_ROLE_NOT_HELD") {
      return {
        ok: false,
        error: "No active assignment for that role.",
        code: "AUTHZ_ROLE_NOT_HELD",
      };
    }
    if (
      error instanceof Error &&
      (error.message === "AUTHZ_LAST_ADMIN_FORBIDDEN" ||
        error.message === "AUTHZ_LAST_AUDITOR_FORBIDDEN")
    ) {
      return {
        ok: false,
        error:
          error.message === "AUTHZ_LAST_ADMIN_FORBIDDEN"
            ? "Cannot revoke the last active administrator."
            : "Cannot revoke the last active auditor.",
        code: error.message,
      };
    }
    throw error;
  }
}

export async function revokeCouncilSeat(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    subjectAccountId: string;
    councilRole: CouncilRole;
    reason: string;
  },
): Promise<AdapterResult<{ appointmentId: string }>> {
  const reasonError = requireReason(input.reason);
  if (reasonError) {
    return { ok: false, error: reasonError, code: "AUTHZ_REASON_REQUIRED" };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "roles.revoke_council",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  if (input.actorAccountId === input.subjectAccountId) {
    return {
      ok: false,
      error:
        "Administrators cannot revoke their own institutional council authority.",
      code: "AUTHZ_SELF_CONTINUITY_FORBIDDEN",
    };
  }

  const subject = await loadPrincipal(db, input.subjectAccountId);
  if (!subject) {
    return {
      ok: false,
      error: "Subject account not found",
      code: "AUTHZ_SUBJECT_MISSING",
    };
  }

  const now = new Date();
  const synthetic = classifyMultiAccountSynthetic(
    decision.principal.synthetic,
    subject.synthetic,
  );

  try {
    const appointmentId = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(councilAppointments)
        .set({
          revokedAt: now,
          revocationReason: input.reason.trim(),
          updatedAt: now,
        })
        .where(
          and(
            eq(councilAppointments.accountId, input.subjectAccountId),
            eq(councilAppointments.councilRole, input.councilRole),
            isNull(councilAppointments.revokedAt),
          ),
        )
        .returning();

      if (!claimed) {
        throw new Error("AUTHZ_SEAT_NOT_HELD");
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "authz.council_seat_revoked",
        subjectType: "account",
        subjectId: input.subjectAccountId,
        summary: `Council seat ${input.councilRole} revoked.`,
        reason: input.reason.trim(),
        privatePayload: {
          councilRole: input.councilRole,
          appointmentId: claimed.id,
          actorSynthetic: decision.principal.synthetic,
          subjectSynthetic: subject.synthetic,
        },
        synthetic,
      });

      return claimed.id;
    });

    return { ok: true, value: { appointmentId } };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHZ_SEAT_NOT_HELD") {
      return {
        ok: false,
        error: "No active appointment for that council seat.",
        code: "AUTHZ_SEAT_NOT_HELD",
      };
    }
    throw error;
  }
}
