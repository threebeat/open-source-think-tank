import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { hashToken, newEntityId } from "@/lib/auth/tokens";
import type { AuthzPrincipal } from "@/lib/authz/types";
import {
  COMMONS_CATEGORY_LABELS,
  FORMAL_COMMONS_CATEGORIES,
  INFORMAL_COMMONS_CATEGORIES,
  MEMBER_CREATE_CATEGORIES,
  UNREVIEWED_CONTENT_DISCLAIMER,
  isMemberCreateCategory,
  isProposalCategory,
  type CommonsDiscussionDto,
  type CommonsListDto,
  type MemberCreateCategory,
} from "@/lib/commons/categories";
import {
  getDiscussionByPublicId,
  insertDiscussion,
  insertDiscussionRevision,
  listDiscussionsForOrganization,
  type CommonsDiscussionRow,
} from "@/lib/commons/repository";
import type { FoundationDb } from "@/db/types";
import {
  createGovernanceRecord,
  transitionGovernanceRecord,
} from "@/lib/governance/service";
import { getPublishedConfigVersion } from "@/lib/organizations/config-repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { hasCommunityMembershipInOrganization } from "@/lib/organizations/membership-repository";
import { getOrganization } from "@/lib/organizations/repository";
import {
  getMutationRateLimiter,
} from "@/lib/security/mutation-rate-limit";
import {
  assertOrganizationMutationAllowed,
  isSyntheticSeedEnabled,
} from "@/lib/v2/flags";

const TITLE_MAX = 200;
const BODY_MAX = 20_000;

function communityMemberInOrg(
  principal: AuthzPrincipal | null | undefined,
  organizationId: string,
): boolean {
  if (!principal) {
    return false;
  }
  if (principal.lifecycleState !== "active") {
    return false;
  }
  return hasCommunityMembershipInOrganization(
    principal.organizationMemberships ?? [],
    organizationId,
  );
}

function toDto(
  row: CommonsDiscussionRow,
  viewerAccountId: string | null,
): CommonsDiscussionDto {
  const authoredByViewer = Boolean(
    viewerAccountId && row.authorAccountId === viewerAccountId,
  );
  return {
    publicId: row.publicId,
    category: row.category,
    categoryLabel: COMMONS_CATEGORY_LABELS[row.category],
    formal: row.formal,
    visibility: row.visibility,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorDisplayName: row.authorDisplayName?.trim() || "Community member",
    synthetic: row.synthetic,
    governanceState: row.governanceState,
    authoredByViewer,
    canSubmitForFormalReview:
      authoredByViewer &&
      isProposalCategory(row.category) &&
      row.governanceState === "informal_draft",
  };
}

export async function listCommons(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
  },
): Promise<AdapterResult<CommonsListDto>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const includeSynthetic = isSyntheticSeedEnabled();
  const rows = await listDiscussionsForOrganization(db, organizationId, {
    includeSynthetic,
  });
  const viewerId = input.principal?.accountId ?? null;
  const grouped = new Map(
    [...FORMAL_COMMONS_CATEGORIES, ...INFORMAL_COMMONS_CATEGORIES].map(
      (category) => [category, [] as CommonsDiscussionDto[]],
    ),
  );
  for (const row of rows) {
    grouped.get(row.category)?.push(toDto(row, viewerId));
  }

  const canPost = communityMemberInOrg(input.principal, organizationId);
  return {
    ok: true,
    value: {
      disclaimer: UNREVIEWED_CONTENT_DISCLAIMER,
      formal: FORMAL_COMMONS_CATEGORIES.map((category) => ({
        category,
        label: COMMONS_CATEGORY_LABELS[category],
        formal: true,
        discussions: grouped.get(category) ?? [],
      })),
      informal: INFORMAL_COMMONS_CATEGORIES.map((category) => ({
        category,
        label: COMMONS_CATEGORY_LABELS[category],
        formal: false,
        discussions: grouped.get(category) ?? [],
      })),
      canPost,
      memberCreateCategories: MEMBER_CREATE_CATEGORIES.map((value) => ({
        value,
        label: COMMONS_CATEGORY_LABELS[value],
      })),
    },
  };
}

