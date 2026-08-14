import type { TopicGovernanceState } from "@/lib/governance/contract";

export const AGENDA_TABS = [
  "overview",
  "evidence",
  "discussion",
  "history",
] as const;

export type AgendaTab = (typeof AGENDA_TABS)[number];

export const MEMBER_POSITIONS = ["agree", "disagree", "pass"] as const;
export type MemberStatementPosition = (typeof MEMBER_POSITIONS)[number];

export type AgendaTopicListItemDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  synthetic: boolean;
  consultationReportVisible: boolean;
};

export type AgendaEvidenceDto = {
  title: string;
  summary: string | null;
  organization: string | null;
  sourceType: string | null;
  authorType: string | null;
  qualityStatus: string;
  limitations: string;
  labeledSynthetic: boolean;
};

export type AgendaStatementDto = {
  publicId: string;
  text: string;
  viewerPosition: MemberStatementPosition | null;
};

export type AgendaDiscussionDto = {
  publicId: string;
  title: string;
  category: string;
  synthetic: boolean;
};

export type AgendaHistoryDto = {
  fromState: string;
  toState: string;
  action: string;
  at: string;
  actorPrincipalKind: string;
  synthetic: boolean;
};

export type AgendaTopicDetailDto = {
  publicId: string;
  slug: string;
  title: string;
  question: string | null;
  overview: string | null;
  state: TopicGovernanceState;
  stateLabel: string;
  realm: string;
  synthetic: boolean;
  consultationReportVisible: boolean;
  canRecordPosition: boolean;
  hostedPolisEnabled: false;
  fixtureProviderKind: "none" | "fixture";
  consultationClosed: boolean;
  statements: AgendaStatementDto[];
  evidence: AgendaEvidenceDto[];
  discussions: AgendaDiscussionDto[];
  history: AgendaHistoryDto[];
};

export type AgendaListDto = {
  topics: AgendaTopicListItemDto[];
  hostedPolisEnabled: false;
  syntheticCatalog: boolean;
};

export function isAgendaTab(value: string): value is AgendaTab {
  return (AGENDA_TABS as readonly string[]).includes(value);
}

export function isMemberStatementPosition(
  value: string,
): value is MemberStatementPosition {
  return (MEMBER_POSITIONS as readonly string[]).includes(value);
}
