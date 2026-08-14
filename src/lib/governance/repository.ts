import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";

import { topicGovernanceEvents, topicGovernanceRecords } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type {
  TopicGovernanceAction,
  TopicGovernanceState,
} from "@/lib/governance/contract";
import { PUBLIC_AGENDA_STATES } from "@/lib/governance/contract";
import { requireOrganizationId } from "@/lib/organizations/ids";

export type SyntheticEvidenceCopy = {
  labeledSynthetic: true;
  items: Array<{
    title: string;
    summary: string;
    qualityStatus: "accepted" | "limited" | "disputed" | "pending";
    limitations: string;
  }>;
};

export type SyntheticStatement = {
  publicId: string;
  text: string;
};

export type GovernanceRecordRow = {
  id: string;
  organizationId: string;
  publicId: string;
  state: TopicGovernanceState;
  configVersionId: string;
  authorAccountId: string | null;
  retentionDeadlineAt: Date | null;
  legacyTopicId: string | null;
  predecessorRecordId: string | null;
  slug: string | null;
  title: string | null;
  question: string | null;
  overview: string | null;
  syntheticEvidence: SyntheticEvidenceCopy | null;
  syntheticStatements: SyntheticStatement[] | null;
  fixtureConversationId: string | null;
  currentProviderEntityId: string | null;
  synthetic: boolean;
};

export type GovernanceEventRow = {
  id: string;
  organizationId: string;
  recordId: string;
  fromState: TopicGovernanceState;
  toState: TopicGovernanceState;
  action: TopicGovernanceAction;
  actorPrincipalKind:
    | "service_operator"
    | "organization_officer"
    | "community_member"
    | "system";
  at: Date;
  reason: string | null;
  metricsSnapshot: Record<string, unknown> | null;
  ruleVersion: string;
  synthetic: boolean;
};

function mapRecord(row: typeof topicGovernanceRecords.$inferSelect): GovernanceRecordRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    publicId: row.publicId,
    state: row.state,
    configVersionId: row.configVersionId,
    authorAccountId: row.authorAccountId,
    retentionDeadlineAt: row.retentionDeadlineAt,
    legacyTopicId: row.legacyTopicId,
    predecessorRecordId: row.predecessorRecordId,
    slug: row.slug,
    title: row.title,
    question: row.question,
    overview: row.overview,
    syntheticEvidence: row.syntheticEvidence ?? null,
    syntheticStatements: row.syntheticStatements ?? null,
    fixtureConversationId: row.fixtureConversationId,
    currentProviderEntityId: row.currentProviderEntityId,
    synthetic: row.synthetic,
  };
}

export async function getGovernanceRecord(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<GovernanceRecordRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(topicGovernanceRecords)
    .where(
      and(
        eq(topicGovernanceRecords.organizationId, id),
        eq(topicGovernanceRecords.id, recordId),
      ),
    )
    .limit(1);
  return row ? mapRecord(row) : null;
}

export async function getGovernanceRecordBySlugOrPublicId(
  db: FoundationDb,
  organizationId: string,
  slugOrPublicId: string,
): Promise<GovernanceRecordRow | null> {
  const id = requireOrganizationId(organizationId);
  const key = slugOrPublicId.trim();
  if (!key) {
    return null;
  }
  const [row] = await db
    .select()
    .from(topicGovernanceRecords)
    .where(
      and(
        eq(topicGovernanceRecords.organizationId, id),
        or(
          eq(topicGovernanceRecords.slug, key),
          eq(topicGovernanceRecords.publicId, key),
          eq(topicGovernanceRecords.id, key),
        ),
      ),
    )
    .limit(1);
  return row ? mapRecord(row) : null;
}

export async function listPublicAgendaRecords(
  db: FoundationDb,
  organizationId: string,
  options: { includeSynthetic: boolean } = { includeSynthetic: true },
): Promise<GovernanceRecordRow[]> {
  const id = requireOrganizationId(organizationId);
  const conditions = [
    eq(topicGovernanceRecords.organizationId, id),
    inArray(topicGovernanceRecords.state, [...PUBLIC_AGENDA_STATES]),
    isNotNull(topicGovernanceRecords.slug),
    isNotNull(topicGovernanceRecords.title),
  ];
  if (!options.includeSynthetic) {
    conditions.push(eq(topicGovernanceRecords.synthetic, false));
  }
  const rows = await db
    .select()
    .from(topicGovernanceRecords)
    .where(and(...conditions))
    .orderBy(asc(topicGovernanceRecords.title));
  return rows.map(mapRecord);
}