export async function getDiscussion(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    publicId: string;
  },
): Promise<AdapterResult<CommonsDiscussionDto>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const row = await getDiscussionByPublicId(
    db,
    organizationId,
    input.publicId,
  );
  if (!row || row.visibility !== "listed") {
    return {
      ok: false,
      code: "COMMONS_DISCUSSION_NOT_FOUND",
      error: "Discussion not found in this organization",
    };
  }
  if (row.synthetic && !isSyntheticSeedEnabled()) {
    return {
      ok: false,
      code: "COMMONS_DISCUSSION_NOT_FOUND",
      error: "Discussion not found in this organization",
    };
  }
  return {
    ok: true,
    value: toDto(row, input.principal?.accountId ?? null),
  };
}

export async function createPost(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    category: string;
    title: string;
    body: string;
    /** Ignored. Formal status is projected from category rules. */
    formal?: boolean;
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ publicId: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const principal = input.principal;
  if (!principal) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Authentication required",
    };
  }
  if (!communityMemberInOrg(principal, organizationId)) {
    return {
      ok: false,
      code: "COMMONS_MEMBERSHIP_REQUIRED",
      error:
        "Posting requires community membership in this organization. Organization-admin or Chamber status is not a substitute.",
    };
  }
  if (input.formal === true) {
    return {
      ok: false,
      code: "COMMONS_FORMAL_FORBIDDEN",
      error: "Members cannot mark a post as formal",
    };
  }
  if (!isMemberCreateCategory(input.category)) {
    return {
      ok: false,
      code: "COMMONS_CATEGORY_FORBIDDEN",
      error: "Community members may post only in informal Commons categories",
    };
  }
  const category: MemberCreateCategory = input.category;
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > TITLE_MAX) {
    return {
      ok: false,
      code: "COMMONS_TITLE_INVALID",
      error: `Title is required and must be at most ${TITLE_MAX} characters`,
    };
  }
  if (!body || body.length > BODY_MAX) {
    return {
      ok: false,
      code: "COMMONS_BODY_INVALID",
      error: `Body is required and must be at most ${BODY_MAX} characters`,
    };
  }

  const originRef = input.clientIp
    ? hashToken(input.clientIp).slice(0, 16)
    : null;
  const limited = getMutationRateLimiter().consume({
    family: "commons_post",
    accountId: principal.accountId,
    originRef,
  });
  if (!limited.ok) {
    return {
      ok: false,
      code: "COMMONS_RATE_LIMITED",
      error: `Too many posts. Try again in ${limited.retryAfterSeconds} seconds.`,
    };
  }

  const org = await getOrganization(db, organizationId);
  if (!org) {
    return {
      ok: false,
      code: "ORGANIZATION_NOT_FOUND",
      error: "Organization not found",
    };
  }

  let topicGovernanceRecordId: string | null = null;
  if (isProposalCategory(category)) {
    const published = await getPublishedConfigVersion(db, organizationId);
    if (!published) {
      return {
        ok: false,
        code: "COMMONS_CONFIG_MISSING",
        error: "A published organization configuration is required for proposals",
      };
    }
    const createdGov = await createGovernanceRecord(db, {
      organizationId,
      publicId: newEntityId("govpub"),
      configVersionId: published.id,
      authorAccountId: principal.accountId,
      synthetic: false,
    });
    if (!createdGov.ok) {
      return createdGov;
    }
    topicGovernanceRecordId = createdGov.value.recordId;
  }

  const discussionId = newEntityId("cdisc");
  const publicId = newEntityId("cpub");
  const created = await insertDiscussion(db, {
    id: discussionId,
    organizationId,
    publicId,
    category,
    formal: false,
    visibility: "listed",
    authorAccountId: principal.accountId,
    title,
    body,
    topicGovernanceRecordId,
    synthetic: false,
  });
  await insertDiscussionRevision(db, {
    id: newEntityId("crev"),
    organizationId,
    discussionId: created.id,
    revisionNumber: 1,
    editorAccountId: principal.accountId,
    title,
    body,
    category,
    synthetic: false,
  });

  await appendAuthAudit(db, {
    actorRole: "community_member",
    actorAccountId: principal.accountId,
    action: "commons.discussion.created",
    subjectType: "commons_discussion",
    subjectId: created.id,
    summary: "A Commons discussion was posted.",
    privatePayload: {
      organizationPublicId: org.publicId,
      category,
      discussionPublicId: created.publicId,
    },
    synthetic: principal.synthetic,
    organizationId,
    actorPrincipalKind: "community_member",
    projectionClass: "protected",
  });

  return { ok: true, value: { publicId: created.publicId } };
}

