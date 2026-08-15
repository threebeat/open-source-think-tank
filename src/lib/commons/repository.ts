import { and, desc, eq } from "drizzle-orm";

import {
  commonsDiscussionRevisions,
  commonsDiscussions,
  profiles,
  topicGovernanceRecords,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { CommonsCategory, CommonsVisibility } from "@/lib/commons/categories";
import type { TopicGovernanceState } from "@/lib/governance/contract";
import { requireOrganizationId } from "@/lib/organizations/ids";

export type CommonsDiscussionRow = {
  id: string;
  organizationId: string;
  publicId: string;
  category: CommonsCategory;
  formal: boolean;
  visibility: CommonsVisibility;
  authorAccountId: string;
  title: string;
  body: string;
  parentDiscussionId: string | null;
  topicGovernanceRecordId: string | null;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorDisplayName: string | null;
  governanceState: TopicGovernanceState | null;
};

function mapRow(row: {
  id: string;
  organizationId: string;
  publicId: string;
  category: CommonsCategory;
  formal: boolean;
  visibility: CommonsVisibility;
  authorAccountId: string;
  title: string;
  body: string;
  parentDiscussionId: string | null;
  topicGovernanceRecordId: string | null;
  synthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorDisplayName: string | null;
  governanceState: TopicGovernanceState | null;
}): CommonsDiscussionRow {
  return row;
}

export async function getDiscussionByPublicId(
  db: FoundationDb,
  organizationId: string,
  publicId: string,
): Promise<CommonsDiscussionRow | null> {
  const id = requireOrganizationId(organizationId);
  if (!publicId.trim()) {
    return null;
  }
  const [row] = await db
    .select({
      id: commonsDiscussions.id,
      organizationId: commonsDiscussions.organizationId,
      publicId: commonsDiscussions.publicId,
      category: commonsDiscussions.category,
      formal: commonsDiscussions.formal,
      visibility: commonsDiscussions.visibility,
      authorAccountId: commonsDiscussions.authorAccountId,
      title: commonsDiscussions.title,
      body: commonsDiscussions.body,
      parentDiscussionId: commonsDiscussions.parentDiscussionId,
      topicGovernanceRecordId: commonsDiscussions.topicGovernanceRecordId,
      synthetic: commonsDiscussions.synthetic,
      createdAt: commonsDiscussions.createdAt,
      updatedAt: commonsDiscussions.updatedAt,
      authorDisplayName: profiles.preferredDisplayName,
      governanceState: topicGovernanceRecords.state,
    })
    .from(commonsDiscussions)
    .leftJoin(
      profiles,
      eq(profiles.accountId, commonsDiscussions.authorAccountId),
    )
    .leftJoin(
      topicGovernanceRecords,
      and(
        eq(topicGovernanceRecords.organizationId, commonsDiscussions.organizationId),
        eq(topicGovernanceRecords.id, commonsDiscussions.topicGovernanceRecordId),
      ),
    )
    .where(
      and(
        eq(commonsDiscussions.organizationId, id),
        eq(commonsDiscussions.publicId, publicId.trim()),
      ),
    )
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getDiscussionById(
  db: FoundationDb,
  organizationId: string,
  discussionId: string,
): Promise<CommonsDiscussionRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select({
      id: commonsDiscussions.id,
      organizationId: commonsDiscussions.organizationId,
      publicId: commonsDiscussions.publicId,
      category: commonsDiscussions.category,
      formal: commonsDiscussions.formal,
      visibility: commonsDiscussions.visibility,
      authorAccountId: commonsDiscussions.authorAccountId,
      title: commonsDiscussions.title,
      body: commonsDiscussions.body,
      parentDiscussionId: commonsDiscussions.parentDiscussionId,
      topicGovernanceRecordId: commonsDiscussions.topicGovernanceRecordId,
      synthetic: commonsDiscussions.synthetic,
      createdAt: commonsDiscussions.createdAt,
      updatedAt: commonsDiscussions.updatedAt,
      authorDisplayName: profiles.preferredDisplayName,
      governanceState: topicGovernanceRecords.state,
    })
    .from(commonsDiscussions)
    .leftJoin(
      profiles,
      eq(profiles.accountId, commonsDiscussions.authorAccountId),
    )
    .leftJoin(
      topicGovernanceRecords,
      and(
        eq(topicGovernanceRecords.organizationId, commonsDiscussions.organizationId),
        eq(topicGovernanceRecords.id, commonsDiscussions.topicGovernanceRecordId),
      ),
    )
    .where(
      and(
        eq(commonsDiscussions.organizationId, id),
        eq(commonsDiscussions.id, discussionId),
      ),
    )
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function listDiscussionsForOrganization(
  db: FoundationDb,
  organizationId: string,
  options?: { includeSynthetic?: boolean },
): Promise<CommonsDiscussionRow[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select({
      id: commonsDiscussions.id,
      organizationId: commonsDiscussions.organizationId,
      publicId: commonsDiscussions.publicId,
      category: commonsDiscussions.category,
      formal: commonsDiscussions.formal,
      visibility: commonsDiscussions.visibility,
      authorAccountId: commonsDiscussions.authorAccountId,
      title: commonsDiscussions.title,
      body: commonsDiscussions.body,
      parentDiscussionId: commonsDiscussions.parentDiscussionId,
      topicGovernanceRecordId: commonsDiscussions.topicGovernanceRecordId,
      synthetic: commonsDiscussions.synthetic,
      createdAt: commonsDiscussions.createdAt,
      updatedAt: commonsDiscussions.updatedAt,
      authorDisplayName: profiles.preferredDisplayName,
      governanceState: topicGovernanceRecords.state,
    })
    .from(commonsDiscussions)
    .leftJoin(
      profiles,
      eq(profiles.accountId, commonsDiscussions.authorAccountId),
    )
    .leftJoin(
      topicGovernanceRecords,
      and(
        eq(topicGovernanceRecords.organizationId, commonsDiscussions.organizationId),
        eq(topicGovernanceRecords.id, commonsDiscussions.topicGovernanceRecordId),
      ),
    )
    .where(
      and(
        eq(commonsDiscussions.organizationId, id),
        eq(commonsDiscussions.visibility, "listed"),
      ),
    )
    .orderBy(desc(commonsDiscussions.createdAt));

  const mapped = rows.map(mapRow);
  if (options?.includeSynthetic === false) {
    return mapped.filter((row) => !row.synthetic);
  }
  return mapped;
}

export async function listDiscussionsForAuthor(
  db: FoundationDb,
  organizationId: string,
  authorAccountId: string,
): Promise<CommonsDiscussionRow[]> {
  if (!authorAccountId.trim()) {
    throw new Error("ACCOUNT_ID_REQUIRED");
  }
  const rows = await listDiscussionsForOrganization(db, organizationId);
  return rows.filter((row) => row.authorAccountId === authorAccountId);
}

export async function insertDiscussion(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    publicId: string;
    category: CommonsCategory;
    formal: boolean;
    visibility: CommonsVisibility;
    authorAccountId: string;
    title: string;
    body: string;
    parentDiscussionId?: string | null;
    topicGovernanceRecordId?: string | null;
    synthetic: boolean;
  },
): Promise<CommonsDiscussionRow> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(commonsDiscussions).values({
    id: input.id,
    organizationId,
    publicId: input.publicId,
    category: input.category,
    formal: input.formal,
    visibility: input.visibility,
    authorAccountId: input.authorAccountId,
    title: input.title,
    body: input.body,
    parentDiscussionId: input.parentDiscussionId ?? null,
    topicGovernanceRecordId: input.topicGovernanceRecordId ?? null,
    synthetic: input.synthetic,
  });
  const created = await getDiscussionById(db, organizationId, input.id);
  if (!created) {
    throw new Error("COMMONS_INSERT_FAILED");
  }
  return created;
}

export async function insertDiscussionRevision(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    discussionId: string;
    revisionNumber: number;
    editorAccountId: string;
    title: string;
    body: string;
    category: CommonsCategory;
    synthetic: boolean;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(commonsDiscussionRevisions).values({
    id: input.id,
    organizationId,
    discussionId: input.discussionId,
    revisionNumber: input.revisionNumber,
    editorAccountId: input.editorAccountId,
    title: input.title,
    body: input.body,
    category: input.category,
    synthetic: input.synthetic,
  });
}
