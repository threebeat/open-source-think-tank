import { and, eq, isNull } from "drizzle-orm";

import { accounts, conversationPseudonyms } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import {
  assertPseudonymNotDerivedFrom,
  generateConversationPseudonym,
} from "@/lib/pseudonym/generate";
import {
  assertConversationPurposeMatch,
  lockRegisteredClosedConversation,
} from "@/lib/pseudonym/registry";
import { resolvePseudonymExpiry } from "@/lib/pseudonym/rules";

export type IssuedPseudonym = {
  id: string;
  pseudonym: string;
  conversationId: string;
  expiresAt: string;
};

async function loadAccountSynthetic(
  db: FoundationDb | DrizzleTx,
  accountId: string,
): Promise<{ synthetic: boolean } | null> {
  const [row] = await db
    .select({ synthetic: accounts.synthetic })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row ?? null;
}

async function mintUniquePseudonym(
  db: FoundationDb | DrizzleTx,
  forbidden: Array<string | null | undefined>,
): Promise<string> {
  let pseudonym = generateConversationPseudonym();
  assertPseudonymNotDerivedFrom(pseudonym, forbidden);
  const [collision] = await db
    .select({ id: conversationPseudonyms.id })
    .from(conversationPseudonyms)
    .where(eq(conversationPseudonyms.pseudonym, pseudonym))
    .limit(1);
  if (collision) {
    pseudonym = generateConversationPseudonym();
    assertPseudonymNotDerivedFrom(pseudonym, forbidden);
  }
  return pseudonym;
}

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conversation pseudonyms are unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PSEUDONYMS",
    };
  }
  return null;
}

/**
 * Issue (or return existing active) conversation-scoped pseudonym.
 * Mapping mutation and audit append share one transaction.
 */
export async function issueConversationPseudonym(
  db: FoundationDb,
  input: {
    accountId: string;
    conversationId: string;
    actorAccountId: string;
    purpose?: string;
    ttlMs?: number;
    requestCorrelationId?: string | null;
  },
): Promise<AdapterResult<IssuedPseudonym>> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
  }

  if (input.actorAccountId !== input.accountId) {
    return {
      ok: false,
      error: "Accounts may only issue their own conversation pseudonyms",
      code: "PSEUDONYM_SELF_ONLY",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const registered = await lockRegisteredClosedConversation(
        tx,
        input.conversationId,
      );
      if (!registered.ok) {
        return {
          ok: false as const,
          error: registered.error,
          code: registered.code,
        };
      }

      const purposeCheck = await assertConversationPurposeMatch(
        registered.conversation.purpose,
        input.purpose,
      );
      if (!purposeCheck.ok) {
        return {
          ok: false as const,
          error: purposeCheck.error,
          code: purposeCheck.code,
        };
      }

      const account = await loadAccountSynthetic(tx, input.accountId);
      if (!account) {
        return {
          ok: false as const,
          error: "Account not found",
          code: "PSEUDONYM_ACCOUNT_NOT_FOUND",
        };
      }

      const conversationId = registered.conversation.id;
      const [existing] = await tx
        .select()
        .from(conversationPseudonyms)
        .where(
          and(
            eq(conversationPseudonyms.conversationId, conversationId),
            eq(conversationPseudonyms.accountId, input.accountId),
            isNull(conversationPseudonyms.deletedAt),
            isNull(conversationPseudonyms.rotatedAt),
          ),
        )
        .limit(1);

      if (existing && existing.expiresAt.getTime() > Date.now()) {
        return {
          ok: true as const,
          value: {
            id: existing.id,
            pseudonym: existing.pseudonym,
            conversationId: existing.conversationId,
            expiresAt: existing.expiresAt.toISOString(),
          },
        };
      }

      if (existing) {
        await tx
          .update(conversationPseudonyms)
          .set({ deletedAt: new Date() })
          .where(eq(conversationPseudonyms.id, existing.id));
      }

      const issuedAt = new Date();
      const expiresAt = resolvePseudonymExpiry(issuedAt, input.ttlMs);
      const id = newEntityId("cpsp");
      const pseudonym = await mintUniquePseudonym(tx, [
        input.accountId,
        conversationId,
      ]);

      await tx.insert(conversationPseudonyms).values({
        id,
        conversationId,
        accountId: input.accountId,
        pseudonym,
        purpose: purposeCheck.purpose,
        issuedAt,
        expiresAt,
        synthetic: account.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.actorAccountId,
        action: "pseudonym.issued",
        subjectType: "conversation_pseudonym",
        subjectId: id,
        summary: "Conversation-scoped consultation pseudonym issued.",
        privatePayload: {
          conversationId,
          purpose: purposeCheck.purpose,
          expiresAt: expiresAt.toISOString(),
        },
        requestCorrelationId: input.requestCorrelationId,
        synthetic: account.synthetic,
        at: issuedAt,
      });

      return {
        ok: true as const,
        value: {
          id,
          pseudonym,
          conversationId,
          expiresAt: expiresAt.toISOString(),
        },
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Pseudonym issuance failed and was rolled back",
      code: "PSEUDONYM_TX_FAILED",
    };
  }
}

