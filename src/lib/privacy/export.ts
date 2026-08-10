import { eq } from "drizzle-orm";

import {
  accountDeletionRequests,
  accounts,
  assentOutcomes,
  assentRecords,
  conversationPseudonyms,
  profiles,
  verificationCases,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { securityLog } from "@/lib/security/log";

export type AccountExportBundle = {
  exportedAt: string;
  accountId: string;
  account: {
    lifecycleState: string;
    synthetic: boolean;
    contactChannel: string;
    activatedAt: string | null;
    closedAt: string | null;
  };
  profile: { preferredDisplayName: string } | null;
  assentRecords: Array<{
    id: string;
    documentVersionId: string;
    method: string;
    createdAt: string;
  }>;
  assentOutcomes: Array<{
    id: string;
    outcome: string;
    createdAt: string;
  }>;
  verificationCases: Array<{
    id: string;
    kind: string;
    status: string;
    decidedAt: string | null;
  }>;
  conversationPseudonyms: Array<{
    id: string;
    conversationId: string;
    pseudonym: string;
    expiresAt: string;
    rotatedAt: string | null;
    deletedAt: string | null;
  }>;
  deletionRequests: Array<{
    id: string;
    status: string;
    requestedAt: string;
  }>;
  notice: string;
};

/**
 * Generate an account-holder export containing only that account’s records.
 */
export async function exportOwnAccountData(
  db: FoundationDb,
  actorAccountId: string,
): Promise<AdapterResult<AccountExportBundle>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Account export is unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_EXPORT",
    };
  }

  const principal = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(db, principal, "account.export_own");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, actorAccountId))
    .limit(1);
  if (!account) {
    return { ok: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, actorAccountId))
    .limit(1);

  const assentRows = await db
    .select({
      id: assentRecords.id,
      documentVersionId: assentRecords.documentVersionId,
      method: assentRecords.method,
      createdAt: assentRecords.createdAt,
    })
    .from(assentRecords)
    .where(eq(assentRecords.accountId, actorAccountId));

  const outcomeRows = await db
    .select({
      id: assentOutcomes.id,
      outcome: assentOutcomes.outcome,
      createdAt: assentOutcomes.createdAt,
    })
    .from(assentOutcomes)
    .where(eq(assentOutcomes.accountId, actorAccountId));

  const verificationRows = await db
    .select({
      id: verificationCases.id,
      kind: verificationCases.kind,
      status: verificationCases.status,
      decidedAt: verificationCases.decidedAt,
    })
    .from(verificationCases)
    .where(eq(verificationCases.accountId, actorAccountId));

  const pseudonymRows = await db
    .select({
      id: conversationPseudonyms.id,
      conversationId: conversationPseudonyms.conversationId,
      pseudonym: conversationPseudonyms.pseudonym,
      expiresAt: conversationPseudonyms.expiresAt,
      rotatedAt: conversationPseudonyms.rotatedAt,
      deletedAt: conversationPseudonyms.deletedAt,
    })
    .from(conversationPseudonyms)
    .where(eq(conversationPseudonyms.accountId, actorAccountId));

  const deletionRows = await db
    .select({
      id: accountDeletionRequests.id,
      status: accountDeletionRequests.status,
      requestedAt: accountDeletionRequests.requestedAt,
    })
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.accountId, actorAccountId));

  const bundle: AccountExportBundle = {
    exportedAt: new Date().toISOString(),
    accountId: actorAccountId,
    account: {
      lifecycleState: account.lifecycleState,
      synthetic: account.synthetic,
      contactChannel: account.contactChannel,
      activatedAt: account.activatedAt?.toISOString() ?? null,
      closedAt: account.closedAt?.toISOString() ?? null,
    },
    profile: profile
      ? { preferredDisplayName: profile.preferredDisplayName }
      : null,
    assentRecords: assentRows.map((row) => ({
      id: row.id,
      documentVersionId: row.documentVersionId,
      method: row.method,
      createdAt: row.createdAt.toISOString(),
    })),
    assentOutcomes: outcomeRows.map((row) => ({
      id: row.id,
      outcome: row.outcome,
      createdAt: row.createdAt.toISOString(),
    })),
    verificationCases: verificationRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      decidedAt: row.decidedAt?.toISOString() ?? null,
    })),
    conversationPseudonyms: pseudonymRows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      pseudonym: row.pseudonym,
      expiresAt: row.expiresAt.toISOString(),
      rotatedAt: row.rotatedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
    deletionRequests: deletionRows.map((row) => ({
      id: row.id,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
    })),
    notice:
      "Provisional account-holder export. Does not include other accounts, staff-restricted audit private payloads, or legal-hold dockets.",
  };

  // Hard invariant: export must not contain another account id.
  const blob = JSON.stringify(bundle);
  // Match foundation account ids only (avoid English phrases like "account-holder").
  const accountIds = blob.match(/account-ostt-[a-z0-9-]+/gi) ?? [];
  for (const id of accountIds) {
    if (id !== actorAccountId) {
      securityLog({
        level: "error",
        event: "privacy.export_foreign_account_leak_blocked",
        accountId: actorAccountId,
        details: { otherAccountId: id },
      });
      return {
        ok: false,
        error: "Export aborted — potential cross-account data",
        code: "EXPORT_CROSS_ACCOUNT_BLOCKED",
      };
    }
  }

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId,
    action: "privacy.export_generated",
    subjectType: "account",
    subjectId: actorAccountId,
    summary: "Account holder data export generated.",
    synthetic: account.synthetic,
  });

  securityLog({
    level: "info",
    event: "privacy.export_generated",
    accountId: actorAccountId,
  });

  return { ok: true, value: bundle };
}
