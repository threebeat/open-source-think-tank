import type { TopicGovernanceState } from "@/lib/governance/contract";

export const FORMAL_COMMONS_CATEGORIES = [
  "moderator_communications",
  "council_communications",
  "qualified_topic_discussions",
  "qualified_approach_discussions",
  "community_actions",
] as const;

export const INFORMAL_COMMONS_CATEGORIES = [
  "topic_proposals",
  "approach_proposals",
  "general_discussion",
  "disqualified_topics",
] as const;

export const COMMONS_CATEGORIES = [
  ...FORMAL_COMMONS_CATEGORIES,
  ...INFORMAL_COMMONS_CATEGORIES,
] as const;

export type CommonsCategory = (typeof COMMONS_CATEGORIES)[number];
export type FormalCommonsCategory = (typeof FORMAL_COMMONS_CATEGORIES)[number];
export type InformalCommonsCategory = (typeof INFORMAL_COMMONS_CATEGORIES)[number];

/** Informal categories community members may create. Disqualified Topics is honorable-loss projection only. */
export const MEMBER_CREATE_CATEGORIES = [
  "topic_proposals",
  "approach_proposals",
  "general_discussion",
] as const;

export type MemberCreateCategory = (typeof MEMBER_CREATE_CATEGORIES)[number];

export const COMMONS_CATEGORY_LABELS: Record<CommonsCategory, string> = {
  moderator_communications: "Moderator communications",
  council_communications: "Council communications",
  qualified_topic_discussions: "Qualified topic discussions",
  qualified_approach_discussions: "Qualified approach discussions",
  community_actions: "Community actions",
  topic_proposals: "Topic proposals",
  approach_proposals: "Approach proposals",
  general_discussion: "General discussion",
  disqualified_topics: "Disqualified Topics",
};

/**
 * Exact unreviewed-content disclaimer from docs/v2/community-standards.md.
 * Do not paraphrase in UI.
 */
export const UNREVIEWED_CONTENT_DISCLAIMER =
  "Informal conversations may not have been reviewed by a moderator and have not qualified for community deliberation. Their presence does not mean the organization endorses their claims, evidence, or conduct. Report rule-breaking content; challenge ideas without attacking people.";

export const COMMONS_VISIBILITIES = ["listed", "hidden"] as const;
export type CommonsVisibility = (typeof COMMONS_VISIBILITIES)[number];

export function isCommonsCategory(value: string): value is CommonsCategory {
  return (COMMONS_CATEGORIES as readonly string[]).includes(value);
}

export function isMemberCreateCategory(
  value: string,
): value is MemberCreateCategory {
  return (MEMBER_CREATE_CATEGORIES as readonly string[]).includes(value);
}

export function isFormalCategory(category: CommonsCategory): boolean {
  return (FORMAL_COMMONS_CATEGORIES as readonly string[]).includes(category);
}

export function isProposalCategory(category: CommonsCategory): boolean {
  return category === "topic_proposals" || category === "approach_proposals";
}

/** Member-facing discussion DTO — allowlist. Never includes internal account ids. */
export type CommonsDiscussionDto = {
  publicId: string;
  category: CommonsCategory;
  categoryLabel: string;
  formal: boolean;
  visibility: CommonsVisibility;
  title: string;
  body: string;
  createdAt: string;
  authorDisplayName: string;
  synthetic: boolean;
  governanceState: TopicGovernanceState | null;
  authoredByViewer: boolean;
  canSubmitForFormalReview: boolean;
};

export type CommonsCategoryGroupDto = {
  category: CommonsCategory;
  label: string;
  formal: boolean;
  discussions: CommonsDiscussionDto[];
};

export type CommonsListDto = {
  disclaimer: string;
  formal: CommonsCategoryGroupDto[];
  informal: CommonsCategoryGroupDto[];
  canPost: boolean;
  memberCreateCategories: Array<{
    value: MemberCreateCategory;
    label: string;
  }>;
};
