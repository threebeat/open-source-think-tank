import { and, eq } from "drizzle-orm";

import { accounts, roleAssignments } from "@/db/schema";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit, type AuthAuditDb } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { assertActivationTransition } from "@/lib/auth/lifecycle";
import {
  evaluateActivationGates,
  lockAccountForActivation,
} from "@/lib/onboarding/gates";

export type ActivateAccountInput = {
  accountId: string;
  /**
   * Test-only seam: runs inside the transaction after gate evaluation and
   * before the lifecycle update, so races can be injected on the same executor.
   */
  afterEvaluate?: (tx: AuthAuditDb) => Promise<void>;
};

/**
 * Sole production path: pending_onboarding → active after assent + verification
 * gates, re-checked inside one transaction. Real accounts are blocked while
 * applicable counsel dispositions remain blocking (alpha-test clearances in dispositions.ts).
 */
export async function activateAccount(
  db: AuthAuditDb,
  input: ActivateAccountInput,
): Promise<AdapterResult<{ accountId: string; activatedAt: string }>> {
  const now = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      const locked = await lockAccountForActivation(tx, input.accountId);
      if (!locked) {
        throw new Error("ONBOARD_ACCOUNT_MISSING");
      }

      if (locked.lifecycleState === "active") {
        throw new Error("ONBOARD_ALREADY_ACTIVE");
      }

      try {
        assertActivationTransition(locked.lifecycleState, "active");
      } catch {
        throw new Error("ONBOARD_LIFECYCLE");
      }

      const gates = await evaluateActivationGates(tx, input.accountId, now, {
        forUpdate: true,
      });
      if (!gates) {
        throw new Error("ONBOARD_ACCOUNT_MISSING");
      }

      if (gates.counselBlocksReal) {
        throw new Error("ONBOARD_COUNSEL_GATE_BLOCKED");
      }

      if (!gates.canActivate) {
        throw new Error(
          `ONBOARD_GATES_INCOMPLETE:${gates.blockingReasons.join(" ")}`,
        );
      }

      if (input.afterEvaluate) {
        await input.afterEvaluate(tx);
        const again = await evaluateActivationGates(tx, input.accountId, now, {
          forUpdate: true,
        });
        if (!again?.canActivate) {
          if (again?.counselBlocksReal) {
            throw new Error("ONBOARD_COUNSEL_GATE_BLOCKED");
          }
          throw new Error(
            `ONBOARD_GATES_INCOMPLETE:${again?.blockingReasons.join(" ") ?? "stale gates"}`,
          );
        }
      }

      const [updated] = await tx
        .update(accounts)
        .set({
          lifecycleState: "active",
          activatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(accounts.id, input.accountId),
            eq(accounts.lifecycleState, "pending_onboarding"),
            eq(accounts.synthetic, gates.synthetic),
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("ONBOARD_ACTIVATE_CONFLICT");
      }
      if (!updated.synthetic && gates.counselBlocksReal) {
        // Belt-and-suspenders: never activate a real account under blocking counsel.
        throw new Error("ONBOARD_COUNSEL_GATE_BLOCKED");
      }

      const existingParticipant = await tx
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.accountId, input.accountId),
            eq(roleAssignments.role, "participant"),
          ),
        );
      const activeParticipant = existingParticipant.find((row) => !row.revokedAt);
      if (!activeParticipant) {
        await tx.insert(roleAssignments).values({
          id: newEntityId("role"),
          accountId: input.accountId,
          role: "participant",
          grantedByLabel: "onboarding.activate",
          reason:
            "Granted on activation as delegate / account holder for the alpha-test foundation (ADR 0007).",
        });
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.accountId,
        action: "onboarding.activated",
        subjectType: "account",
        subjectId: input.accountId,
        summary:
          "Account activated after transactional assent, verification, and counsel checks (alpha-test delegate / account holder).",
        privatePayload: {
          evaluatedAt: gates.evaluatedAt,
          synthetic: updated.synthetic,
          approvedKinds: gates.approvedKinds,
          documentsComplete: gates.documentsComplete,
          counselBlocksReal: gates.counselBlocksReal,
        },
        synthetic: updated.synthetic,
      });

      return {
        accountId: updated.id,
        activatedAt: now.toISOString(),
      };
    });

    return { ok: true, value: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ONBOARD_ACCOUNT_MISSING") {
      return {
        ok: false,
        error: "Account not found",
        code: "ONBOARD_ACCOUNT_MISSING",
      };
    }
    if (message === "ONBOARD_ALREADY_ACTIVE") {
      return {
        ok: false,
        error: "Account is already active.",
        code: "ONBOARD_ALREADY_ACTIVE",
      };
    }
    if (message === "ONBOARD_LIFECYCLE") {
      return {
        ok: false,
        error: "Account is not pending_onboarding.",
        code: "ONBOARD_LIFECYCLE",
      };
    }
    if (message === "ONBOARD_COUNSEL_GATE_BLOCKED") {
      return {
        ok: false,
        error:
          "Real accounts cannot become active while applicable counsel gates remain blocking. Synthetic fixtures may activate for engineering only.",
        code: "ONBOARD_COUNSEL_GATE_BLOCKED",
      };
    }
    if (message.startsWith("ONBOARD_GATES_INCOMPLETE")) {
      const detail = message.slice("ONBOARD_GATES_INCOMPLETE:".length);
      return {
        ok: false,
        error: detail || "Onboarding gates incomplete.",
        code: "ONBOARD_GATES_INCOMPLETE",
      };
    }
    if (message === "ONBOARD_ACTIVATE_CONFLICT") {
      return {
        ok: false,
        error: "Activation conflict — account is no longer pending_onboarding.",
        code: "ONBOARD_ACTIVATE_CONFLICT",
      };
    }
    throw error;
  }
}
