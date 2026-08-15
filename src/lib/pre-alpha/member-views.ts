import {
  COMMONS_CATEGORY_LABELS,
  FORMAL_COMMONS_CATEGORIES,
  INFORMAL_COMMONS_CATEGORIES,
  MEMBER_CREATE_CATEGORIES,
  UNREVIEWED_CONTENT_DISCLAIMER,
  type CommonsDiscussionDto,
  type CommonsListDto,
} from "@/lib/commons/categories";
import type { AgendaListDto, AgendaTopicDetailDto } from "@/lib/agenda/types";
import type {
  BodyListDto,
  ChamberTopicDetailDto,
  CouncilTopicDetailDto,
} from "@/lib/bodies/types";
import {
  DEMO_AGENDA_TOPICS,
  DEMO_CHAMBER_ROLL,
  DEMO_CHAMBER_ROSTER,
  DEMO_CHAMBER_TOPICS,
  DEMO_COMMONS,
  DEMO_COUNCIL_ROLL,
  DEMO_COUNCIL_ROSTER,
  DEMO_COUNCIL_TOPICS,
  DEMO_ORG_NAME,
  DEMO_RECOMMENDATION,
  DEMO_STATEMENTS,
  DEMO_VERDICT,
} from "@/lib/demo/pre-alpha-fixtures";
import type { PreAlphaLocalAccount, PreAlphaLocalPost } from "@/lib/auth/pre-alpha-local";

export const PRE_ALPHA_ORG_NAME = DEMO_ORG_NAME;

function emptyFormalGroups() {
  return FORMAL_COMMONS_CATEGORIES.map((category) => ({
    category,
    label: COMMONS_CATEGORY_LABELS[category],
    formal: true,
    discussions: [] as CommonsDiscussionDto[],
  }));
}

function emptyInformalGroups() {
  return INFORMAL_COMMONS_CATEGORIES.map((category) => ({
    category,
    label: COMMONS_CATEGORY_LABELS[category],
    formal: false,
    discussions: [] as CommonsDiscussionDto[],
  }));
}

function postToDiscussion(
  post: PreAlphaLocalPost,
  displayName: string,
): CommonsDiscussionDto {
  return {
    publicId: post.publicId,
    category: post.category,
    categoryLabel: COMMONS_CATEGORY_LABELS[post.category],
    formal: false,
    visibility: "listed",
    title: post.title,
    body: post.body,
    createdAt: post.createdAt,
    authorDisplayName: displayName,
    synthetic: false,
    governanceState: null,
    authoredByViewer: true,
    canSubmitForFormalReview: false,
  };
}

export function localCommonsList(account?: PreAlphaLocalAccount | null): CommonsListDto {
  const formal = emptyFormalGroups();
  const informal = emptyInformalGroups();

  for (const group of DEMO_COMMONS.formal) {
    const target = formal.find((row) => row.category === group.category);
    if (target) {
      target.discussions = [...group.discussions];
    }
  }
  for (const group of DEMO_COMMONS.informal) {
    const target = informal.find((row) => row.category === group.category);
    if (target) {
      target.discussions = [...group.discussions];
    }
  }
  if (account) {
    for (const post of account.posts) {
      const discussion = postToDiscussion(post, account.displayName);
      const bucket = informal.find((row) => row.category === post.category);
      bucket?.discussions.unshift(discussion);
    }
  }

  return {
    disclaimer: UNREVIEWED_CONTENT_DISCLAIMER,
    formal,
    informal,
    canPost: true,
    memberCreateCategories: MEMBER_CREATE_CATEGORIES.map((value) => ({
      value,
      label: COMMONS_CATEGORY_LABELS[value],
    })),
  };
}

export function localAgendaList(): AgendaListDto {
  return {
    topics: DEMO_AGENDA_TOPICS,
    hostedPolisEnabled: false,
    syntheticCatalog: true,
  };
}

export function localChamberList(): BodyListDto {
  return {
    topics: DEMO_CHAMBER_TOPICS,
    roster: DEMO_CHAMBER_ROSTER,
    syntheticCatalog: true,
    hostedPolisEnabled: false,
  };
}