export async function listGovernanceEventsForRecord(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<GovernanceEventRow[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select()
    .from(topicGovernanceEvents)
    .where(
      and(
        eq(topicGovernanceEvents.organizationId, id),
        eq(topicGovernanceEvents.recordId, recordId),
      ),
    )
    .orderBy(asc(topicGovernanceEvents.at), asc(topicGovernanceEvents.id));
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    recordId: row.recordId,
    fromState: row.fromState,
    toState: row.toState,
    action: row.action,
    actorPrincipalKind: row.actorPrincipalKind,
    at: row.at,
    reason: row.reason,
    metricsSnapshot: row.metricsSnapshot,
    ruleVersion: row.ruleVersion,
    synthetic: row.synthetic,
  }));
}

export async function insertGovernanceRecord(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    publicId: string;
    state: TopicGovernanceState;
    configVersionId: string;
    authorAccountId?: string | null;
    retentionDeadlineAt?: Date | null;
    legacyTopicId?: string | null;
    predecessorRecordId?: string | null;
    slug?: string | null;
    title?: string | null;
    question?: string | null;
    overview?: string | null;
    syntheticEvidence?: SyntheticEvidenceCopy | null;
    syntheticStatements?: SyntheticStatement[] | null;
    fixtureConversationId?: string | null;
    currentProviderEntityId?: string | null;
    synthetic: boolean;
  },
): Promise<GovernanceRecordRow> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(topicGovernanceRecords).values({
    id: input.id,
    organizationId,
    publicId: input.publicId,
    state: input.state,
    configVersionId: input.configVersionId,
    authorAccountId: input.authorAccountId ?? null,
    retentionDeadlineAt: input.retentionDeadlineAt ?? null,
    legacyTopicId: input.legacyTopicId ?? null,
    predecessorRecordId: input.predecessorRecordId ?? null,
    slug: input.slug ?? null,
    title: input.title ?? null,
    question: input.question ?? null,
    overview: input.overview ?? null,
    syntheticEvidence: input.syntheticEvidence ?? null,
    syntheticStatements: input.syntheticStatements ?? null,
    fixtureConversationId: input.fixtureConversationId ?? null,
    currentProviderEntityId: input.currentProviderEntityId ?? null,
    synthetic: input.synthetic,
  });
  const created = await getGovernanceRecord(db, organizationId, input.id);
  if (!created) {
    throw new Error("GOVERNANCE_INSERT_FAILED");
  }
  return created;
}

export async function updateGovernanceRecordState(
  db: FoundationDb,
  input: {
    organizationId: string;
    recordId: string;
    state: TopicGovernanceState;
    retentionDeadlineAt?: Date | null;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db
    .update(topicGovernanceRecords)
    .set({
      state: input.state,
      retentionDeadlineAt: input.retentionDeadlineAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(topicGovernanceRecords.organizationId, organizationId),
        eq(topicGovernanceRecords.id, input.recordId),
      ),
    );
}

export async function insertGovernanceEvent(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    recordId: string;
    fromState: TopicGovernanceState;
    toState: TopicGovernanceState;
    action: TopicGovernanceAction;
    actorPrincipalKind:
      | "service_operator"
      | "organization_officer"
      | "community_member"
      | "system";
    actorAccountId?: string | null;
    reason?: string | null;
    criteriaTrace?: Record<string, unknown> | null;
    metricsSnapshot?: Record<string, unknown> | null;
    configVersionId: string;
    ruleVersion: string;
    at: Date;
    synthetic: boolean;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(topicGovernanceEvents).values({
    id: input.id,
    organizationId,
    recordId: input.recordId,
    fromState: input.fromState,
    toState: input.toState,
    action: input.action,
    actorPrincipalKind: input.actorPrincipalKind,
    actorAccountId: input.actorAccountId ?? null,
    reason: input.reason ?? null,
    criteriaTrace: input.criteriaTrace ?? null,
    metricsSnapshot: input.metricsSnapshot ?? null,
    configVersionId: input.configVersionId,
    ruleVersion: input.ruleVersion,
    at: input.at,
    synthetic: input.synthetic,
  });
}
