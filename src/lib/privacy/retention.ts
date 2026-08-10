import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";

import {
  authChallenges,
  conversationPseudonyms,
  retentionPolicySettings,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";
import { hasActiveLegalHold } from "@/lib/privacy/legal-hold";
import { RETENTION_RULES } from "@/lib/privacy/retention-rules";

export type RetentionJobResult = {
  expiredPseudonyms: number;
  expiredChallenges: number;
  skippedForLegalHold: number;
  provisional: boolean;
};

async function readSetting<T>(
  db: FoundationDb,
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
 * Skips subjects under active legal hold.
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

  const enabled = await readSetting(db, "pseudonym_expire_job_enabled", true);
  let expiredPseudonyms = 0;
  let skippedForLegalHold = 0;
  const now = new Date();

  if (enabled.value) {
    const expired = await db
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
      if (await hasActiveLegalHold(db, "account", row.accountId)) {
        skippedForLegalHold += 1;
        continue;
      }
      if (await hasActiveLegalHold(db, "conversation_pseudonym", row.id)) {
        skippedForLegalHold += 1;
        continue;
      }
      await db
        .update(conversationPseudonyms)
        .set({ deletedAt: now })
        .where(eq(conversationPseudonyms.id, row.id));
      expiredPseudonyms += 1;
    }
  }

  const challengeTtl = await readSetting(db, "auth_challenge_ttl_ms", 3_600_000);
  const challengeCutoff = new Date(now.getTime() - Number(challengeTtl.value));
  const staleChallenges = await db
    .select({ id: authChallenges.id })
    .from(authChallenges)
    .where(
      or(
        lt(authChallenges.expiresAt, challengeCutoff),
        isNotNull(authChallenges.consumedAt),
      ),
    );
  for (const row of staleChallenges) {
    await db.delete(authChallenges).where(eq(authChallenges.id, row.id));
  }
  const expiredChallenges = staleChallenges.length;

  await appendAuthAudit(db, {
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
  });

  return {
    ok: true,
    value: {
      expiredPseudonyms,
      expiredChallenges,
      skippedForLegalHold,
      provisional: true,
    },
  };
}
