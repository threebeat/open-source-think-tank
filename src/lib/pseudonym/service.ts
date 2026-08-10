import { and, eq, isNull } from "drizzle-orm";

import { accounts, conversationPseudonyms } from "@/db/schema";
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
  CLOSED_TEST_CONVERSATION_PURPOSE,
  resolvePseudonymExpiry,
} from "@/lib/pseudonym/rules";

export type IssuedPseudonym = {
  id: string;
  pseudonym: string;
  conversationId: string;
  expiresAt: string;
};

async function loadAccountSynthetic(
  db: FoundationDb,
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
  db: FoundationDb,
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

/**
 * Issue (or return existing active) conversation-scoped pseudonym.
 * Closed/synthetic test conversations only in Phase 2.
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
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conversation pseudonyms are unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PSEUDONYMS",
    };
  }

  if (input.actorAccountId !== input.accountId) {
    return {
      ok: false,
      error: "Accounts may only issue their own conversation pseudonyms",
      code: "PSEUDONYM_SELF_ONLY",
    };
  }

  const conversationId = input.conversationId.trim();
  if (!conversationId.startsWith("ostt-synth-conversation-")) {
    return {
      ok: false,
      error:
        "Phase 2 allows only closed synthetic test conversation ids (ostt-synth-conversation-*)",
      code: "PSEUDONYM_CONVERSATION_NOT_CLOSED_TEST",
    };
  }

  const account = await loadAccountSynthetic(db, input.accountId);
  if (!account) {
    return {
      ok: false,
      error: "Account not found",
      code: "PSEUDONYM_ACCOUNT_NOT_FOUND",
    };
  }

  const [existing] = await db
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
      ok: true,
      value: {
        id: existing.id,
        pseudonym: existing.pseudonym,
        conversationId: existing.conversationId,
        expiresAt: existing.expiresAt.toISOString(),
      },
    };
  }

  if (existing) {
    await db
      .update(conversationPseudonyms)
      .set({ deletedAt: new Date() })
      .where(eq(conversationPseudonyms.id, existing.id));
  }

  const purpose = input.purpose?.trim() || CLOSED_TEST_CONVERSATION_PURPOSE;
  const expiresAt = resolvePseudonymExpiry(input.ttlMs);
  const id = newEntityId("cpsp");
  const pseudonym = await mintUniquePseudonym(db, [
    input.accountId,
    conversationId,
  ]);

  await db.insert(conversationPseudonyms).values({
    id,
    conversationId,
    accountId: input.accountId,
    pseudonym,
    purpose,
    expiresAt,
    synthetic: account.synthetic,
  });

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId: input.actorAccountId,
    action: "pseudonym.issued",
    subjectType: "conversation_pseudonym",
    subjectId: id,
    summary: "Conversation-scoped consultation pseudonym issued.",
    privatePayload: {
      conversationId,
      purpose,
      expiresAt: expiresAt.toISOString(),
    },
    requestCorrelationId: input.requestCorrelationId,
    synthetic: account.synthetic,
  });

  return {
    ok: true,
    value: {
      id,
      pseudonym,
      conversationId,
      expiresAt: expiresAt.toISOString(),
    },
  };
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
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conversation pseudonyms are unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PSEUDONYMS",
    };
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

  const [existing] = await db
    .select()
    .from(conversationPseudonyms)
    .where(
      and(
        eq(conversationPseudonyms.conversationId, input.conversationId),
        eq(conversationPseudonyms.accountId, input.accountId),
        isNull(conversationPseudonyms.deletedAt),
        isNull(conversationPseudonyms.rotatedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    return {
      ok: false,
      error: "No active pseudonym to rotate",
      code: "PSEUDONYM_NOT_FOUND",
    };
  }

  const newId = newEntityId("cpsp");
  const pseudonym = await mintUniquePseudonym(db, [
    input.accountId,
    input.conversationId,
  ]);
  const expiresAt = resolvePseudonymExpiry();
  const now = new Date();

  await db
    .update(conversationPseudonyms)
    .set({
      rotatedAt: now,
      supersededById: newId,
    })
    .where(eq(conversationPseudonyms.id, existing.id));

  await db.insert(conversationPseudonyms).values({
    id: newId,
    conversationId: existing.conversationId,
    accountId: existing.accountId,
    pseudonym,
    purpose: existing.purpose,
    expiresAt,
    synthetic: existing.synthetic,
  });

  await appendAuthAudit(db, {
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
  });

  return {
    ok: true,
    value: {
      id: newId,
      pseudonym,
      conversationId: existing.conversationId,
      expiresAt: expiresAt.toISOString(),
    },
  };
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
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conversation pseudonyms are unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PSEUDONYMS",
    };
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

  const [existing] = await db
    .select()
    .from(conversationPseudonyms)
    .where(
      and(
        eq(conversationPseudonyms.conversationId, input.conversationId),
        eq(conversationPseudonyms.accountId, input.accountId),
        isNull(conversationPseudonyms.deletedAt),
        isNull(conversationPseudonyms.rotatedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    return {
      ok: false,
      error: "No active pseudonym to delete",
      code: "PSEUDONYM_NOT_FOUND",
    };
  }

  await db
    .update(conversationPseudonyms)
    .set({ deletedAt: new Date() })
    .where(eq(conversationPseudonyms.id, existing.id));

  await appendAuthAudit(db, {
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
  });

  return { ok: true, value: { id: existing.id } };
}
