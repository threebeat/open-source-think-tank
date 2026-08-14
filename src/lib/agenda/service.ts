import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import type { AuthzPrincipal } from "@/lib/authz/types";
import type { FoundationDb } from "@/db/types";
import {
  listLegacyEvidenceForTopic,
  listLinkedDiscussions,
  listPositionsForViewer,
  upsertMemberPosition,
} from "@/lib/agenda/repository";
import {
  historyToDto,
  legacyEvidenceToDto,
  statementsToDto,
  syntheticEvidenceToDto,
  toListItemDto,
  toTopicDetailDto,
} from "@/lib/agenda/projection";
import type {
  AgendaListDto,
  AgendaTopicDetailDto,
  MemberStatementPosition,
} from "@/lib/agenda/types";
import { isMemberStatementPosition } from "@/lib/agenda/types";
import { isPublicAgendaState } from "@/lib/governance/contract";
import {
  getGovernanceRecordBySlugOrPublicId,
  listGovernanceEventsForRecord,
  listPublicAgendaRecords,
} from "@/lib/governance/repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { hasCommunityMembershipInOrganization } from "@/lib/organizations/membership-repository";
import { getOrganization } from "@/lib/organizations/repository";
import { getMutationRateLimiter } from "@/lib/security/mutation-rate-limit";
import {
  assertOrganizationMutationAllowed,
  isSyntheticSeedEnabled,
} from "@/lib/v2/flags";

function communityMemberInOrg(
  principal: AuthzPrincipal | null | undefined,
  organizationId: string,
): boolean {
  if (!principal || principal.lifecycleState !== "active") {
    return false;
  }
  return hasCommunityMembershipInOrganization(
    principal.organizationMemberships ?? [],
    organizationId,
  );
}

export async function listAgenda(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
  },
): Promise<AdapterResult<AgendaListDto>> {
  void input.principal;
  const organizationId = requireOrganizationId(input.organizationId);
  const includeSynthetic = isSyntheticSeedEnabled();
  const rows = await listPublicAgendaRecords(db, organizationId, {
    includeSynthetic,
  });
  const topics = rows
    .map(toListItemDto)
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return {
    ok: true,
    value: {
      topics,
      hostedPolisEnabled: false,
      syntheticCatalog: includeSynthetic,
    },
  };
}

export async function getAgendaTopic(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
  },
): Promise<AdapterResult<AgendaTopicDetailDto>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const row = await getGovernanceRecordBySlugOrPublicId(
    db,
    organizationId,
    input.slugOrPublicId,
  );
  if (!row || !row.slug || !row.title) {
    return {
      ok: false,
      code: "AGENDA_TOPIC_NOT_FOUND",
      error: "Agenda topic not found in this organization",
    };
  }
  if (!isPublicAgendaState(row.state)) {
    return {
      ok: false,
      code: "AGENDA_TOPIC_NOT_ON_PUBLIC_AGENDA",
      error: "This topic is not on the Public Agenda",
    };
  }
  if (row.synthetic && !isSyntheticSeedEnabled()) {
    return {
      ok: false,
      code: "AGENDA_TOPIC_NOT_FOUND",
      error: "Agenda topic not found in this organization",
    };
  }

  const isMember = communityMemberInOrg(input.principal, organizationId);
  const viewerPositions = new Map<string, MemberStatementPosition>();
  if (input.principal?.accountId) {
    const positions = await listPositionsForViewer(db, {
      organizationId,
      recordId: row.id,
      accountId: input.principal.accountId,
    });
    for (const position of positions) {
      viewerPositions.set(position.statementPublicId, position.position);
    }
  }

  let evidence = syntheticEvidenceToDto(row.syntheticEvidence);
  if (row.legacyTopicId) {
    const legacy = await listLegacyEvidenceForTopic(db, row.legacyTopicId);
    evidence = legacyEvidenceToDto(legacy);
  }

  const discussions = await listLinkedDiscussions(db, organizationId, row.id);
  const events = await listGovernanceEventsForRecord(db, organizationId, row.id);

  try {
    const dto = toTopicDetailDto({
      row,
      statements: statementsToDto(row.syntheticStatements, viewerPositions),
      evidence,
      discussions,
      history: historyToDto(events),
      canRecordPosition: isMember && row.state === "qualified_consultation",
    });
    return { ok: true, value: dto };
  } catch (error) {
    const message = error instanceof Error ? error.message : "projection failed";
    return {
      ok: false,
      code: "AGENDA_PROJECTION_FORBIDDEN",
      error: message,
    };
  }
}

export async function recordMemberPosition(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
    statementPublicId: string;
    position: string;
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ statementPublicId: string; position: MemberStatementPosition }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const principal = input.principal;
  if (!principal?.accountId) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Sign in to record a position",
    };
  }
  if (!communityMemberInOrg(principal, organizationId)) {
    return {
      ok: false,
      code: "AGENDA_MEMBERSHIP_REQUIRED",
      error:
        "Community membership is required to record a position. Chamber or organization-admin status is not a substitute.",
    };
  }
  if (!isMemberStatementPosition(input.position)) {
    return {
      ok: false,
      code: "AGENDA_POSITION_INVALID",
      error: "Position must be agree, disagree, or pass",
    };
  }

  const limited = getMutationRateLimiter().consume({
    family: "member_position",
    accountId: principal.accountId,
    originRef: input.clientIp ?? null,
  });
  if (!limited.ok) {
    return {
      ok: false,
      code: "AGENDA_RATE_LIMITED",
      error: "Too many position updates. Try again shortly.",
    };
  }

  const row = await getGovernanceRecordBySlugOrPublicId(
    db,
    organizationId,
    input.slugOrPublicId,
  );
  if (!row || !isPublicAgendaState(row.state)) {
    return {
      ok: false,
      code: "AGENDA_TOPIC_NOT_FOUND",
      error: "Agenda topic not found in this organization",
    };
  }
  if (row.state !== "qualified_consultation") {
    return {
      ok: false,
      code: "AGENDA_CONSULTATION_CLOSED",
      error: "Positions can be recorded only while consultation is open",
    };
  }
  const statement = (row.syntheticStatements ?? []).find(
    (item) => item.publicId === input.statementPublicId.trim(),
  );
  if (!statement) {
    return {
      ok: false,
      code: "AGENDA_STATEMENT_NOT_FOUND",
      error: "Statement not found on this topic",
    };
  }

  const saved = await upsertMemberPosition(db, {
    id: newEntityId("mpos"),
    organizationId,
    recordId: row.id,
    accountId: principal.accountId,
    statementPublicId: statement.publicId,
    position: input.position,
    synthetic: row.synthetic || principal.synthetic,
  });

  const org = await getOrganization(db, organizationId);
  await appendAuthAudit(db, {
    actorRole: "community_member",
    actorAccountId: principal.accountId,
    action: "agenda.position.recorded",
    subjectType: "topic_governance_record",
    subjectId: row.id,
    summary: "A member recorded an in-house consultation position.",
    privatePayload: {
      organizationPublicId: org?.publicId ?? organizationId,
      topicPublicId: row.publicId,
      statementPublicId: statement.publicId,
      position: saved.position,
    },
    synthetic: saved.synthetic,
    organizationId,
    actorPrincipalKind: "community_member",
    projectionClass: "protected",
  });

  return {
    ok: true,
    value: {
      statementPublicId: saved.statementPublicId,
      position: saved.position,
    },
  };
}
