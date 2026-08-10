import { and, eq, sql } from "drizzle-orm";

import { closedTestConversations } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import {
  CLOSED_TEST_CONVERSATION_PURPOSE,
  isApprovedPseudonymPurpose,
  type PseudonymPurpose,
} from "@/lib/pseudonym/rules";

export type ClosedConversationRow = {
  id: string;
  purpose: PseudonymPurpose;
  status: "open" | "closed" | "archived";
  synthetic: boolean;
};

/**
 * Lock and load a registered closed-test conversation.
 * Prefix matching alone is never sufficient.
 */
export async function lockRegisteredClosedConversation(
  db: FoundationDb | DrizzleTx,
  conversationId: string,
): Promise<
  | { ok: true; conversation: ClosedConversationRow }
  | { ok: false; code: string; error: string }
> {
  const id = conversationId.trim();
  await db.execute(
    sql`SELECT id FROM closed_test_conversations WHERE id = ${id} FOR UPDATE`,
  );

  const [row] = await db
    .select({
      id: closedTestConversations.id,
      purpose: closedTestConversations.purpose,
      status: closedTestConversations.status,
      synthetic: closedTestConversations.synthetic,
    })
    .from(closedTestConversations)
    .where(eq(closedTestConversations.id, id))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      code: "PSEUDONYM_CONVERSATION_NOT_REGISTERED",
      error: "Conversation is not in the closed-test registry",
    };
  }
  if (!row.synthetic) {
    return {
      ok: false,
      code: "PSEUDONYM_CONVERSATION_NOT_SYNTHETIC",
      error: "Only synthetic closed-test conversations are permitted in Phase 2",
    };
  }
  if (row.status !== "open") {
    return {
      ok: false,
      code: "PSEUDONYM_CONVERSATION_NOT_OPEN",
      error: `Closed-test conversation is ${row.status}, not open for issuance`,
    };
  }
  if (!isApprovedPseudonymPurpose(row.purpose)) {
    return {
      ok: false,
      code: "PSEUDONYM_PURPOSE_INVALID",
      error: "Conversation purpose is not an approved enum value",
    };
  }

  return {
    ok: true,
    conversation: {
      id: row.id,
      purpose: row.purpose,
      status: row.status,
      synthetic: row.synthetic,
    },
  };
}

export async function assertConversationPurposeMatch(
  conversationPurpose: PseudonymPurpose,
  requestedPurpose: string | undefined,
): Promise<
  | { ok: true; purpose: PseudonymPurpose }
  | { ok: false; code: string; error: string }
> {
  const purpose = (requestedPurpose?.trim() ||
    CLOSED_TEST_CONVERSATION_PURPOSE) as string;
  if (!isApprovedPseudonymPurpose(purpose)) {
    return {
      ok: false,
      code: "PSEUDONYM_PURPOSE_INVALID",
      error: "Purpose must be an approved enum value",
    };
  }
  if (purpose !== conversationPurpose) {
    return {
      ok: false,
      code: "PSEUDONYM_PURPOSE_MISMATCH",
      error: "Requested purpose does not match the registered conversation purpose",
    };
  }
  return { ok: true, purpose };
}

/** Ensure a registry row is open (read path without lock). */
export async function getRegisteredClosedConversation(
  db: FoundationDb | DrizzleTx,
  conversationId: string,
) {
  const [row] = await db
    .select()
    .from(closedTestConversations)
    .where(
      and(
        eq(closedTestConversations.id, conversationId.trim()),
        eq(closedTestConversations.synthetic, true),
      ),
    )
    .limit(1);
  return row ?? null;
}
