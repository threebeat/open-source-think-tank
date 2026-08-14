import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import type { AuthzPrincipal } from "@/lib/authz/types";
import { authorizeOrganization } from "@/lib/authz/organization-context";
import type { FoundationDb } from "@/db/types";
import {
  GOVERNANCE_CONTRACT,
  type GovernanceActor,
  type TopicGovernanceAction,
} from "@/lib/governance/contract";
import { evaluateTransition } from "@/lib/governance/machine";
import {
  getGovernanceRecord,
  insertGovernanceEvent,
  insertGovernanceRecord,
  updateGovernanceRecordState,
} from "@/lib/governance/repository";
import { getOrganization } from "@/lib/organizations/repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import {
  assertOrganizationMutationAllowed,
  isChamberLiveEnabled,
  isCouncilLiveEnabled,
} from "@/lib/v2/flags";

const CHAMBER_LIVE_ACTIONS = new Set<TopicGovernanceAction>([
  "start_chamber_deliberation",
  "record_chamber_acceptance",
  "record_chamber_dispute",
]);

const COUNCIL_LIVE_ACTIONS = new Set<TopicGovernanceAction>([
  "accept_to_council_agenda",
  "decline_council_intake",
  "accept_disputed_to_council_agenda",
  "decline_disputed_council_intake",
  "start_council_deliberation",
  "publish_recommendations",
]);

function appointmentKindForActor(actor: GovernanceActor): string | null {
  switch (actor) {
    case "moderator":
      return "moderator";
    case "chamber_clerk":
      return "chamber_clerk";
    case "chamber":
      return "chamber_member";
    case "council_clerk":
      return "council_clerk";
    case "council":
      return "council_member";
    default:
      return null;
  }
}

function actorPrincipalKind(
  actor: GovernanceActor,
): "organization_officer" | "community_member" | "system" {
  if (actor === "community_member") {
    return "community_member";
  }
  if (actor === "system_from_published_rule") {
    return "system";
  }
  return "organization_officer";
}

export async function createGovernanceRecord(
  db: FoundationDb,
  input: {
    organizationId: string;
    publicId: string;
    configVersionId: string;
    authorAccountId?: string | null;
    legacyTopicId?: string | null;
    predecessorRecordId?: string | null;
    copyLegacyTopicIdAsIdentity?: boolean;
    synthetic: boolean;
  },
): Promise<AdapterResult<{ recordId: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  if (input.copyLegacyTopicIdAsIdentity) {
    return {
      ok: false,
      code: "GOVERNANCE_SUCCESSOR_REUSES_LEGACY_IDENTITY",
      error:
        "A successor topic must receive a new governance record id; legacy_topic_id is adapter-only",
    };
  }
  if (input.predecessorRecordId && input.legacyTopicId) {
    const predecessor = await getGovernanceRecord(
      db,
      organizationId,
      input.predecessorRecordId,
    );
    if (predecessor?.legacyTopicId === input.legacyTopicId) {
      return {
        ok: false,
        code: "GOVERNANCE_SUCCESSOR_REUSES_LEGACY_IDENTITY",
        error:
          "A successor must not reuse the predecessor's legacy topic identity",
      };
    }
  }

  const recordId = newEntityId("govrec");
  await insertGovernanceRecord(db, {
    id: recordId,
    organizationId,
    publicId: input.publicId,
    state: "informal_draft",
    configVersionId: input.configVersionId,
    authorAccountId: input.authorAccountId ?? null,
    legacyTopicId: input.legacyTopicId ?? null,
    predecessorRecordId: input.predecessorRecordId ?? null,
    synthetic: input.synthetic,
  });
  return { ok: true, value: { recordId } };
}

