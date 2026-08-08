export type ProcessStageContent = {
  id: string;
  title: string;
  whoParticipates: string;
  whatHappens: string;
  whatIsProduced: string;
  whatBecomesPublic: string;
};

export const processStages: ProcessStageContent[] = [
  {
    id: "join",
    title: "Join preview",
    whoParticipates: "Visitors considering community participation.",
    whatHappens:
      "A nonfunctional walkthrough of eligibility, bot resistance, account continuity, conduct assent, privacy consent, and stronger verification for higher-impact roles.",
    whatIsProduced:
      "In a later phase: versioned assent records. In Phase 1: nothing is collected.",
    whatBecomesPublic:
      "Process description only. Identity and verification artifacts stay protected.",
  },
  {
    id: "evidence",
    title: "Topic and evidence",
    whoParticipates:
      "Community participants may submit claims and sources once real accounts exist; visitors can read public briefs.",
    whatHappens:
      "A neutral policy question is published with competing claims, supporting evidence, counterevidence, and review statuses.",
    whatIsProduced: "Topic brief, claim set, and evidence review states.",
    whatBecomesPublic:
      "Briefs, claims, source metadata, review status, limitations, and disclosures. Personal identity of submitters remains protected in production intent.",
  },
  {
    id: "consultation",
    title: "Open consultation",
    whoParticipates: "Community participants eligible for the consultation.",
    whatHappens:
      "Participants respond to short statements. Opinion mapping organizes preference and cross-group agreement without deciding the institution’s position.",
    whatIsProduced:
      "Consultation report with neutrally labeled groups, consensus statements, and high-disagreement statements.",
    whatBecomesPublic:
      "Aggregate report and method version. Granular political-opinion histories stay protected.",
  },
  {
    id: "agenda",
    title: "Agenda qualification",
    whoParticipates:
      "Agenda stewards (human review) using published thresholds; visitors can inspect the trace.",
    whatHappens:
      "Published eligibility thresholds are checked separately. Algorithms recommend or organize; a human records qualification, deferral, or rejection with rationale.",
    whatIsProduced: "Agenda item status, calculation trace, and human-review record.",
    whatBecomesPublic:
      "Thresholds, inputs, method version, human decision, conflicts, and sensitivity notes.",
  },
  {
    id: "deliberation",
    title: "Deliberation council",
    whoParticipates:
      "A capacity-limited, term-limited deliberation council. The public observes; observation is not participation.",
    whatHappens:
      "Draft proposals, amendments, evidence requests, conflict disclosures, and recusals are recorded.",
    whatIsProduced: "Proposal versions, amendment record, and meeting timeline.",
    whatBecomesPublic:
      "Observer view of material actions, conflicts, and redaction reasons when used. Unnecessary private details are omitted.",
  },
  {
    id: "decision",
    title: "Decision record",
    whoParticipates:
      "Policy council recommends a position. Governing-board legal authority is pending counsel review and is not invented by this prototype.",
    whatHappens:
      "A versioned decision record publishes the recommendation or disposition, vote, rationale, minority report, and review date.",
    whatIsProduced: "Decision record linked back to evidence, consultation, and agenda inputs.",
    whatBecomesPublic:
      "Outcome label, rationale, dissent, roll call of roles that voted, and scheduled review. Board adoption, if any, remains a separate unresolved legal/product question.",
  },
  {
    id: "transparency",
    title: "Transparency center",
    whoParticipates: "Any visitor.",
    whatHappens:
      "Institutional actions, method versions, and the open-by-default versus protected-by-necessity boundary are displayed.",
    whatIsProduced: "Audit feed, governance map, and method registry entries.",
    whatBecomesPublic:
      "Institutional audit events and method versions. Identities, verification artifacts, and granular opinion histories remain protected.",
  },
];

export const oneSentenceMethod =
  "Open evidence, structured consultation, transparent agenda rules, capacity-limited deliberation, and published decision records — with preference, cross-group agreement, and evidence quality kept visibly separate.";
