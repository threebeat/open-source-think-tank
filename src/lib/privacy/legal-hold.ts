import { and, eq, isNull } from "drizzle-orm";

import { legalHolds } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";

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

  if (await hasActiveLegalHold(db, input.subjectType, input.subjectId)) {
    return {
      ok: false,
      error: "Active legal hold already exists for subject",
      code: "LEGAL_HOLD_EXISTS",
    };
  }

  const id = newEntityId("hold");
  await db.insert(legalHolds).values({
    id,
    subjectType: input.subjectType.trim(),
    subjectId: input.subjectId.trim(),
    reason: input.reason.trim(),
    placedByAccountId: input.actorAccountId,
    synthetic: decision.principal.synthetic,
  });

  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "privacy.legal_hold_placed",
    subjectType: input.subjectType.trim(),
    subjectId: input.subjectId.trim(),
    summary: "Legal hold placed (staff-restricted).",
    reason: input.reason.trim(),
    privatePayload: { holdId: id },
    synthetic: decision.principal.synthetic,
  });

  return { ok: true, value: { id } };
}

export async function releaseLegalHold(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    holdId: string;
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

  const [row] = await db
    .select()
    .from(legalHolds)
    .where(and(eq(legalHolds.id, input.holdId), isNull(legalHolds.releasedAt)))
    .limit(1);
  if (!row) {
    return {
      ok: false,
      error: "Active legal hold not found",
      code: "LEGAL_HOLD_NOT_FOUND",
    };
  }

  await db
    .update(legalHolds)
    .set({
      releasedAt: new Date(),
      releasedByAccountId: input.actorAccountId,
    })
    .where(eq(legalHolds.id, row.id));

  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "privacy.legal_hold_released",
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    summary: "Legal hold released (staff-restricted).",
    reason: input.reason.trim(),
    privatePayload: { holdId: row.id },
    synthetic: decision.principal.synthetic && row.synthetic,
  });

  return { ok: true, value: { id: row.id } };
}
