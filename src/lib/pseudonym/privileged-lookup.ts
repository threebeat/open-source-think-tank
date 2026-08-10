import { eq } from "drizzle-orm";

import { conversationPseudonyms } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { PRIVILEGED_LOOKUP_SCOPE } from "@/lib/pseudonym/rules";

export type PrivilegedPseudonymLookup = {
  accountId: string;
  conversationId: string;
  pseudonym: string;
  purpose: string;
  expiresAt: string;
  synthetic: boolean;
  /** Explicit lifecycle state returned to privileged callers. */
  mappingState: "active" | "expired" | "rotated";
};

function mappingStateFor(row: {
  expiresAt: Date;
  rotatedAt: Date | null;
  deletedAt: Date | null;
}): "active" | "expired" | "rotated" | "deleted" {
  if (row.deletedAt) {
    return "deleted";
  }
  if (row.rotatedAt) {
    return "rotated";
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

/**
 * Exceptional reverse lookup. Moderators and public surfaces must not call this.
 * Requires `pseudonym.privileged_lookup`, a non-empty reason, and an audit row.
 *
 * Scope (see PRIVILEGED_LOOKUP_SCOPE): expired and rotated mappings may be
 * resolved for incidents; soft-deleted mappings are not returned.
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

  const actorRole = decision.principal.platformRoles.includes("auditor")
    ? "auditor"
    : "administrator";

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(conversationPseudonyms)
        .where(eq(conversationPseudonyms.pseudonym, input.pseudonym.trim()))
        .limit(1);

      const state = row ? mappingStateFor(row) : null;
      const resolvable =
        state === "active" ||
        (state === "expired" && PRIVILEGED_LOOKUP_SCOPE.includeExpired) ||
        (state === "rotated" && PRIVILEGED_LOOKUP_SCOPE.includeRotated);

      if (!row || !state || state === "deleted" || !resolvable) {
        const withheldDeleted = Boolean(row && state === "deleted");
        await appendAuthAudit(tx, {
          actorRole,
          actorAccountId: input.actorAccountId,
          action: "pseudonym.privileged_lookup",
          subjectType: "conversation_pseudonym",
          subjectId: row?.id ?? "not_found",
          summary: withheldDeleted
            ? "Privileged pseudonym lookup — deleted mapping withheld."
            : "Privileged pseudonym lookup — no resolvable mapping.",
          reason: input.reason.trim(),
          privatePayload: row
            ? {
                conversationId: row.conversationId,
                mappingState: state,
              }
            : { mappingState: "not_found" },
          requestCorrelationId: input.requestCorrelationId,
          synthetic: decision.principal.synthetic,
        });
        return {
          ok: false as const,
          error: withheldDeleted
            ? "Deleted pseudonym mappings are not returned"
            : "Pseudonym mapping not found",
          code: withheldDeleted
            ? "PSEUDONYM_DELETED_WITHHELD"
            : "PSEUDONYM_NOT_FOUND",
        };
      }

      await appendAuthAudit(tx, {
        actorRole,
        actorAccountId: input.actorAccountId,
        action: "pseudonym.privileged_lookup",
        subjectType: "conversation_pseudonym",
        subjectId: row.id,
        summary: "Privileged pseudonym mapping lookup.",
        reason: input.reason.trim(),
        privatePayload: {
          conversationId: row.conversationId,
          subjectAccountId: row.accountId,
          mappingState: state,
        },
        requestCorrelationId: input.requestCorrelationId,
        synthetic: decision.principal.synthetic && row.synthetic,
      });

      return {
        ok: true as const,
        value: {
          accountId: row.accountId,
          conversationId: row.conversationId,
          pseudonym: row.pseudonym,
          purpose: row.purpose,
          expiresAt: row.expiresAt.toISOString(),
          synthetic: row.synthetic,
          mappingState: state,
        },
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Privileged lookup failed and was rolled back",
      code: "PSEUDONYM_TX_FAILED",
    };
  }
}

/** Explicit non-API: moderators have no reverse path. */
export function moderatorReverseLookupDenied(): AdapterResult<never> {
  return {
    ok: false,
    error: "Moderators cannot reverse conversation pseudonyms",
    code: "PSEUDONYM_MODERATOR_REVERSE_DENIED",
  };
}
