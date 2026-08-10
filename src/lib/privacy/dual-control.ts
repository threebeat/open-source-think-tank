import { and, eq, sql } from "drizzle-orm";

import { dualControlRequests } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { canonicalizeForDigest } from "@/lib/audit/continuity";
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

export function payloadsMatch(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  return (
    JSON.stringify(canonicalizeForDigest(expected)) ===
    JSON.stringify(canonicalizeForDigest(actual))
  );
}

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Dual control unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_DUAL_CONTROL",
    };
  }
  return null;
}

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
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
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

  try {
    return await db.transaction(async (tx) => {
      await tx.insert(dualControlRequests).values({
        id,
        action: input.action,
        payload: input.payload,
        status: "pending",
        requestedByAccountId: input.actorAccountId,
        reason: input.reason.trim(),
        expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS)),
        synthetic: decision.principal.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "privacy.dual_control_requested",
        subjectType: "dual_control_request",
        subjectId: id,
        summary: "Dual-control approval requested.",
        reason: input.reason.trim(),
        privatePayload: { action: input.action },
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
          : "Dual-control request failed and was rolled back",
      code: "DUAL_CONTROL_TX_FAILED",
    };
  }
}

/**
 * Atomically approve a pending request (FOR UPDATE + conditional update).
 * Concurrent approvers: exactly one wins.
 */
export async function approveDualControl(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    requestId: string;
    reason: string;
  },
): Promise<
  AdapterResult<{ id: string; action: string; payload: Record<string, unknown> }>
> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
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

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM dual_control_requests WHERE id = ${input.requestId} FOR UPDATE`,
      );

      const [row] = await tx
        .select()
        .from(dualControlRequests)
        .where(eq(dualControlRequests.id, input.requestId))
        .limit(1);
      if (!row || row.status !== "pending") {
        return {
          ok: false as const,
          error: "Pending dual-control request not found",
          code: "DUAL_CONTROL_NOT_FOUND",
        };
      }
      if (row.requestedByAccountId === input.actorAccountId) {
        return {
          ok: false as const,
          error: "Requester cannot approve their own dual-control request",
          code: "DUAL_CONTROL_SELF_APPROVE",
        };
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        await tx
          .update(dualControlRequests)
          .set({ status: "expired", resolvedAt: new Date() })
          .where(
            and(
              eq(dualControlRequests.id, row.id),
              eq(dualControlRequests.status, "pending"),
            ),
          );
        return {
          ok: false as const,
          error: "Dual-control request expired",
          code: "DUAL_CONTROL_EXPIRED",
        };
      }

      const [approved] = await tx
        .update(dualControlRequests)
        .set({
          status: "approved",
          approvedByAccountId: input.actorAccountId,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(dualControlRequests.id, row.id),
            eq(dualControlRequests.status, "pending"),
          ),
        )
        .returning();
      if (!approved) {
        return {
          ok: false as const,
          error: "Dual-control request already resolved",
          code: "DUAL_CONTROL_CONFLICT",
        };
      }

      await appendAuthAudit(tx, {
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
        ok: true as const,
        value: {
          id: row.id,
          action: row.action,
          payload: row.payload,
        },
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Dual-control approval failed and was rolled back",
      code: "DUAL_CONTROL_TX_FAILED",
    };
  }
}

/**
 * Lock and validate an approved, unexpired dual-control request (FOR UPDATE).
 * Does not mark executed — call {@link markDualControlExecuted} after the
 * operation’s preconditions succeed, still inside the same transaction.
 */
export async function lockApprovedDualControl(
  tx: DrizzleTx,
  input: {
    dualControlRequestId: string;
    action: DualControlAction;
    expectedPayload: Record<string, unknown>;
  },
): Promise<AdapterResult<{ id: string }>> {
  if (!input.dualControlRequestId?.trim()) {
    return {
      ok: false,
      error: "Dual-control request id is required to execute this operation",
      code: "DUAL_CONTROL_REQUIRED",
    };
  }

  await tx.execute(
    sql`SELECT id FROM dual_control_requests WHERE id = ${input.dualControlRequestId} FOR UPDATE`,
  );

  const [row] = await tx
    .select()
    .from(dualControlRequests)
    .where(eq(dualControlRequests.id, input.dualControlRequestId.trim()))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error: "Dual-control request not found",
      code: "DUAL_CONTROL_NOT_FOUND",
    };
  }
  if (row.status === "executed") {
    return {
      ok: false,
      error: "Dual-control request was already executed",
      code: "DUAL_CONTROL_ALREADY_EXECUTED",
    };
  }
  if (row.status !== "approved") {
    return {
      ok: false,
      error: `Dual-control request is ${row.status}, not approved`,
      code: "DUAL_CONTROL_NOT_APPROVED",
    };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await tx
      .update(dualControlRequests)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(dualControlRequests.id, row.id));
    return {
      ok: false,
      error: "Dual-control request expired",
      code: "DUAL_CONTROL_EXPIRED",
    };
  }
  if (row.action !== input.action) {
    return {
      ok: false,
      error: "Dual-control action does not match the operation",
      code: "DUAL_CONTROL_ACTION_MISMATCH",
    };
  }
  if (!payloadsMatch(input.expectedPayload, row.payload)) {
    return {
      ok: false,
      error: "Dual-control payload does not match the operation",
      code: "DUAL_CONTROL_PAYLOAD_MISMATCH",
    };
  }
  if (!row.approvedByAccountId) {
    return {
      ok: false,
      error: "Dual-control request has no approver",
      code: "DUAL_CONTROL_NOT_APPROVED",
    };
  }
  if (row.approvedByAccountId === row.requestedByAccountId) {
    return {
      ok: false,
      error: "Dual-control approver must differ from requester",
      code: "DUAL_CONTROL_SELF_APPROVE",
    };
  }

  return { ok: true, value: { id: row.id } };
}

/** Conditional approved → executed claim. Row must already be locked. */
export async function markDualControlExecuted(
  tx: DrizzleTx,
  requestId: string,
): Promise<AdapterResult<{ id: string }>> {
  const [claimed] = await tx
    .update(dualControlRequests)
    .set({ status: "executed", resolvedAt: new Date() })
    .where(
      and(
        eq(dualControlRequests.id, requestId),
        eq(dualControlRequests.status, "approved"),
      ),
    )
    .returning();

  if (!claimed) {
    return {
      ok: false,
      error: "Dual-control request could not be claimed for execution",
      code: "DUAL_CONTROL_CLAIM_FAILED",
    };
  }

  return { ok: true, value: { id: claimed.id } };
}

/**
 * Lock, validate, and mark executed in one step. Prefer lock → preconditions →
 * {@link markDualControlExecuted} when a failed precondition must not consume
 * the approval, or when replay must surface ALREADY_EXECUTED before other errors.
 */
export async function claimApprovedDualControl(
  tx: DrizzleTx,
  input: {
    dualControlRequestId: string;
    action: DualControlAction;
    expectedPayload: Record<string, unknown>;
    actorAccountId: string;
  },
): Promise<AdapterResult<{ id: string }>> {
  const locked = await lockApprovedDualControl(tx, input);
  if (!locked.ok) {
    return locked;
  }
  return markDualControlExecuted(tx, locked.value.id);
}
