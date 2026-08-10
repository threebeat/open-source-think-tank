import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";

import {
  authChallenges,
  conversationPseudonyms,
  legalHolds,
  retentionPolicySettings,
} from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { RETENTION_RULES } from "@/lib/privacy/retention-rules";
import { lockPrivacySubject } from "@/lib/privacy/subject-lock";

export type RetentionJobResult = {
  expiredPseudonyms: number;
  expiredChallenges: number;
  skippedForLegalHold: number;
  provisional: boolean;
};

async function readSetting<T>(
  db: FoundationDb | DrizzleTx,
  key: string,
  fallback: T,
): Promise<{ value: T; provisional: boolean }> {
  const [row] = await db
    .select()
    .from(retentionPolicySettings)
    .where(eq(retentionPolicySettings.key, key))
    .limit(1);
  if (!row) {
    return { value: fallback, provisional: true };
  }
  return {
    value: row.valueJson as T,
    provisional: row.provisional,
  };
}

/**
 * Configurable expiration job (provisional). Never purges assent/audit.
 * Purges + hold checks + audit append share one transaction; subjects are locked.
 */
export async function runRetentionExpirationJob(
  db: FoundationDb,
  input: { actorLabel?: string } = {},
): Promise<AdapterResult<RetentionJobResult>> {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Retention jobs unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_RETENTION_JOB",
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const enabled = await readSetting(tx, "pseudonym_expire_job_enabled", true);
      let expiredPseudonyms = 0;
      let skippedForLegalHold = 0;
      const now = new Date();

      if (enabled.value) {
        const expired = await tx
          .select()
          .from(conversationPseudonyms)
          .where(
            and(
              isNull(conversationPseudonyms.deletedAt),
              isNull(conversationPseudonyms.rotatedAt),
              lt(conversationPseudonyms.expiresAt, now),
            ),
          );

        for (const row of expired) {
          await lockPrivacySubject(tx, "account", row.accountId);
          await lockPrivacySubject(tx, "conversation_pseudonym", row.id);

          const [accountHold] = await tx
            .select({ id: legalHolds.id })
            .from(legalHolds)
            .where(
              and(
                eq(legalHolds.subjectType, "account"),
                eq(legalHolds.subjectId, row.accountId),
                isNull(legalHolds.releasedAt),
              ),
            )
            .limit(1);
          const [pseudoHold] = await tx
            .select({ id: legalHolds.id })
            .from(legalHolds)
            .where(
              and(
                eq(legalHolds.subjectType, "conversation_pseudonym"),
                eq(legalHolds.subjectId, row.id),
                isNull(legalHolds.releasedAt),
              ),
            )
            .limit(1);

          if (accountHold || pseudoHold) {
            skippedForLegalHold += 1;
            continue;
          }

          await tx
            .update(conversationPseudonyms)
            .set({ deletedAt: now })
            .where(eq(conversationPseudonyms.id, row.id));
          expiredPseudonyms += 1;
        }
      }

      const challengeTtl = await readSetting(tx, "auth_challenge_ttl_ms", 3_600_000);
      const challengeCutoff = new Date(
        now.getTime() - Number(challengeTtl.value),
      );
      const staleChallenges = await tx
        .select({ id: authChallenges.id })
        .from(authChallenges)
        .where(
          or(
            lt(authChallenges.expiresAt, challengeCutoff),
            isNotNull(authChallenges.consumedAt),
          ),
        );
      for (const row of staleChallenges) {
        await tx.delete(authChallenges).where(eq(authChallenges.id, row.id));
      }
      const expiredChallenges = staleChallenges.length;

      await appendAuthAudit(tx, {
        actorRole: "system",
        action: "privacy.retention_job_ran",
        subjectType: "retention_job",
        subjectId: "expiration",
        summary: "Provisional retention/expiration job completed.",
        privatePayload: {
          expiredPseudonyms,
          expiredChallenges,
          skippedForLegalHold,
          rule: RETENTION_RULES.jobs,
          actorLabel: input.actorLabel ?? "system",
        },
        synthetic: true,
        at: now,
      });

      return {
        ok: true as const,
        value: {
          expiredPseudonyms,
          expiredChallenges,
          skippedForLegalHold,
          provisional: true,
        },
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Retention job failed and was rolled back",
      code: "RETENTION_TX_FAILED",
    };
  }
}
