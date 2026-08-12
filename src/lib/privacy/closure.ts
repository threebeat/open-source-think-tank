import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  accountDeletionRequests,
  accounts,
  assentRecords,
  auditEvents,
  authSessions,
  legalHolds,
} from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
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
import { RETENTION_RULES } from "@/lib/privacy/retention-rules";
import { lockPrivacySubject } from "@/lib/privacy/subject-lock";
import { operationalSubjectRef, securityLog } from "@/lib/security/log";

export const CLOSURE_WORKFLOWS = [
  "account_request",
  "administrator_initiated",
] as const;

export type ClosureWorkflow = (typeof CLOSURE_WORKFLOWS)[number];

const EXECUTABLE_DELETION_STATUSES = [
  "pending",
  "approved_pending_hold",
  "blocked_by_hold",
] as const;

type ExecutableDeletionStatus = (typeof EXECUTABLE_DELETION_STATUSES)[number];

function isClosureWorkflow(value: unknown): value is ClosureWorkflow {
  return (
    typeof value === "string" &&
    (CLOSURE_WORKFLOWS as readonly string[]).includes(value)
  );
}

/**
 * Account holder requests closure/deletion. Does not destroy audit or assent.
 */
export async function requestAccountClosure(
  db: FoundationDb,
  input: { accountId: string; actorAccountId: string; reason: string },
): Promise<AdapterResult<{ requestId: string; status: string }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Closure requests unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_CLOSURE",
    };
  }
  if (input.accountId !== input.actorAccountId) {
    return {
      ok: false,
      error: "Accounts may only request closure for themselves",
      code: "CLOSURE_SELF_ONLY",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Closure request requires a reason",
      code: "CLOSURE_REASON_REQUIRED",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "account.request_closure",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const requestId = newEntityId("delreq");
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);
      if (!account) {
        return {
          ok: false as const,
          error: "Account not found",
          code: "ACCOUNT_NOT_FOUND",
        };
      }
      if (
        account.lifecycleState === "closed" ||
        account.lifecycleState === "anonymization-pending"
      ) {
        return {
          ok: false as const,
          error: "Account is already closed or pending anonymization",
          code: "CLOSURE_ALREADY_CLOSED",
        };
      }

      // Pre-check open requests so a unique-index conflict does not abort the
      // surrounding transaction (Postgres cannot return a domain error after).
      const [openRequest] = await tx
        .select({ id: accountDeletionRequests.id })
        .from(accountDeletionRequests)
        .where(
          and(
            eq(accountDeletionRequests.accountId, input.accountId),
            inArray(accountDeletionRequests.status, [
              ...EXECUTABLE_DELETION_STATUSES,
            ]),
          ),
        )
        .limit(1);
      if (openRequest) {
        return {
          ok: false as const,
          error: "An open closure/deletion request already exists",
          code: "CLOSURE_REQUEST_EXISTS",
        };
      }

      await tx.insert(accountDeletionRequests).values({
        id: requestId,
        accountId: input.accountId,
        status: "pending",
        reason: input.reason.trim(),
        requestedAt: now,
        synthetic: account.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.actorAccountId,
        action: "privacy.closure_requested",
        subjectType: "account",
        subjectId: input.accountId,
        summary: "Account closure/deletion requested.",
        reason: input.reason.trim(),
        privatePayload: { requestId, rule: RETENTION_RULES.closure },
        synthetic: account.synthetic,
        at: now,
      });

      return {
        ok: true as const,
        value: { requestId, status: "pending" },
      };
    });
  } catch (error) {
    const pgCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : null;
    // Unique open-request race (partial unique index) — stable domain error.
    if (pgCode === "23505") {
      return {
        ok: false,
        error: "An open closure/deletion request already exists",
        code: "CLOSURE_REQUEST_EXISTS",
      };
    }

    // Keep precise failure detail in redacted security telemetry only.
    securityLog({
      level: "error",
      event: "privacy.closure_request_failed",
      subjectRef: operationalSubjectRef(input.accountId),
      details: {
        code: "CLOSURE_TX_FAILED",
        failureClass:
          error instanceof Error ? error.name.slice(0, 64) : "unknown",
        pgCode,
      },
    });
    return {
      ok: false,
      error:
        "Could not submit the closure request. Your account was not closed.",
      code: "CLOSURE_TX_FAILED",
    };
  }
}

