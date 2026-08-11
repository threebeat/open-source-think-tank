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
    title: "How Joining Works",
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
    title: "Fact-Check & Research",
    whoParticipates:
      "Community participants may submit claims and sources once real accounts exist; visitors can read public briefs.",
    whatHappens:
      "A neutral policy question is published with competing claims, supporting evidence, evidence against those claims, and research review statuses.",
    whatIsProduced:
      "Topic brief, claim set, and research review status for each source.",
    whatBecomesPublic:
      "Briefs, claims, source metadata, research review status, limitations, and disclosures. Personal identity of submitters remains protected in production intent.",
  },
  {
    id: "consultation",
    title: "Public Input",
    whoParticipates:
      "Eligible, invited community participants (not open self-registration in this demonstration).",
    whatHappens:
      "This demonstration shows Public Input with synthetic practice votes. A later alpha phase is planned to use Pol.is for live Public Input (copy may then say “Public Input, powered by Pol.is”). Pol.is is not connected now. Areas of agreement and disagreement organize preference without deciding factual truth or the institution’s recommendation.",
    whatIsProduced:
      "Public-input report with neutrally labeled groups, statements people agreed on across groups, and statements with the most disagreement.",
    whatBecomesPublic:
      "Aggregate report and method version. Granular political-opinion histories stay protected.",
  },
  {
    id: "agenda",
    title: "Decide What Moves Forward",
    whoParticipates:
      "Agenda stewards (human review) using public criteria; visitors can inspect how the result was calculated.",
    whatHappens:
      "Public criteria are checked separately. Algorithms recommend or organize; a human records qualification, deferral, or rejection with rationale.",
    whatIsProduced:
      "Agenda item status, how this result was calculated, and human-review record.",
    whatBecomesPublic:
      "Public criteria, inputs, method version, human decision, conflicts, and sensitivity notes.",
  },
  {
    id: "deliberation",
    title: "State-Level Policy Drafting",
    whoParticipates:
      "A capacity-limited, term-limited Policy Drafting Council (deliberation council). The public observes; observation is not participation.",
    whatHappens:
      "Draft proposals, amendments, evidence requests, conflict disclosures, and cases where someone stepped aside because of a conflict are recorded.",
    whatIsProduced: "Proposal versions, amendment record, and meeting timeline.",
    whatBecomesPublic:
      "Observer view of material actions, conflicts, and redaction reasons when used. Unnecessary private details are omitted.",
  },
  {
    id: "decision",
    title: "Recommendation & Council Vote",
    whoParticipates:
      "Policy council recommends a position. This is not enacted law and does not invent governing-board adoption. Governing-board legal authority is pending counsel review.",
    whatHappens:
      "A versioned recommendation record publishes the disposition, vote, rationale, minority report, and review date.",
    whatIsProduced:
      "Recommendation & council vote linked back to evidence, public input, and agenda inputs.",
    whatBecomesPublic:
      "Outcome label, rationale, dissent, roll call of roles that voted, and scheduled review. Board adoption, if any, remains a separate unresolved legal/product question.",
  },
  {
    id: "transparency",
    title: "The Public Record",
    whoParticipates: "Any visitor.",
    whatHappens:
      "Institutional actions, method versions, and the boundary between what we publish and what we protect are displayed.",
    whatIsProduced:
      "Demonstration activity history, who-does-what map, and methods and updates entries.",
    whatBecomesPublic:
      "Institutional audit events and method versions. Identities, verification artifacts, and granular opinion histories remain protected.",
  },
];

export const oneSentenceMethod =
  "Open evidence, structured public input from eligible/invited participants, transparent public criteria, capacity-limited policy drafting, and published recommendations — with preference, cross-group agreement, and research quality kept visibly separate.";
