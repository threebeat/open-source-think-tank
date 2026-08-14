import { and, asc, eq } from "drizzle-orm";

import {
  commonsDiscussions,
  evidenceSubmissions,
  memberStatementPositions,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { MemberStatementPosition } from "@/lib/agenda/types";
import { requireOrganizationId } from "@/lib/organizations/ids";

export type MemberPositionRow = {
  id: string;
  organizationId: string;
  topicGovernanceRecordId: string;
  accountId: string;
  statementPublicId: string;
  position: MemberStatementPosition;
  synthetic: boolean;
};

export type LinkedDiscussionRow = {
  publicId: string;
  title: string;
  category: string;
  synthetic: boolean;
};

export type LegacyEvidenceRow = {
  title: string;
  organization: string;
  sourceType: string;
  authorType: string;
  qualityStatus: string;
  limitations: string;
};

const EVIDENCE_QUALITY_RANK: Record<string, number> = {
  accepted: 0,
  limited: 1,
  disputed: 2,
  pending: 3,
  rejected: 4,
};

export async function listPositionsForViewer(
  db: FoundationDb,
  input: {
    organizationId: string;
    recordId: string;
    accountId: string;
  },
): Promise<MemberPositionRow[]> {
  const organizationId = requireOrganizationId(input.organizationId);
  const rows = await db
    .select()
    .from(memberStatementPositions)
    .where(
      and(
        eq(memberStatementPositions.organizationId, organizationId),
        eq(memberStatementPositions.topicGovernanceRecordId, input.recordId),
        eq(memberStatementPositions.accountId, input.accountId),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    topicGovernanceRecordId: row.topicGovernanceRecordId,
    accountId: row.accountId,
    statementPublicId: row.statementPublicId,
    position: row.position,
    synthetic: row.synthetic,
  }));
}

export async function upsertMemberPosition(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    recordId: string;
    accountId: string;
    statementPublicId: string;
    position: MemberStatementPosition;
    synthetic: boolean;
  },
): Promise<MemberPositionRow> {
  const organizationId = requireOrganizationId(input.organizationId);
  const now = new Date();
  await db
    .insert(memberStatementPositions)
    .values({
      id: input.id,
      organizationId,
      topicGovernanceRecordId: input.recordId,
      accountId: input.accountId,
      statementPublicId: input.statementPublicId,
      position: input.position,
      synthetic: input.synthetic,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        memberStatementPositions.organizationId,
        memberStatementPositions.topicGovernanceRecordId,
        memberStatementPositions.accountId,
        memberStatementPositions.statementPublicId,
      ],
      set: {
        position: input.position,
        updatedAt: now,
      },
    });

  const [row] = await db
    .select()
    .from(memberStatementPositions)
    .where(
      and(
        eq(memberStatementPositions.organizationId, organizationId),
        eq(memberStatementPositions.topicGovernanceRecordId, input.recordId),
        eq(memberStatementPositions.accountId, input.accountId),
        eq(memberStatementPositions.statementPublicId, input.statementPublicId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error("MEMBER_POSITION_UPSERT_FAILED");
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    topicGovernanceRecordId: row.topicGovernanceRecordId,
    accountId: row.accountId,
    statementPublicId: row.statementPublicId,
    position: row.position,
    synthetic: row.synthetic,
  };
}

export async function listLinkedDiscussions(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<LinkedDiscussionRow[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select({
      publicId: commonsDiscussions.publicId,
      title: commonsDiscussions.title,
      category: commonsDiscussions.category,
      synthetic: commonsDiscussions.synthetic,
    })
    .from(commonsDiscussions)
    .where(
      and(
        eq(commonsDiscussions.organizationId, id),
        eq(commonsDiscussions.topicGovernanceRecordId, recordId),
        eq(commonsDiscussions.visibility, "listed"),
      ),
    )
    .orderBy(asc(commonsDiscussions.createdAt));
  return rows;
}

/**
 * Legacy evidence for a linked topic. Ordered by quality status then title —
 * never by consultation popularity or position counts.
 */
export async function listLegacyEvidenceForTopic(
  db: FoundationDb,
  topicId: string,
): Promise<LegacyEvidenceRow[]> {
  const rows = await db
    .select({
      title: evidenceSubmissions.title,
      organization: evidenceSubmissions.organization,
      sourceType: evidenceSubmissions.sourceType,
      authorType: evidenceSubmissions.authorType,
      qualityStatus: evidenceSubmissions.qualityStatus,
      limitations: evidenceSubmissions.limitations,
    })
    .from(evidenceSubmissions)
    .where(
      and(
        eq(evidenceSubmissions.topicId, topicId),
        eq(evidenceSubmissions.workflowState, "accepted"),
        eq(evidenceSubmissions.moderationVisibility, "visible"),
      ),
    );
  return [...rows].sort((a, b) => {
    const rankA = EVIDENCE_QUALITY_RANK[a.qualityStatus] ?? 99;
    const rankB = EVIDENCE_QUALITY_RANK[b.qualityStatus] ?? 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.title.localeCompare(b.title);
  });
}
