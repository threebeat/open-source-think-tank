import { and, eq } from "drizzle-orm";

import { dualControlRequests } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";

export const DUAL_CONTROL_ACTIONS = [
  "privacy.release_legal_hold",
  "privacy.execute_closure",
] as const;

export type DualControlAction = (typeof DUAL_CONTROL_ACTIONS)[number];

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export async function requestDualControl(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    action: DualControlAction;
    payload: Record<string, unknown>;
    reason: string;
    ttlMs?: number;
  },
): Promise<AdapterResult<{ id: string }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Dual control unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_DUAL_CONTROL",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Dual-control request requires a reason",
      code: "DUAL_CONTROL_REASON_REQUIRED",
    };
  }
  if (!(DUAL_CONTROL_ACTIONS as readonly string[]).includes(input.action)) {
    return {
      ok: false,
      error: "Action is not dual-control eligible",
      code: "DUAL_CONTROL_ACTION_INVALID",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.dual_control_request",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const id = newEntityId("dual");
  const now = new Date();
  await db.insert(dualControlRequests).values({
    id,
    action: input.action,
    payload: input.payload,
    status: "pending",
    requestedByAccountId: input.actorAccountId,
    reason: input.reason.trim(),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS)),
    synthetic: decision.principal.synthetic,
  });

  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "privacy.dual_control_requested",
    subjectType: "dual_control_request",
    subjectId: id,
    summary: "Dual-control approval requested.",
    reason: input.reason.trim(),
    privatePayload: { action: input.action },
    synthetic: decision.principal.synthetic,
  });

  return { ok: true, value: { id } };
}

export async function approveDualControl(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    requestId: string;
    reason: string;
  },
): Promise<AdapterResult<{ id: string; action: string; payload: Record<string, unknown> }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Dual control unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_DUAL_CONTROL",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Dual-control approval requires a reason",
      code: "DUAL_CONTROL_REASON_REQUIRED",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.dual_control_approve",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [row] = await db
    .select()
    .from(dualControlRequests)
    .where(
      and(
        eq(dualControlRequests.id, input.requestId),
        eq(dualControlRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (!row) {
    return {
      ok: false,
      error: "Pending dual-control request not found",
      code: "DUAL_CONTROL_NOT_FOUND",
    };
  }
  if (row.requestedByAccountId === input.actorAccountId) {
    return {
      ok: false,
      error: "Requester cannot approve their own dual-control request",
      code: "DUAL_CONTROL_SELF_APPROVE",
    };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await db
      .update(dualControlRequests)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(dualControlRequests.id, row.id));
    return {
      ok: false,
      error: "Dual-control request expired",
      code: "DUAL_CONTROL_EXPIRED",
    };
  }

  await db
    .update(dualControlRequests)
    .set({
      status: "approved",
      approvedByAccountId: input.actorAccountId,
      resolvedAt: new Date(),
    })
    .where(eq(dualControlRequests.id, row.id));

  await appendAuthAudit(db, {
    actorRole: "administrator",
    actorAccountId: input.actorAccountId,
    action: "privacy.dual_control_resolved",
    subjectType: "dual_control_request",
    subjectId: row.id,
    summary: "Dual-control request approved.",
    reason: input.reason.trim(),
    privatePayload: { action: row.action, decision: "approved" },
    synthetic: decision.principal.synthetic && row.synthetic,
  });

  return {
    ok: true,
    value: {
      id: row.id,
      action: row.action,
      payload: row.payload,
    },
  };
}
