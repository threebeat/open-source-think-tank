import { desc, eq, isNull } from "drizzle-orm";

import { accounts, invitations } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { getOnboardingProgress } from "@/lib/onboarding/progress";

function redactContact(contact: string): string {
  const [local, domain] = contact.split("@");
  if (!domain || !local) {
    return "[redacted]";
  }
  const hint = local.slice(0, 1);
  return `${hint}***@${domain}`;
}

export async function listStaffOnboardingStatuses(
  db: FoundationDb,
  actorAccountId: string,
): Promise<
  AdapterResult<
    Array<{
      accountId: string;
      lifecycleState: string;
      synthetic: boolean;
      contactRedacted: string;
      canActivate: boolean;
      stepSummary: string;
    }>
  >
> {
  const actor = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "onboarding.staff_read",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const rows = await db
    .select({
      id: accounts.id,
      lifecycleState: accounts.lifecycleState,
      synthetic: accounts.synthetic,
      contactChannel: accounts.contactChannel,
    })
    .from(accounts)
    .where(eq(accounts.lifecycleState, "pending_onboarding"))
    .orderBy(desc(accounts.updatedAt))
    .limit(100);

  const result = [];
  for (const row of rows) {
    const progress = await getOnboardingProgress(db, row.id);
    const incomplete =
      progress?.steps.filter((step) => step.status !== "complete").map((s) => s.id) ??
      [];
    result.push({
      accountId: row.id,
      lifecycleState: row.lifecycleState,
      synthetic: row.synthetic,
      contactRedacted: redactContact(row.contactChannel),
      canActivate: Boolean(progress?.canActivate),
      stepSummary:
        incomplete.length === 0
          ? "all steps complete"
          : `open: ${incomplete.join(", ")}`,
    });
  }

  return { ok: true, value: result };
}

export async function listStaffInvitations(
  db: FoundationDb,
  actorAccountId: string,
): Promise<
  AdapterResult<
    Array<{
      invitationId: string;
      status: string;
      contactRedacted: string;
      expiresAt: string;
      expired: boolean;
    }>
  >
> {
  const actor = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(
    db,
    actor,
    "onboarding.staff_read",
  );
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const now = new Date();
  const rows = await db
    .select({
      id: invitations.id,
      status: invitations.status,
      contact: invitations.intendedContactChannel,
      expiresAt: invitations.expiresAt,
      acceptedAccountId: invitations.acceptedAccountId,
    })
    .from(invitations)
    .where(isNull(invitations.acceptedAccountId))
    .orderBy(desc(invitations.expiresAt))
    .limit(100);

  return {
    ok: true,
    value: rows.map((row) => ({
      invitationId: row.id,
      status: row.status,
      contactRedacted: redactContact(row.contact),
      expiresAt: row.expiresAt.toISOString(),
      expired: row.expiresAt.getTime() <= now.getTime() || row.status === "expired",
    })),
  };
}
