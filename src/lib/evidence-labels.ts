import type {
  AuthorType,
  EvidenceReviewStatus,
  SourceType,
  TopicStage,
} from "@/domain/status";

export const evidenceReviewLabels: Record<EvidenceReviewStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  limited: "Limited",
  disputed: "Disputed",
  rejected: "Rejected",
};

export const evidenceReviewExplanations: Record<EvidenceReviewStatus, string> = {
  pending: "Submitted for review; not yet relied on as accepted evidence.",
  accepted: "Reviewed and usable for institutional consideration, with stated limitations.",
  limited: "Usable only with important caveats; not treated as full support.",
  disputed: "Material objections remain about methods, conflicts, or interpretation.",
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
  evidence: "Evidence",
  consultation: "Consultation",
  agenda: "Agenda",
  deliberation: "Deliberation",
  decision: "Decision",
  closed: "Closed",
};
