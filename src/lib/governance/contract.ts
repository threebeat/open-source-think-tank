import contractJson from "../../../docs/v2/governance-state-machine.json";

export const GOVERNANCE_STATES = [
  "informal_draft",
  "formal_review_pending",
  "qualified_consultation",
  "community_accepted",
  "community_disputed",
  "consultation_inconclusive",
  "chamber_queued",
  "chamber_deliberating",
  "chamber_accepted",
  "chamber_disputed",
  "council_scheduled",
  "council_deliberating",
  "recommendations_published",
  "council_declined",
  "honorably_disqualified",
  "dishonorably_disqualified",
] as const;

export type TopicGovernanceState = (typeof GOVERNANCE_STATES)[number];

export const GOVERNANCE_ACTIONS = [
  "submit_for_formal_review",
  "return_for_revision",
  "qualify",
  "remove_for_serious_breach",
  "close_as_accepted",
  "close_as_disputed",
  "close_as_inconclusive",
  "queue_for_chamber",
  "start_chamber_deliberation",
  "record_chamber_acceptance",
  "record_chamber_dispute",
  "accept_to_council_agenda",
  "decline_council_intake",
  "accept_disputed_to_council_agenda",
  "decline_disputed_council_intake",
  "start_council_deliberation",
  "publish_recommendations",
  "expire_disputed",
  "expire_inconclusive",
  "expire_council_declined",
  "disqualify_for_serious_breach",
  "disqualify_chamber_topic_for_serious_breach",
  "disqualify_deliberating_topic_for_serious_breach",
] as const;

export type TopicGovernanceAction = (typeof GOVERNANCE_ACTIONS)[number];

export type GovernanceActor =
  | "community_member"
  | "moderator"
  | "system_from_published_rule"
  | "chamber_clerk"
  | "chamber"
  | "council"
  | "council_clerk";

export type GovernanceTransition = {
  action: TopicGovernanceAction;
  from: TopicGovernanceState;
  to: TopicGovernanceState;
  actor: GovernanceActor;
  reasonRequired?: boolean;
  criteriaTraceRequired?: boolean;
  metricsSnapshotRequired?: boolean;
  verdictRequired?: boolean;
  appealable?: boolean;
  mayReferenceVerdictReason?: boolean;
};

export type GovernanceContract = {
  schemaVersion: string;
  states: Array<{
    id: TopicGovernanceState;
    realm: string;
    public: boolean;
    publicAgenda: boolean;
    consultationReportVisible: boolean;
    terminal?: boolean;
    deadTopic?: boolean;
    newConsultationRequiredForSuccessor?: boolean;
  }>;
  transitions: GovernanceTransition[];
};

export const GOVERNANCE_CONTRACT = contractJson as GovernanceContract;

export const GOVERNANCE_TRANSITIONS: readonly GovernanceTransition[] =
  GOVERNANCE_CONTRACT.transitions;

export const TERMINAL_STATES: ReadonlySet<TopicGovernanceState> = new Set(
  GOVERNANCE_CONTRACT.states
    .filter((state) => state.terminal)
    .map((state) => state.id),
);

export function isGovernanceState(
  value: string,
): value is TopicGovernanceState {
  return (GOVERNANCE_STATES as readonly string[]).includes(value);
}

export function isGovernanceAction(
  value: string,
): value is TopicGovernanceAction {
  return (GOVERNANCE_ACTIONS as readonly string[]).includes(value);
}
