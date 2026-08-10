import { and, eq, isNull, sql } from "drizzle-orm";

import { legalHolds } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  lockApprovedDualControl,
  markDualControlExecuted,
} from "@/lib/privacy/dual-control";
import { lockPrivacySubject } from "@/lib/privacy/subject-lock";

export async function hasActiveLegalHold(
  db: FoundationDb,
  subjectType: string,
  subjectId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: legalHolds.id })
    .from(legalHolds)
    .where(
      and(
        eq(legalHolds.subjectType, subjectType),
        eq(legalHolds.subjectId, subjectId),
        isNull(legalHolds.releasedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function placeLegalHold(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    subjectType: string;
    subjectId: string;
    reason: string;
  },
): Promise<AdapterResult<{ id: string }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Legal holds unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_LEGAL_HOLD",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Legal hold requires a reason",
      code: "LEGAL_HOLD_REASON_REQUIRED",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.manage_legal_hold",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const subjectType = input.subjectType.trim();
  const subjectId = input.subjectId.trim();
  const id = newEntityId("hold");
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      await lockPrivacySubject(tx, subjectType, subjectId);

      const [existing] = await tx
        .select({ id: legalHolds.id })
        .from(legalHolds)
        .where(
          and(
            eq(legalHolds.subjectType, subjectType),
            eq(legalHolds.subjectId, subjectId),
            isNull(legalHolds.releasedAt),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          ok: false as const,
          error: "Active legal hold already exists for subject",
          code: "LEGAL_HOLD_EXISTS",
        };
      }

      await tx.insert(legalHolds).values({
        id,
        subjectType,
        subjectId,
        reason: input.reason.trim(),
        placedByAccountId: input.actorAccountId,
        placedAt: now,
        synthetic: decision.principal.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "privacy.legal_hold_placed",
        subjectType,
        subjectId,
        summary: "Legal hold placed (staff-restricted).",
        reason: input.reason.trim(),
        privatePayload: { holdId: id },
        synthetic: decision.principal.synthetic,
        at: now,
      });

      return { ok: true as const, value: { id } };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Legal hold placement failed and was rolled back",
      code: "LEGAL_HOLD_TX_FAILED",
    };
  }
}

/**
 * Release requires an approved dual-control request whose payload matches
 * `{ holdId }` exactly. Claim + release + audit are one transaction.
 */
export async function releaseLegalHold(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    holdId: string;
    reason: string;
    dualControlRequestId: string;
  },
): Promise<AdapterResult<{ id: string }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Legal holds unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_LEGAL_HOLD",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Legal hold release requires a reason",
      code: "LEGAL_HOLD_REASON_REQUIRED",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.manage_legal_hold",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  try {
    return await db.transaction(async (tx) => {
      // Dual-control first so replay surfaces ALREADY_EXECUTED before hold lookup.
      const locked = await lockApprovedDualControl(tx, {
        dualControlRequestId: input.dualControlRequestId,
        action: "privacy.release_legal_hold",
        expectedPayload: { holdId: input.holdId },
      });
      if (!locked.ok) {
        return locked;
      }

      await tx.execute(
        sql`SELECT id FROM legal_holds WHERE id = ${input.holdId} FOR UPDATE`,
      );

      const [row] = await tx
        .select()
        .from(legalHolds)
        .where(
          and(eq(legalHolds.id, input.holdId), isNull(legalHolds.releasedAt)),
        )
        .limit(1);
      if (!row) {
        return {
          ok: false as const,
          error: "Active legal hold not found",
          code: "LEGAL_HOLD_NOT_FOUND",
        };
      }

      await lockPrivacySubject(tx, row.subjectType, row.subjectId);

      const claim = await markDualControlExecuted(tx, locked.value.id);
      if (!claim.ok) {
        return claim;
      }

      const now = new Date();
      await tx
        .update(legalHolds)
        .set({
          releasedAt: now,
          releasedByAccountId: input.actorAccountId,
        })
        .where(eq(legalHolds.id, row.id));

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "privacy.legal_hold_released",
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        summary: "Legal hold released (staff-restricted).",
        reason: input.reason.trim(),
        privatePayload: {
          holdId: row.id,
          dualControlRequestId: claim.value.id,
        },
        synthetic: decision.principal.synthetic && row.synthetic,
        at: now,
      });

      return { ok: true as const, value: { id: row.id } };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Legal hold release failed and was rolled back",
      code: "LEGAL_HOLD_TX_FAILED",
    };
  }
}
