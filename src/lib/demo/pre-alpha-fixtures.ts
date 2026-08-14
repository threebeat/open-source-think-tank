import {
  COMMONS_CATEGORY_LABELS,
  UNREVIEWED_CONTENT_DISCLAIMER,
  type CommonsListDto,
} from "@/lib/commons/categories";
import type { AgendaStatementDto, AgendaTopicListItemDto } from "@/lib/agenda/types";
import type {
  BodyTopicListItemDto,
  RecommendationVersionDto,
  RollCallRowDto,
  RosterSeatDto,
  VerdictVersionDto,
} from "@/lib/bodies/types";

const CREATED = "2026-08-01T15:00:00.000Z";
const SESSION = "2026-08-14T17:00:00.000Z";

export const DEMO_ORG_NAME = "Synthetic Alpha Hall";

export const DEMO_COMMONS: CommonsListDto = {
  disclaimer: UNREVIEWED_CONTENT_DISCLAIMER,
  canPost: false,
  memberCreateCategories: [],
  formal: [
    {
      category: "qualified_topic_discussions",
      label: COMMONS_CATEGORY_LABELS.qualified_topic_discussions,
      formal: true,
      discussions: [
        {
          publicId: "demo-sidewalk-thread",
          category: "qualified_topic_discussions",
          categoryLabel: COMMONS_CATEGORY_LABELS.qualified_topic_discussions,
          formal: true,
          visibility: "listed",
          title: "Sidewalk repair on River Path",
          body: "Neighbors asked the hall to publish a repair sequence for the broken slabs between Oak and Third. This thread is already qualified — it is not informal Commons chatter.",
          createdAt: CREATED,
          authorDisplayName: "Maya Chen",
          synthetic: true,
          governanceState: "community_accepted",
          authoredByViewer: false,
          canSubmitForFormalReview: false,
        },
      ],
    },
  ],
  informal: [
    {
      category: "general_discussion",
      label: COMMONS_CATEGORY_LABELS.general_discussion,
      formal: false,
      discussions: [
        {
          publicId: "demo-lighting-thread",
          category: "general_discussion",
          categoryLabel: COMMONS_CATEGORY_LABELS.general_discussion,
          formal: false,
          visibility: "listed",
          title: "Should we add lighting on the river walkway?",
          body: "Evening walkers say the last two blocks feel dark after 8 p.m. This is an informal post. It has not been qualified and is not a Chamber item.",
          createdAt: CREATED,
          authorDisplayName: "Jordan Hale",
          synthetic: true,
          governanceState: null,
          authoredByViewer: false,
          canSubmitForFormalReview: false,
        },
      ],
    },
    {
      category: "topic_proposals",
      label: COMMONS_CATEGORY_LABELS.topic_proposals,
      formal: false,
      discussions: [
        {
          publicId: "demo-library-proposal",
          category: "topic_proposals",
          categoryLabel: COMMONS_CATEGORY_LABELS.topic_proposals,
          formal: false,
          visibility: "listed",
          title: "Weekend library hours proposal",
          body: "A member proposed Saturday afternoon hours. Qualification is a separate record from whether people like the idea.",
          createdAt: CREATED,
          authorDisplayName: "Priya Shah",
          synthetic: true,
          governanceState: "formal_review_pending",
          authoredByViewer: false,
          canSubmitForFormalReview: false,
        },
      ],
    },
  ],
};

export const DEMO_AGENDA_TOPICS: AgendaTopicListItemDto[] = [
  {
    publicId: "demo-agenda-transit",
    slug: "ostt-synth-evening-transit",
    title: "Synthetic qualified topic: evening transit reliability",
    question: "Which evening-route changes should the hall try first?",
    state: "qualified_consultation",
    stateLabel: "Consultation open",
    synthetic: true,
    consultationReportVisible: false,
  },
  {
    publicId: "demo-agenda-sidewalk",
    slug: "ostt-synth-sidewalk-repair",
    title: "Synthetic qualified topic: sidewalk repair",
    question: "How should the hall sequence River Path slab repairs?",
    state: "recommendations_published",
    stateLabel: "Recommendations published",
    synthetic: true,
    consultationReportVisible: true,
  },
];

export const DEMO_STATEMENTS: AgendaStatementDto[] = [
  {
    publicId: "demo-stmt-frequency",
    text: "Add one extra evening bus on the river loop before cutting weekend service.",
    viewerPosition: null,
  },
  {
    publicId: "demo-stmt-lighting",
    text: "Pair any route change with lighting on the last two walkway blocks.",
    viewerPosition: null,
  },
];

