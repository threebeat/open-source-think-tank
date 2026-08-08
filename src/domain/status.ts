/** Enumerated domain statuses — framework-independent. */

export const TOPIC_STAGES = [
  "brief",
  "evidence",
  "consultation",
  "agenda",
  "deliberation",
  "decision",
  "closed",
] as const;
export type TopicStage = (typeof TOPIC_STAGES)[number];

export const EVIDENCE_REVIEW_STATUSES = [
  "pending",
  "accepted",
  "limited",
  "disputed",
  "rejected",
] as const;
export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];

export const AGENDA_STATES = [
  "proposed",
  "qualified",
  "deferred",
  "rejected",
] as const;
export type AgendaState = (typeof AGENDA_STATES)[number];

export const PROPOSAL_STATES = [
  "draft",
  "under_amendment",
  "recommended",
  "adopted",
  "returned",
  "rejected",
] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const DECISION_OUTCOMES = [
  "adopted",
  "rejected",
  "returned",
] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

export const AUTHOR_TYPES = [
  "agency",
  "researcher",
  "journalist",
  "civil_society",
  "industry",
  "other",
] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const SOURCE_TYPES = [
  "report",
  "dataset",
  "peer_reviewed",
  "news",
  "memo",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const AMENDMENT_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type AmendmentStatus = (typeof AMENDMENT_STATUSES)[number];

export const VOTE_CHOICES = ["for", "against", "abstain", "recused"] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];
