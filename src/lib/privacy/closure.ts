import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  accountDeletionRequests,
  accounts,
  assentRecords,
  auditEvents,
  authSessions,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { hasActiveLegalHold } from "@/lib/privacy/legal-hold";
import { RETENTION_RULES } from "@/lib/privacy/retention-rules";
import { securityLog } from "@/lib/security/log";

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

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" };
  }
  if (
    account.lifecycleState === "closed" ||
    account.lifecycleState === "anonymization-pending"
  ) {
    return {
      ok: false,
      error: "Account is already closed or pending anonymization",
      code: "CLOSURE_ALREADY_CLOSED",
    };
  }

  const requestId = newEntityId("delreq");
  try {
    await db.insert(accountDeletionRequests).values({
      id: requestId,
      accountId: input.accountId,
      status: "pending",
      reason: input.reason.trim(),
      synthetic: account.synthetic,
    });
  } catch {
    return {
      ok: false,
      error: "An open closure/deletion request already exists",
      code: "CLOSURE_REQUEST_EXISTS",
    };
  }

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId: input.actorAccountId,
    action: "privacy.closure_requested",
    subjectType: "account",
    subjectId: input.accountId,
    summary: "Account closure/deletion requested.",
    reason: input.reason.trim(),
    privatePayload: { requestId, rule: RETENTION_RULES.closure },
    synthetic: account.synthetic,
  });

  return { ok: true, value: { requestId, status: "pending" } };
}

/**
 * Execute closure: revoke sessions, set lifecycle=closed, retain audit/assent.
 * Blocked by active legal hold. Destructive anonymization of real accounts is
 * refused while counsel gates remain blocking.
 */
export async function executeAccountClosure(
  db: FoundationDb,
  input: {
    accountId: string;
    actorAccountId: string;
    reason: string;
    requestId?: string;
  },
): Promise<AdapterResult<{ accountId: string }>> {
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

  const principal = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    principal,
    "privacy.execute_closure",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  if (await hasActiveLegalHold(db, "account", input.accountId)) {
    if (input.requestId) {
      await db
        .update(accountDeletionRequests)
        .set({ status: "blocked_by_hold" })
        .where(eq(accountDeletionRequests.id, input.requestId));
    }
    return {
      ok: false,
      error: "Active legal hold blocks closure",
      code: "CLOSURE_BLOCKED_BY_HOLD",
    };
  }

  return db.transaction(async (tx) => {
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

    if (input.requestId) {
      await tx
        .update(accountDeletionRequests)
        .set({ status: "closed", resolvedAt: now })
        .where(eq(accountDeletionRequests.id, input.requestId));
    } else {
      await tx
        .update(accountDeletionRequests)
        .set({ status: "closed", resolvedAt: now })
        .where(
          and(
            eq(accountDeletionRequests.accountId, input.accountId),
            inArray(accountDeletionRequests.status, [
              "pending",
              "approved_pending_hold",
              "blocked_by_hold",
            ]),
          ),
        );
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
        rule: RETENTION_RULES.closure,
      },
      synthetic: decision.principal.synthetic && account.synthetic,
      at: now,
    });

    securityLog({
      level: "info",
      event: "privacy.account_closed",
      accountId: input.accountId,
      details: { actorAccountId: input.actorAccountId },
    });

    // Post-condition: assent/audit rows still present.
    const assentAfter = await tx
      .select({ id: assentRecords.id })
      .from(assentRecords)
      .where(eq(assentRecords.accountId, input.accountId));
    if (assentAfter.length !== assentCount.length) {
      throw new Error("CLOSURE_DESTROYED_ASSENT");
    }

    return { ok: true as const, value: { accountId: input.accountId } };
  });
}