export function localCouncilList(): BodyListDto {
  return {
    topics: DEMO_COUNCIL_TOPICS,
    roster: DEMO_COUNCIL_ROSTER,
    syntheticCatalog: true,
    hostedPolisEnabled: false,
  };
}

export function localAgendaTopic(slug: string): AgendaTopicDetailDto | null {
  const topic = DEMO_AGENDA_TOPICS.find(
    (row) => row.slug === slug || row.publicId === slug,
  );
  if (!topic) {
    return null;
  }
  return {
    publicId: topic.publicId,
    slug: topic.slug,
    title: topic.title,
    question: topic.question,
    overview: topic.question,
    state: topic.state,
    stateLabel: topic.stateLabel,
    realm: "community",
    synthetic: true,
    consultationReportVisible: topic.consultationReportVisible,
    canRecordPosition: topic.state === "qualified_consultation",
    hostedPolisEnabled: false,
    fixtureProviderKind: "fixture",
    consultationClosed: topic.state !== "qualified_consultation",
    statements: DEMO_STATEMENTS,
    evidence: [],
    discussions: [],
    history: [],
  };
}

export function localChamberTopic(slug: string): ChamberTopicDetailDto | null {
  const topic = DEMO_CHAMBER_TOPICS.find(
    (row) => row.slug === slug || row.publicId === slug,
  );
  if (!topic) {
    return null;
  }
  return {
    publicId: topic.publicId,
    slug: topic.slug,
    title: topic.title,
    question: topic.question,
    overview: DEMO_VERDICT.rationale,
    state: topic.state,
    stateLabel: topic.stateLabel,
    realm: "chamber",
    synthetic: true,
    publicAgenda: topic.publicAgenda,
    hostedPolisEnabled: false,
    session: {
      publicId: "demo-chamber-session",
      status: "closed",
      timezone: "America/Chicago",
      scheduledOpensAt: DEMO_VERDICT.publishedAt,
      scheduledClosesAt: DEMO_VERDICT.publishedAt,
      synthetic: true,
    },
    roster: DEMO_CHAMBER_ROSTER,
    conflicts: [],
    verdict: DEMO_VERDICT,
    rollCall: DEMO_CHAMBER_ROLL,
    viewerCanVote: false,
    viewerMemberPublicId: null,
  };
}

export function localCouncilTopic(slug: string): CouncilTopicDetailDto | null {
  const topic = DEMO_COUNCIL_TOPICS.find(
    (row) => row.slug === slug || row.publicId === slug,
  );
  if (!topic) {
    return null;
  }
  return {
    publicId: topic.publicId,
    slug: topic.slug,
    title: topic.title,
    question: topic.question,
    overview: DEMO_RECOMMENDATION.rationale,
    state: topic.state,
    stateLabel: topic.stateLabel,
    realm: "council",
    synthetic: true,
    publicAgenda: topic.publicAgenda,
    hostedPolisEnabled: false,
    session: {
      publicId: "demo-council-session",
      status: "closed",
      timezone: "America/Chicago",
      scheduledOpensAt: DEMO_RECOMMENDATION.publishedAt,
      scheduledClosesAt: DEMO_RECOMMENDATION.publishedAt,
      synthetic: true,
    },
    roster: DEMO_COUNCIL_ROSTER,
    conflicts: [],
    intakeReason: null,
    recommendation: DEMO_RECOMMENDATION,
    rollCall: DEMO_COUNCIL_ROLL,
    viewerCanVote: false,
    viewerMemberPublicId: null,
  };
}

export function localCommonsDiscussion(
  publicId: string,
  account?: PreAlphaLocalAccount | null,
): CommonsDiscussionDto | null {
  if (account) {
    const mine = account.posts.find((row) => row.publicId === publicId);
    if (mine) {
      return postToDiscussion(mine, account.displayName);
    }
  }
  const all = [
    ...DEMO_COMMONS.formal.flatMap((group) => group.discussions),
    ...DEMO_COMMONS.informal.flatMap((group) => group.discussions),
  ];
  return all.find((row) => row.publicId === publicId) ?? null;
}
