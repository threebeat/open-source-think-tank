import { eq } from "drizzle-orm";

import { organizationMembershipEvents, organizationMemberships } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import {
  PRE_ALPHA_ASSIGNMENT_EXPLANATION,
  PRE_ALPHA_ASSIGNMENT_RULE_VERSION,
} from "@/lib/auth/community-standards";
import { newEntityId } from "@/lib/auth/tokens";

export async function requestMembershipCorrection(
  db: FoundationDb,
  input: {
    accountId: string;
    reason: string;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ eventId: string }>> {
  const reason = input.reason.trim();
  if (reason.length < 8) {
    return {
      ok: false,
      error: "Please explain the correction or appeal in at least 8 characters.",
      code: "MEMBERSHIP_CORRECTION_REASON",
    };
  }

  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.accountId, input.accountId))
    .limit(1);
  if (!membership) {
    return {
      ok: false,
      error: "No organization assignment found.",
      code: "MEMBERSHIP_NOT_FOUND",
    };
  }

  const eventId = newEntityId("orgmev");
  const now = new Date();
  await db.insert(organizationMembershipEvents).values({
    id: eventId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    accountId: input.accountId,
    eventKind: "appeal_opened",
    actorPrincipalKind: "community_member",
    actorAccountId: input.accountId,
    reason,
    ruleVersion: PRE_ALPHA_ASSIGNMENT_RULE_VERSION,
    at: now,
    synthetic: input.synthetic,
  });

  await appendAuthAudit(db, {
    actorRole: "account_holder",
    actorAccountId: input.accountId,
    action: "organization.membership.correction_requested",
    subjectType: "organization_membership",
    subjectId: membership.id,
    summary: "Membership assignment correction or appeal requested.",
    reason,
    privatePayload: { eventId },
    synthetic: input.synthetic,
    organizationId: membership.organizationId,
    actorPrincipalKind: "community_member",
    projectionClass: "protected",
  });

  return { ok: true, value: { eventId } };
}

export { PRE_ALPHA_ASSIGNMENT_EXPLANATION };
