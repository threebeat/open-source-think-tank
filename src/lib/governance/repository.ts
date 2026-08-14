import { and, eq } from "drizzle-orm";

import { topicGovernanceEvents, topicGovernanceRecords } from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type {
  TopicGovernanceAction,
  TopicGovernanceState,
} from "@/lib/governance/contract";
import { requireOrganizationId } from "@/lib/organizations/ids";

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
  synthetic: boolean;
};

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
  return row
    ? {
        id: row.id,
        organizationId: row.organizationId,
        publicId: row.publicId,
        state: row.state,
        configVersionId: row.configVersionId,
        authorAccountId: row.authorAccountId,
        retentionDeadlineAt: row.retentionDeadlineAt,
        legacyTopicId: row.legacyTopicId,
        predecessorRecordId: row.predecessorRecordId,
        synthetic: row.synthetic,
      }
    : null;
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
