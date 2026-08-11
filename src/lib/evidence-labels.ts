import type {
  AgendaState,
  AmendmentStatus,
  AuthorType,
  CouncilRole,
  DecisionOutcome,
  EvidenceReviewStatus,
  ProposalState,
  SourceType,
  TopicStage,
  TopicStatus,
  VoteChoice,
} from "@/domain/status";

export const evidenceReviewLabels: Record<EvidenceReviewStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  limited: "Limited",
  disputed: "Disputed",
  rejected: "Rejected",
};

export const evidenceReviewExplanations: Record<EvidenceReviewStatus, string> = {
  pending:
    "Submitted for research review; not yet relied on as accepted evidence. A research review status is not proof that a claim is true.",
  accepted:
    "Reviewed as usable for institutional consideration, with stated limitations. This is not proof that a claim is true.",
  limited:
    "Usable only with important caveats; not treated as full support. This is not proof that a claim is true.",
  disputed:
    "Material objections remain about methods, conflicts, or interpretation. This is not proof that a claim is true.",
  rejected: "Not accepted for reliance in this demonstration record.",
};

export const authorTypeLabels: Record<AuthorType, string> = {
  agency: "Agency",
  researcher: "Researcher",
  journalist: "Journalist",
  civil_society: "Civil society",
  industry: "Industry",
  other: "Other",
};

export const sourceTypeLabels: Record<SourceType, string> = {
  report: "Report",
  dataset: "Dataset",
  peer_reviewed: "Peer-reviewed",
  news: "News",
  memo: "Memo",
  other: "Other",
};

export const topicStageLabels: Record<TopicStage, string> = {
  brief: "Brief",
  evidence: "Fact-Check & Research",
  consultation: "Public Input",
  agenda: "Decide What Moves Forward",
  deliberation: "State-Level Policy Drafting",
  decision: "Recommendation & Council Vote",
  closed: "Closed",
};

export const topicStatusLabels: Record<TopicStatus, string> = {
  open: "Open",
  paused: "Paused",
  closed: "Closed",
};

export const topicStatusExplanations: Record<TopicStatus, string> = {
  open: "The synthetic brief accepts work at its current institutional stage.",
  paused: "Progress is paused; the stage has not advanced and contribution is on hold.",
  closed: "Public contribution on this synthetic topic has closed for the demonstration.",
};

export const agendaStateLabels: Record<AgendaState, string> = {
  proposed: "Proposed",
  qualified: "Qualified",
  deferred: "Deferred",
  rejected: "Rejected",
};

export const proposalStateLabels: Record<ProposalState, string> = {
  draft: "Draft",
  under_amendment: "Under amendment",
  recommended: "Recommended",
  adopted: "Adopted",
  returned: "Returned",
  rejected: "Rejected",
};

export const amendmentStatusLabels: Record<AmendmentStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const decisionOutcomeLabels: Record<DecisionOutcome, string> = {
  recommended: "Recommended",
  adopted: "Adopted",
  rejected: "Rejected",
  returned: "Returned",
};

export const voteChoiceLabels: Record<VoteChoice, string> = {
  for: "For",
  against: "Against",
  abstain: "Abstain",
  recused: "Stepped aside (conflict)",
};

export const councilRoleLabels: Record<CouncilRole, string> = {
  deliberation_council: "Policy Drafting Council",
  policy_council: "Policy council",
};