export async function rotateConversationPseudonym(
  db: FoundationDb,
  input: {
    accountId: string;
    conversationId: string;
    actorAccountId: string;
    reason: string;
    requestCorrelationId?: string | null;
  },
): Promise<AdapterResult<IssuedPseudonym>> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
  }
  if (input.actorAccountId !== input.accountId) {
    return {
      ok: false,
      error: "Accounts may only rotate their own conversation pseudonyms",
      code: "PSEUDONYM_SELF_ONLY",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Rotation requires a reason",
      code: "PSEUDONYM_REASON_REQUIRED",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const registered = await lockRegisteredClosedConversation(
        tx,
        input.conversationId,
      );
      if (!registered.ok) {
        return {
          ok: false as const,
          error: registered.error,
          code: registered.code,
        };
      }

      const [existing] = await tx
        .select()
        .from(conversationPseudonyms)
        .where(
          and(
            eq(
              conversationPseudonyms.conversationId,
              registered.conversation.id,
            ),
            eq(conversationPseudonyms.accountId, input.accountId),
            isNull(conversationPseudonyms.deletedAt),
            isNull(conversationPseudonyms.rotatedAt),
          ),
        )
        .limit(1);
      if (!existing) {
        return {
          ok: false as const,
          error: "No active pseudonym to rotate",
          code: "PSEUDONYM_NOT_FOUND",
        };
      }

      const newId = newEntityId("cpsp");
      const pseudonym = await mintUniquePseudonym(tx, [
        input.accountId,
        registered.conversation.id,
      ]);
      const issuedAt = new Date();
      const expiresAt = resolvePseudonymExpiry(issuedAt);

      // Free the active unique pair before inserting the replacement.
      // superseded_by_id FK is DEFERRABLE so the new row can be inserted next.
      await tx
        .update(conversationPseudonyms)
        .set({
          rotatedAt: issuedAt,
          supersededById: newId,
        })
        .where(eq(conversationPseudonyms.id, existing.id));

      await tx.insert(conversationPseudonyms).values({
        id: newId,
        conversationId: existing.conversationId,
        accountId: existing.accountId,
        pseudonym,
        purpose: existing.purpose,
        issuedAt,
        expiresAt,
        synthetic: existing.synthetic,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.actorAccountId,
        action: "pseudonym.rotated",
        subjectType: "conversation_pseudonym",
        subjectId: newId,
        summary: "Conversation-scoped consultation pseudonym rotated.",
        reason: input.reason.trim(),
        privatePayload: {
          priorId: existing.id,
          conversationId: existing.conversationId,
        },
        requestCorrelationId: input.requestCorrelationId,
        synthetic: existing.synthetic,
        at: issuedAt,
      });

      return {
        ok: true as const,
        value: {
          id: newId,
          pseudonym,
          conversationId: existing.conversationId,
          expiresAt: expiresAt.toISOString(),
        },
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Pseudonym rotation failed and was rolled back",
      code: "PSEUDONYM_TX_FAILED",
    };
  }
}

export async function deleteConversationPseudonym(
  db: FoundationDb,
  input: {
    accountId: string;
    conversationId: string;
    actorAccountId: string;
    reason: string;
    requestCorrelationId?: string | null;
  },
): Promise<AdapterResult<{ id: string }>> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
  }
  if (input.actorAccountId !== input.accountId) {
    return {
      ok: false,
      error: "Accounts may only delete their own conversation pseudonyms",
      code: "PSEUDONYM_SELF_ONLY",
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Deletion requires a reason",
      code: "PSEUDONYM_REASON_REQUIRED",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const registered = await lockRegisteredClosedConversation(
        tx,
        input.conversationId,
      );
      if (!registered.ok) {
        return {
          ok: false as const,
          error: registered.error,
          code: registered.code,
        };
      }

      const [existing] = await tx
        .select()
        .from(conversationPseudonyms)
        .where(
          and(
            eq(
              conversationPseudonyms.conversationId,
              registered.conversation.id,
            ),
            eq(conversationPseudonyms.accountId, input.accountId),
            isNull(conversationPseudonyms.deletedAt),
            isNull(conversationPseudonyms.rotatedAt),
          ),
        )
        .limit(1);
      if (!existing) {
        return {
          ok: false as const,
          error: "No active pseudonym to delete",
          code: "PSEUDONYM_NOT_FOUND",
        };
      }

      const deletedAt = new Date();
      await tx
        .update(conversationPseudonyms)
        .set({ deletedAt })
        .where(eq(conversationPseudonyms.id, existing.id));

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: input.actorAccountId,
        action: "pseudonym.deleted",
        subjectType: "conversation_pseudonym",
        subjectId: existing.id,
        summary: "Conversation-scoped consultation pseudonym deleted.",
        reason: input.reason.trim(),
        privatePayload: { conversationId: existing.conversationId },
        requestCorrelationId: input.requestCorrelationId,
        synthetic: existing.synthetic,
        at: deletedAt,
      });

      return { ok: true as const, value: { id: existing.id } };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Pseudonym deletion failed and was rolled back",
      code: "PSEUDONYM_TX_FAILED",
    };
  }
}