export async function transitionGovernanceRecord(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    recordId: string;
    action: TopicGovernanceAction;
    actor: GovernanceActor;
    reason?: string | null;
    criteriaTrace?: Record<string, unknown> | null;
    metricsSnapshot?: Record<string, unknown> | null;
    verdict?: Record<string, unknown> | null;
    synthetic: boolean;
    /**
     * In-process published-rule engine only. HTTP/API handlers must never
     * set this. Platform administrators cannot impersonate the system actor.
     */
    trustedSystem?: boolean;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);

  if (CHAMBER_LIVE_ACTIONS.has(input.action) && !isChamberLiveEnabled()) {
    return {
      ok: false,
      code: "V2_CHAMBER_LIVE_DISABLED",
      error: "Live Chamber transitions are disabled (V2-09)",
    };
  }
  if (COUNCIL_LIVE_ACTIONS.has(input.action) && !isCouncilLiveEnabled()) {
    return {
      ok: false,
      code: "V2_COUNCIL_LIVE_DISABLED",
      error: "Live Council transitions are disabled (V2-10)",
    };
  }

  if (input.actor === "system_from_published_rule") {
    if (input.trustedSystem !== true) {
      return {
        ok: false,
        code: "GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED",
        error:
          "system_from_published_rule may only be invoked by the trusted in-process rule engine",
      };
    }
  } else if (input.actor === "community_member") {
    const memberships = input.principal?.organizationMemberships ?? [];
    const member = memberships.some(
      (row) =>
        row.organizationId === organizationId &&
        (row.status === "assigned" || row.status === "active"),
    );
    if (!member) {
      return {
        ok: false,
        code: "AUTHZ_DENIED",
        error: "Community membership is required for this transition",
      };
    }
  } else {
    const decision = authorizeOrganization(
      input.principal,
      organizationId,
      "organization.governance.transition",
    );
    if (!decision.ok) {
      return { ok: false, code: decision.code, error: decision.error };
    }
    const requiredKind = appointmentKindForActor(input.actor);
    const hasKind = (input.principal?.organizationAppointments ?? []).some(
      (appointment) =>
        appointment.organizationId === organizationId &&
        appointment.kind === requiredKind,
    );
    if (!hasKind) {
      return {
        ok: false,
        code: "AUTHZ_DENIED",
        error: `Appointment ${requiredKind} is required in this organization`,
      };
    }
  }

  const record = await getGovernanceRecord(
    db,
    organizationId,
    input.recordId,
  );
  if (!record) {
    return {
      ok: false,
      code: "GOVERNANCE_RECORD_NOT_FOUND",
      error: "Governance record not found in this organization",
    };
  }

  if (
    input.action === "qualify" &&
    record.authorAccountId &&
    input.principal?.accountId === record.authorAccountId
  ) {
    return {
      ok: false,
      code: "GOVERNANCE_SELF_REVIEW_FORBIDDEN",
      error: "A moderator cannot qualify their own proposal",
    };
  }

  const evaluated = evaluateTransition({
    from: record.state,
    action: input.action,
    actor: input.actor,
    reason: input.reason,
    criteriaTrace: input.criteriaTrace,
    metricsSnapshot: input.metricsSnapshot,
    verdict: input.verdict,
  });
  if (!evaluated.ok) {
    return evaluated;
  }

  const now = new Date();
  await insertGovernanceEvent(db, {
    id: newEntityId("govevt"),
    organizationId,
    recordId: record.id,
    fromState: evaluated.value.from,
    toState: evaluated.value.to,
    action: evaluated.value.action,
    actorPrincipalKind: actorPrincipalKind(input.actor),
    actorAccountId:
      input.actor === "system_from_published_rule"
        ? null
        : input.principal?.accountId ?? null,
    reason: input.reason ?? null,
    criteriaTrace: input.criteriaTrace ?? null,
    metricsSnapshot: input.metricsSnapshot ?? null,
    configVersionId: record.configVersionId,
    ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
    at: now,
    synthetic: input.synthetic,
  });
  await updateGovernanceRecordState(db, {
    organizationId,
    recordId: record.id,
    state: evaluated.value.to,
    retentionDeadlineAt: record.retentionDeadlineAt,
  });

  const org = await getOrganization(db, organizationId);
  await appendAuthAudit(db, {
    actorRole: actorPrincipalKind(input.actor),
    actorAccountId:
      input.actor === "system_from_published_rule"
        ? null
        : input.principal?.accountId ?? null,
    action: "organization.governance.transitioned",
    subjectType: "topic_governance_record",
    subjectId: record.id,
    summary: "A topic governance record changed state.",
    reason: input.reason ?? "Governance kernel transition.",
    privatePayload: {
      organizationPublicId: org?.publicId ?? organizationId,
      fromState: evaluated.value.from,
      toState: evaluated.value.to,
      governanceAction: evaluated.value.action,
      capability: "organization.governance.transition",
    },
    synthetic: input.synthetic,
    organizationId,
    actorPrincipalKind: actorPrincipalKind(input.actor),
    capability: "organization.governance.transition",
    projectionClass: "protected",
  });

  return { ok: true, value: { to: evaluated.value.to } };
}
