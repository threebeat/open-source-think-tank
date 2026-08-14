import type { RollCallPosition, TopicGovernanceState } from "@/lib/governance/contract";

export const BODY_KINDS = ["chamber", "council"] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

export type RosterSeatDto = {
  memberPublicId: string;
  displayName: string;
  appointmentKind: string;
  termStartsAt: string;
  termEndsAt: string | null;
};

export type RollCallRowDto = {
  memberPublicId: string;
  displayName: string;
  position: RollCallPosition;
  recordedAt: string;
  body: BodyKind;
  topicPublicId: string;
  verdictVersion: number;
};

export type SessionDto = {
  publicId: string;
  status: string;
  timezone: string;
  scheduledOpensAt: string;
  scheduledClosesAt: string;
  synthetic: boolean;
};

export type VerdictVersionDto = {
  version: number;
  outcome: "accepted" | "disputed";
  rationale: string;
  minorityReasoning: string | null;
  publishedAt: string;
  synthetic: boolean;
};

export type RecommendationVersionDto = {
  version: number;
  rationale: string;
  minorityReasoning: string | null;
  publishedAt: string;
  synthetic: boolean;
};

export type BodyTopicListItemDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  realm: string;
  synthetic: boolean;
  publicAgenda: boolean;
};

export type ChamberTopicDetailDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  overview: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  realm: string;
  synthetic: boolean;
  publicAgenda: boolean;
  hostedPolisEnabled: false;
  session: SessionDto | null;
  roster: RosterSeatDto[];
  conflicts: Array<{ memberPublicId: string; kind: string; reason: string }>;
  verdict: VerdictVersionDto | null;
  rollCall: RollCallRowDto[];
  viewerCanVote: boolean;
  viewerMemberPublicId: string | null;
};

export type CouncilTopicDetailDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  overview: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  realm: string;
  synthetic: boolean;
  publicAgenda: boolean;
  hostedPolisEnabled: false;
  session: SessionDto | null;
  roster: RosterSeatDto[];
  conflicts: Array<{ memberPublicId: string; kind: string; reason: string }>;
  intakeReason: string | null;
  recommendation: RecommendationVersionDto | null;
  rollCall: RollCallRowDto[];
  viewerCanVote: boolean;
  viewerMemberPublicId: string | null;
};

export type RecordsTopicDetailDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  overview: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  realm: string;
  synthetic: boolean;
  publicAgenda: boolean;
  hostedPolisEnabled: false;
  chamberVerdict: VerdictVersionDto | null;
  chamberRollCall: RollCallRowDto[];
  councilRecommendation: RecommendationVersionDto | null;
  councilRollCall: RollCallRowDto[];
};

export type BodyListDto = {
  topics: BodyTopicListItemDto[];
  roster: RosterSeatDto[];
  syntheticCatalog: boolean;
  hostedPolisEnabled: false;
};

export function memberPublicIdForAppointment(appointmentId: string): string {
  return `seat-${appointmentId}`;
}
