import { eq } from "drizzle-orm";

import { accounts, profiles } from "@/db/schema";
import type { FoundationDb } from "@/db/types";

export async function getAccountProfile(db: FoundationDb, accountId: string) {
  const [row] = await db
    .select({
      accountId: accounts.id,
      identifier: accounts.contactChannel,
      lifecycleState: accounts.lifecycleState,
      enrollmentKind: accounts.enrollmentKind,
      synthetic: accounts.synthetic,
      displayName: profiles.preferredDisplayName,
      locale: profiles.locale,
    })
    .from(accounts)
    .innerJoin(profiles, eq(profiles.accountId, accounts.id))
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row ?? null;
}

export async function updatePreferredDisplayName(
  db: FoundationDb,
  accountId: string,
  displayName: string,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return {
      ok: false,
      error: "Display name must be between 2 and 80 characters.",
      code: "PROFILE_DISPLAY_NAME",
    };
  }
  const now = new Date();
  await db
    .update(profiles)
    .set({ preferredDisplayName: trimmed, updatedAt: now })
    .where(eq(profiles.accountId, accountId));
  return { ok: true };
}
