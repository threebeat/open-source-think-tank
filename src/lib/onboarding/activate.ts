import { and, eq } from "drizzle-orm";

import { accounts, roleAssignments } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { assertActivationTransition } from "@/lib/auth/lifecycle";
import { getOnboardingProgress } from "@/lib/onboarding/progress";

/**
 * Sole production path: pending_onboarding → active after assent + verification gates.
 * Grants participant platform role when missing (community participant — not statutory membership).
 */
export async function activateAccount(
  db: FoundationDb,
  input: { accountId: string },
): Promise<AdapterResult<{ accountId: string; activatedAt: string }>> {
  const progress = await getOnboardingProgress(db, input.accountId);
  if (!progress) {
    return {
      ok: false,
      error: "Account not found",
      code: "ONBOARD_ACCOUNT_MISSING",
    };
  }

  if (progress.lifecycleState === "active") {
    return {
      ok: false,
      error: "Account is already active.",
      code: "ONBOARD_ALREADY_ACTIVE",
    };
  }

  if (!progress.canActivate) {
    return {
      ok: false,
      error: progress.blockingReasons.join(" ") || "Onboarding gates incomplete.",
      code: "ONBOARD_GATES_INCOMPLETE",
    };
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account) {
    return {
      ok: false,
      error: "Account not found",
      code: "ONBOARD_ACCOUNT_MISSING",
    };
  }

  try {
    assertActivationTransition(account.lifecycleState, "active");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid lifecycle transition",
      code: "ONBOARD_LIFECYCLE",
    };
  }

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
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
          ),
        )
        .returning();
      if (!updated) {
        throw new Error("ONBOARD_ACTIVATE_CONFLICT");
      }

      const existingParticipant = await tx
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.accountId, input.accountId),
            eq(roleAssignments.role, "participant"),
          ),
        )
        .limit(1);
      const activeParticipant = existingParticipant.find((row) => !row.revokedAt);
      if (!activeParticipant) {
        await tx.insert(roleAssignments).values({
          id: newEntityId("role"),
          accountId: input.accountId,
          role: "participant",
          grantedByLabel: "onboarding.activate",
          reason:
            "Granted on activation as community participant (not a statutory membership claim).",
        });
      }

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.accountId,
        action: "onboarding.activated",
        subjectType: "account",
        subjectId: input.accountId,
        summary:
          "Account activated after assent and verification gates (community participant / account holder).",
        privatePayload: {
          steps: progress.steps.map((step) => ({
            id: step.id,
            status: step.status,
          })),
        },
        synthetic: updated.synthetic,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ONBOARD_ACTIVATE_CONFLICT") {
      return {
        ok: false,
        error: "Activation conflict — account is no longer pending_onboarding.",
        code: "ONBOARD_ACTIVATE_CONFLICT",
      };
    }
    throw error;
  }

  return {
    ok: true,
    value: { accountId: input.accountId, activatedAt: now.toISOString() },
  };
}
