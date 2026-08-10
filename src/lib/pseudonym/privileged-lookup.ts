import { and, eq, isNull } from "drizzle-orm";

import { conversationPseudonyms } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";

export type PrivilegedPseudonymLookup = {
  accountId: string;
  conversationId: string;
  pseudonym: string;
  purpose: string;
  expiresAt: string;
  synthetic: boolean;
};

/**
 * Exceptional reverse lookup. Moderators and public surfaces must not call this.
 * Requires `pseudonym.privileged_lookup`, a non-empty reason, and an audit row.
 */
export async function privilegedLookupAccountByPseudonym(
  db: FoundationDb,
  input: {
    actorAccountId: string;
    pseudonym: string;
    reason: string;
    requestCorrelationId?: string | null;
  },
): Promise<AdapterResult<PrivilegedPseudonymLookup>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Conversation pseudonyms are unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_PSEUDONYMS",
    };
  }

  if (!input.reason.trim()) {
    return {
      ok: false,
      error: "Privileged pseudonym lookup requires a reason",
      code: "PSEUDONYM_REASON_REQUIRED",
    };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "pseudonym.privileged_lookup",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [row] = await db
    .select()
    .from(conversationPseudonyms)
    .where(
      and(
        eq(conversationPseudonyms.pseudonym, input.pseudonym.trim()),
        isNull(conversationPseudonyms.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    await appendAuthAudit(db, {
      actorRole: decision.principal.platformRoles.includes("auditor")
        ? "auditor"
        : "administrator",
      actorAccountId: input.actorAccountId,
      action: "pseudonym.privileged_lookup",
      subjectType: "conversation_pseudonym",
      subjectId: "not_found",
      summary: "Privileged pseudonym lookup — no active mapping.",
      reason: input.reason.trim(),
      requestCorrelationId: input.requestCorrelationId,
      synthetic: decision.principal.synthetic,
    });
    return {
      ok: false,
      error: "Pseudonym mapping not found",
      code: "PSEUDONYM_NOT_FOUND",
    };
  }

  await appendAuthAudit(db, {
    actorRole: decision.principal.platformRoles.includes("auditor")
      ? "auditor"
      : "administrator",
    actorAccountId: input.actorAccountId,
    action: "pseudonym.privileged_lookup",
    subjectType: "conversation_pseudonym",
    subjectId: row.id,
    summary: "Privileged pseudonym mapping lookup.",
    reason: input.reason.trim(),
    privatePayload: {
      conversationId: row.conversationId,
      subjectAccountId: row.accountId,
    },
    requestCorrelationId: input.requestCorrelationId,
    synthetic:
      decision.principal.synthetic && row.synthetic,
  });

  return {
    ok: true,
    value: {
      accountId: row.accountId,
      conversationId: row.conversationId,
      pseudonym: row.pseudonym,
      purpose: row.purpose,
      expiresAt: row.expiresAt.toISOString(),
      synthetic: row.synthetic,
    },
  };
}

/** Explicit non-API: moderators have no reverse path. */
export function moderatorReverseLookupDenied(): AdapterResult<never> {
  return {
    ok: false,
    error: "Moderators cannot reverse conversation pseudonyms",
    code: "PSEUDONYM_MODERATOR_REVERSE_DENIED",
  };
}