async function loadExecutableDeletionRequest(
  tx: DrizzleTx,
  accountId: string,
  deletionRequestId: string,
): Promise<
  AdapterResult<{ id: string; status: ExecutableDeletionStatus }>
> {
  const [row] = await tx
    .select({
      id: accountDeletionRequests.id,
      accountId: accountDeletionRequests.accountId,
      status: accountDeletionRequests.status,
    })
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.id, deletionRequestId),
        eq(accountDeletionRequests.accountId, accountId),
        inArray(accountDeletionRequests.status, [...EXECUTABLE_DELETION_STATUSES]),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error:
        "Deletion request not found for this account, or not in an executable status",
      code: "CLOSURE_REQUEST_MISMATCH",
    };
  }

  return {
    ok: true,
    value: {
      id: row.id,
      status: row.status as ExecutableDeletionStatus,
    },
  };
}

/**
 * Execute closure under dual control.
 *
 * - `account_request`: requires `deletionRequestId` bound to `accountId` in an
 *   executable status; dual-control payload must include workflow + both ids.
 * - `administrator_initiated`: distinct workflow with no deletion request id;
 *   does not mutate another account’s deletion rows.
 */
export async function executeAccountClosure(
  db: FoundationDb,
  input: {
    accountId: string;
    actorAccountId: string;
    reason: string;
    dualControlRequestId: string;
    workflow: ClosureWorkflow;
    deletionRequestId?: string;
  },
): Promise<AdapterResult<{ accountId: string; workflow: ClosureWorkflow }>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Closure unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_CLOSURE",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Closure execution requires a reason",
      code: "CLOSURE_REASON_REQUIRED",
    };
  }
  if (!isClosureWorkflow(input.workflow)) {
    return {
      ok: false,
      error: "Closure workflow must be account_request or administrator_initiated",
      code: "CLOSURE_WORKFLOW_REQUIRED",
    };
  }

  if (input.workflow === "account_request") {
    if (!input.deletionRequestId?.trim()) {
      return {
        ok: false,
        error: "account_request closure requires deletionRequestId",
        code: "CLOSURE_REQUEST_REQUIRED",
      };
    }
  } else if (input.deletionRequestId) {
    return {
      ok: false,
      error:
        "administrator_initiated closure must not include deletionRequestId — use account_request workflow",
      code: "CLOSURE_WORKFLOW_INVALID",
    };
  }

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.execute_closure",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const expectedPayload: Record<string, unknown> = {
    workflow: input.workflow,
    accountId: input.accountId,
  };
  if (input.workflow === "account_request") {
    expectedPayload.deletionRequestId = input.deletionRequestId!.trim();
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Dual-control first so replay surfaces ALREADY_EXECUTED before other errors.
      const locked = await lockApprovedDualControl(tx, {
        dualControlRequestId: input.dualControlRequestId,
        action: "privacy.execute_closure",
        expectedPayload,
      });
      if (!locked.ok) {
        return locked;
      }

      await lockPrivacySubject(tx, "account", input.accountId);

      let deletionRequest: { id: string } | null = null;
      if (input.workflow === "account_request") {
        const loaded = await loadExecutableDeletionRequest(
          tx,
          input.accountId,
          input.deletionRequestId!.trim(),
        );
        if (!loaded.ok) {
          return loaded;
        }
        deletionRequest = { id: loaded.value.id };
      }

      const [activeHold] = await tx
        .select({ id: legalHolds.id })
        .from(legalHolds)
        .where(
          and(
            eq(legalHolds.subjectType, "account"),
            eq(legalHolds.subjectId, input.accountId),
            isNull(legalHolds.releasedAt),
          ),
        )
        .limit(1);
      if (activeHold) {
        if (deletionRequest) {
          await tx
            .update(accountDeletionRequests)
            .set({ status: "blocked_by_hold" })
            .where(
              and(
                eq(accountDeletionRequests.id, deletionRequest.id),
                eq(accountDeletionRequests.accountId, input.accountId),
                inArray(accountDeletionRequests.status, [
                  ...EXECUTABLE_DELETION_STATUSES,
                ]),
              ),
            );
        }
        return {
          ok: false as const,
          error: "Active legal hold blocks closure",
          code: "CLOSURE_BLOCKED_BY_HOLD",
        };
      }

      const [account] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);
      if (!account) {
        return {
          ok: false as const,
          error: "Account not found",
          code: "ACCOUNT_NOT_FOUND",
        };
      }
      if (
        account.lifecycleState === "closed" ||
        account.lifecycleState === "anonymization-pending"
      ) {
        return {
          ok: false as const,
          error: "Account is already closed or pending anonymization",
          code: "CLOSURE_ALREADY_CLOSED",
        };
      }

      const claim = await markDualControlExecuted(tx, locked.value.id);
      if (!claim.ok) {
        return claim;
      }

      const assentCount = await tx
        .select({ id: assentRecords.id })
        .from(assentRecords)
        .where(eq(assentRecords.accountId, input.accountId));
      const auditCount = await tx
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(eq(auditEvents.actorAccountId, input.accountId));

      const now = new Date();
      await tx
        .update(authSessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(authSessions.accountId, input.accountId),
            isNull(authSessions.revokedAt),
          ),
        );

      await tx
        .update(accounts)
        .set({
          lifecycleState: "closed",
          closedAt: now,
          revocationReason: input.reason.trim(),
        })
        .where(eq(accounts.id, input.accountId));

      if (deletionRequest) {
        const [closedRequest] = await tx
          .update(accountDeletionRequests)
          .set({ status: "closed", resolvedAt: now })
          .where(
            and(
              eq(accountDeletionRequests.id, deletionRequest.id),
              eq(accountDeletionRequests.accountId, input.accountId),
              inArray(accountDeletionRequests.status, [
                ...EXECUTABLE_DELETION_STATUSES,
              ]),
            ),
          )
          .returning();
        if (!closedRequest) {
          throw new Error("CLOSURE_REQUEST_UPDATE_FAILED");
        }
      }

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "privacy.account_closed",
        subjectType: "account",
        subjectId: input.accountId,
        summary:
          "Account closed; assent and audit history retained (no silent destruction).",
        reason: input.reason.trim(),
        privatePayload: {
          retainedAssentRows: assentCount.length,
          retainedActorAuditRows: auditCount.length,
          dualControlRequestId: claim.value.id,
          workflow: input.workflow,
          rule: RETENTION_RULES.closure,
        },
        synthetic: decision.principal.synthetic && account.synthetic,
        at: now,
      });

      const assentAfter = await tx
        .select({ id: assentRecords.id })
        .from(assentRecords)
        .where(eq(assentRecords.accountId, input.accountId));
      if (assentAfter.length !== assentCount.length) {
        throw new Error("CLOSURE_DESTROYED_ASSENT");
      }

      return {
        ok: true as const,
        value: { accountId: input.accountId, workflow: input.workflow },
      };
    });

    if (result.ok) {
      securityLog({
        level: "info",
        event: "privacy.account_closed",
        subjectRef: operationalSubjectRef(input.accountId),
        details: {
          actorRef: operationalSubjectRef(input.actorAccountId),
          workflow: input.workflow,
        },
      });
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Closure execution failed and was rolled back",
      code: "CLOSURE_TX_FAILED",
    };
  }
}