export const DEMO_CHAMBER_TOPICS: BodyTopicListItemDto[] = [
  {
    publicId: "demo-chamber-sidewalk",
    slug: "ostt-synth-sidewalk-repair",
    title: "Synthetic qualified topic: sidewalk repair",
    question: "How should the hall sequence River Path slab repairs?",
    state: "recommendations_published",
    stateLabel: "Recommendations published",
    realm: "chamber",
    synthetic: true,
    publicAgenda: false,
  },
];

export const DEMO_COUNCIL_TOPICS: BodyTopicListItemDto[] = [
  {
    publicId: "demo-council-sidewalk",
    slug: "ostt-synth-sidewalk-repair",
    title: "Synthetic qualified topic: sidewalk repair",
    question: "How should the hall sequence River Path slab repairs?",
    state: "recommendations_published",
    stateLabel: "Recommendations published",
    realm: "council",
    synthetic: true,
    publicAgenda: false,
  },
];

export const DEMO_CHAMBER_ROSTER: RosterSeatDto[] = [
  {
    memberPublicId: "seat-demo-clerk",
    displayName: "Alex Rivera",
    appointmentKind: "chamber_clerk",
    termStartsAt: CREATED,
    termEndsAt: null,
  },
  {
    memberPublicId: "seat-demo-a",
    displayName: "Sam Okonkwo",
    appointmentKind: "chamber_member",
    termStartsAt: CREATED,
    termEndsAt: null,
  },
  {
    memberPublicId: "seat-demo-b",
    displayName: "Lee Park",
    appointmentKind: "chamber_member",
    termStartsAt: CREATED,
    termEndsAt: null,
  },
];

export const DEMO_COUNCIL_ROSTER: RosterSeatDto[] = [
  {
    memberPublicId: "seat-demo-council-clerk",
    displayName: "Noor Rahman",
    appointmentKind: "council_clerk",
    termStartsAt: CREATED,
    termEndsAt: null,
  },
  {
    memberPublicId: "seat-demo-council-a",
    displayName: "Chris Vogel",
    appointmentKind: "council_member",
    termStartsAt: CREATED,
    termEndsAt: null,
  },
];

export const DEMO_CHAMBER_ROLL: RollCallRowDto[] = [
  {
    memberPublicId: "seat-demo-clerk",
    displayName: "Alex Rivera",
    position: "yes",
    recordedAt: SESSION,
    body: "chamber",
    topicPublicId: "demo-chamber-sidewalk",
    verdictVersion: 1,
  },
  {
    memberPublicId: "seat-demo-a",
    displayName: "Sam Okonkwo",
    position: "no",
    recordedAt: SESSION,
    body: "chamber",
    topicPublicId: "demo-chamber-sidewalk",
    verdictVersion: 1,
  },
  {
    memberPublicId: "seat-demo-b",
    displayName: "Lee Park",
    position: "recused",
    recordedAt: SESSION,
    body: "chamber",
    topicPublicId: "demo-chamber-sidewalk",
    verdictVersion: 1,
  },
];

export const DEMO_COUNCIL_ROLL: RollCallRowDto[] = [
  {
    memberPublicId: "seat-demo-council-clerk",
    displayName: "Noor Rahman",
    position: "yes",
    recordedAt: SESSION,
    body: "council",
    topicPublicId: "demo-council-sidewalk",
    verdictVersion: 1,
  },
  {
    memberPublicId: "seat-demo-council-a",
    displayName: "Chris Vogel",
    position: "abstain",
    recordedAt: SESSION,
    body: "council",
    topicPublicId: "demo-council-sidewalk",
    verdictVersion: 1,
  },
];

export const DEMO_VERDICT: VerdictVersionDto = {
  version: 1,
  outcome: "accepted",
  rationale:
    "The Chamber accepted a sequenced repair plan for the River Path slabs and asked Council to publish a recommendation.",
  minorityReasoning: "One seat preferred a full-block closure over sequenced patches.",
  publishedAt: SESSION,
  synthetic: true,
};

export const DEMO_RECOMMENDATION: RecommendationVersionDto = {
  version: 1,
  rationale:
    "Council recommends the sequenced repair, with lighting treated as a linked but separate Commons question.",
  minorityReasoning: null,
  publishedAt: SESSION,
  synthetic: true,
};

export const DEMO_NONPROFIT_CONTACT = {
  organizationName: "Commonhall Civic Workshop (synthetic)",
  email: "hello@commonhall.example",
  phone: "+1 (615) 555-0142",
  mail: "100 Public Square, Suite 2, Nashville, TN 37201",
  hours: "Weekdays 10:00–16:00 America/Chicago",
};