export async function submitForFormalReview(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    publicId: string;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const principal = input.principal;
  if (!principal) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Authentication required",
    };
  }
  if (!communityMemberInOrg(principal, organizationId)) {
    return {
      ok: false,
      code: "COMMONS_MEMBERSHIP_REQUIRED",
      error: "Community membership is required to submit a proposal",
    };
  }

  const discussion = await getDiscussionByPublicId(
    db,
    organizationId,
    input.publicId,
  );
  if (!discussion) {
    return {
      ok: false,
      code: "COMMONS_DISCUSSION_NOT_FOUND",
      error: "Discussion not found in this organization",
    };
  }
  if (!isProposalCategory(discussion.category)) {
    return {
      ok: false,
      code: "COMMONS_NOT_A_PROPOSAL",
      error: "Only topic or approach proposals can be submitted for formal review",
    };
  }
  if (discussion.authorAccountId !== principal.accountId) {
    return {
      ok: false,
      code: "COMMONS_AUTHOR_REQUIRED",
      error: "Only the author can submit this proposal for formal review",
    };
  }
  if (!discussion.topicGovernanceRecordId) {
    return {
      ok: false,
      code: "COMMONS_GOVERNANCE_MISSING",
      error: "This proposal has no governance record",
    };
  }

  const transitioned = await transitionGovernanceRecord(db, {
    principal,
    organizationId,
    recordId: discussion.topicGovernanceRecordId,
    action: "submit_for_formal_review",
    actor: "community_member",
    synthetic: principal.synthetic,
  });
  if (!transitioned.ok) {
    return transitioned;
  }

  const org = await getOrganization(db, organizationId);
  await appendAuthAudit(db, {
    actorRole: "community_member",
    actorAccountId: principal.accountId,
    action: "commons.formal_review.submitted",
    subjectType: "commons_discussion",
    subjectId: discussion.id,
    summary: "A proposal was submitted for formal review.",
    privatePayload: {
      organizationPublicId: org?.publicId ?? organizationId,
      discussionPublicId: discussion.publicId,
      governanceAction: "submit_for_formal_review",
    },
    synthetic: principal.synthetic,
    organizationId,
    actorPrincipalKind: "community_member",
    projectionClass: "protected",
  });

  return transitioned;
}

/**
 * Qualification is a moderator kernel action. Commons never exposes a shortcut.
 * Authors cannot qualify their own proposal even with a moderator appointment.
 */
export async function qualifyOwnProposalDenied(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    publicId: string;
  },
): Promise<AdapterResult<{ to: string }>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const discussion = await getDiscussionByPublicId(
    db,
    organizationId,
    input.publicId,
  );
  if (!discussion?.topicGovernanceRecordId) {
    return {
      ok: false,
      code: "COMMONS_DISCUSSION_NOT_FOUND",
      error: "Discussion not found in this organization",
    };
  }
  if (
    input.principal?.accountId &&
    discussion.authorAccountId === input.principal.accountId
  ) {
    return {
      ok: false,
      code: "GOVERNANCE_SELF_REVIEW_FORBIDDEN",
      error: "A moderator cannot qualify their own proposal",
    };
  }
  return transitionGovernanceRecord(db, {
    principal: input.principal,
    organizationId,
    recordId: discussion.topicGovernanceRecordId,
    action: "qualify",
    actor: "moderator",
    criteriaTrace: { criteriaVersion: "test-only" },
    synthetic: input.principal?.synthetic ?? true,
  });
}
