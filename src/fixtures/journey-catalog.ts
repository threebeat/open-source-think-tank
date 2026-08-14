/**
 * Phase 4.1 synthetic journey fixtures — Idea Commons, formal-gate metadata,
 * qualification traces, member actions, and three trajectories.
 * All entities are fictional. Not live Pol.is. Not gated operational data.
 */

export const SMALL_CELL_SUPPRESSION_THRESHOLD = 5;

export const SMALL_CELL_SUPPRESSION_NOTICE =
  "Synthetic demo uses a provisional small-cell suppression threshold of 5. The production threshold requires privacy review and is not settled here.";

export type IdeaCommonsKind = "discussion" | "question" | "idea" | "proposal";

export type LineageEventType =
  | "created"
  | "replied"
  | "converted_to_proposal"
  | "nominated_for_scoping"
  | "merged"
  | "split"
  | "deferred"
  | "entered_formal_pipeline"
  | "public_input_opened"
  | "agenda_qualified"
  | "agenda_deferred"
  | "deliberation_started"
  | "recommendation_published"
  | "actions_published"
  | "follow_up_opened";

export type QualificationSignalId =
  | "participation_sufficiency"
  | "breadth_cross_group"
  | "agreement_findings"
  | "disagreement_findings"
  | "evidence_readiness"
  | "scope_jurisdiction"
  | "duplication_lineage"
  | "capacity"
  | "moderator_process_safety";

export type IdeaCommonsPost = {
  id: string;
  synthetic: true;
  kind: IdeaCommonsKind;
  title: string;
  body: string;
  authorLabel: string;
  /** Ordinary participant attribution only — never an elevated ranking badge. */
  authorRoleNote: string;
  createdAt: string;
  citedSourceTitle?: string;
  citedSourceUrl?: string;
  parentId: string | null;
  trajectoryId: string;
  informalNotice: string;
};

export type LineageEvent = {
  id: string;
  at: string;
  type: LineageEventType;
  summary: string;
  actorRole: string;
  publicReason?: string;
};

export type FormalTopicGateView = {
  topicSlug: string;
  topicId: string;
  synthetic: true;
  area: "formal_topic_pipeline";
  currentStage: string;
  originSummary: string;
  criteriaMet: string[];
  criteriaUnmet: string[];
  whoCanActNow: string;
  nextTransition: string;
  publicInformation: string[];
  protectedInformation: string[];
  lineage: LineageEvent[];
  trajectoryId: string;
};

export type QualificationSignal = {
  id: QualificationSignalId;
  label: string;
  status: "met" | "unmet" | "attention";
  summary: string;
  /** Explicit axis separation — never a composite score. */
  axis:
    | "consultation"
    | "evidence"
    | "scope"
    | "lineage"
    | "capacity"
    | "process";
};

export type QualificationTrace = {
  id: string;
  synthetic: true;
  topicSlug: string;
  methodVersion: string;
  importedAt: string;
  signals: QualificationSignal[];
  humanReview: {
    actorRole: string;
    decision: "qualified" | "deferred" | "proposed";
    decidedAt: string;
    conflicts: string;
    publicReason: string;
    methodVersion: string;
  };
  notices: string[];
};

export type PublicInputAggregateReport = {
  id: string;
  synthetic: true;
  topicSlug: string;
  participationCount: number;
  commentTotal: number;
  voteTotal: number;
  opinionGroups: { label: string; participantCount: number }[];
  crossGroupAgreement: string[];
  meaningfulDisagreement: string[];
  participationSufficiency: string;
  representationLimitations: string;
  methodVersion: string;
  importTimestamp: string;
  smallCellSuppressionThreshold: number;
  smallCellSuppressionNotice: string;
};

export type MemberActionOpportunity = {
  id: string;
  synthetic: true;
  topicSlug: string;
  title: string;
  kind:
    | "town_hall"
    | "interest_group"
    | "public_comment"
    | "agency_review"
    | "evidence_session";
  organizer: string;
  dateLabel: string;
  locationLabel: string;
  sourceLinkLabel: string;
  sourceLinkHref: string;
  eligibility: string;
  whyShown: string;
  relationshipToRecommendation: string;
  sponsorshipConflict: string;
  status: "open" | "expired" | "upcoming";
  expiresOn: string;
  nonEndorsement: string;
};

export type JourneyTrajectory = {
  id: string;
  synthetic: true;
  title: string;
  outcome: "advances" | "merge_split" | "deferred";
  summary: string;
  ideaCommonsRootId: string;
  formalTopicSlug: string | null;
};

export const journeyInformalNotice =
  "Idea Commons content is informal and not yet in the Formal Topic Pipeline.";

export const journeyTrajectories: JourneyTrajectory[] = [
  {
    id: "traj-advance-cedar",
    synthetic: true,
    title: "Advances through every stage",
    outcome: "advances",
    summary:
      "A drought-surcharge discussion becomes a proposal, passes scoping, completes Public Input, qualifies for the agenda, deliberates, and yields a recommendation with member actions.",
    ideaCommonsRootId: "idea-cedar-surcharge-discussion",
    formalTopicSlug: "cedar-river-drought-surcharge",
  },
  {
    id: "traj-merge-hardship",
    synthetic: true,
    title: "Merges into a related formal topic",
    outcome: "merge_split",
    summary:
      "A hardship-rebate Idea Commons proposal is merged into the Cedar River formal topic as a scoped follow-up, preserving visible lineage rather than erasing history.",
    ideaCommonsRootId: "idea-hardship-rebate-proposal",
    formalTopicSlug: "cedar-river-drought-surcharge",
  },
  {
    id: "traj-defer-billing",
    synthetic: true,
    title: "Deferred for unmet published criterion",
    outcome: "deferred",
    summary:
      "A billing-operations readiness proposal is deferred because the evidence-readiness criterion remains unmet. Preference alone cannot force qualification.",
    ideaCommonsRootId: "idea-billing-ops-proposal",
    formalTopicSlug: "cedar-river-billing-ops-gap",
  },
];

export const ideaCommonsPosts: IdeaCommonsPost[] = [
  {
    id: "idea-cedar-surcharge-discussion",
    synthetic: true,
    kind: "discussion",
    title: "Should drought pricing rise with reservoir stage?",
    body: "Neighbors are asking whether a graduated residential surcharge during shortage stages would be clearer than a flat emergency fee. This is early community discussion only.",
    authorLabel: "Alex Rivera (synthetic)",
    authorRoleNote: "Ordinary community participant attribution",
    createdAt: "2026-01-05",
    parentId: null,
    trajectoryId: "traj-advance-cedar",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-cedar-surcharge-reply",
    synthetic: true,
    kind: "discussion",
    title: "Reply: publish the stage thresholds",
    body: "Any price tool should publish storage thresholds in advance so households can plan. Still informal — not a formal topic.",
    authorLabel: "Jordan Lee (synthetic)",
    authorRoleNote: "Ordinary community participant attribution",
    createdAt: "2026-01-07",
    citedSourceTitle: "Synthetic basin storage note (fixture)",
    citedSourceUrl: "https://example.invalid/synthetic/basin-storage-note",
    parentId: "idea-cedar-surcharge-discussion",
    trajectoryId: "traj-advance-cedar",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-cedar-surcharge-proposal",
    synthetic: true,
    kind: "proposal",
    title: "Proposal: graduated drought-surcharge schedule",
    body: "Convert the discussion into an unqualified proposal to examine a graduated residential drought-surcharge schedule when reservoir storage falls below published thresholds.",
    authorLabel: "Alex Rivera (synthetic)",
    authorRoleNote: "Ordinary community participant attribution",
    createdAt: "2026-01-10",
    parentId: "idea-cedar-surcharge-discussion",
    trajectoryId: "traj-advance-cedar",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-hardship-rebate-proposal",
    synthetic: true,
    kind: "proposal",
    title: "Proposal: separate hardship-rebate lane",
    body: "Some participants want a distinct hardship-rebate design. This remains Idea Commons until scoping and gates say otherwise.",
    authorLabel: "Sam Okonkwo (synthetic)",
    authorRoleNote: "Ordinary community participant attribution",
    createdAt: "2026-02-02",
    parentId: null,
    trajectoryId: "traj-merge-hardship",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-hardship-merge-note",
    synthetic: true,
    kind: "idea",
    title: "Lineage note: merged into Cedar River formal topic",
    body: "This proposal was merged into the Cedar River formal topic as a scoped follow-up item. History stays visible; merge is not silent deletion.",
    authorLabel: "Process steward (synthetic)",
    authorRoleNote: "Process note — not a preference-based promotion privilege",
    createdAt: "2026-03-16",
    parentId: "idea-hardship-rebate-proposal",
    trajectoryId: "traj-merge-hardship",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-billing-ops-proposal",
    synthetic: true,
    kind: "proposal",
    title: "Proposal: qualify billing-ops readiness now",
    body: "A participant asks to move billing-system change-cost readiness onto the formal agenda immediately.",
    authorLabel: "Casey Nguyen (synthetic)",
    authorRoleNote: "Ordinary community participant attribution",
    createdAt: "2026-02-20",
    parentId: null,
    trajectoryId: "traj-defer-billing",
    informalNotice: journeyInformalNotice,
  },
  {
    id: "idea-moderator-ordinary-proposal",
    synthetic: true,
    kind: "proposal",
    title: "Moderator-authored ordinary proposal (no privilege)",
    body: "A person who also holds a moderator role submitted this Idea Commons proposal through the ordinary participant interface. It receives no elevated badge, ranking advantage, or private promotion path.",
    authorLabel: "Riley Brooks (synthetic)",
    authorRoleNote:
      "Author also holds a moderator role elsewhere — contribution uses ordinary participant rules only",
    createdAt: "2026-02-22",
    parentId: "idea-billing-ops-proposal",
    trajectoryId: "traj-defer-billing",
    informalNotice: journeyInformalNotice,
  },
];

export const formalTopicGateViews: FormalTopicGateView[] = [
  {
    topicSlug: "cedar-river-drought-surcharge",
    topicId: "topic-cedar-river-drought-surcharge",
    synthetic: true,
    area: "formal_topic_pipeline",
    currentStage: "decision",
    originSummary:
      "Entered from Idea Commons proposal “graduated drought-surcharge schedule” after published scoping criteria were met.",
    criteriaMet: [
      "Published scoping note complete",
      "Evidence pack attached with mixed review states",
      "Public Input window closed with versioned aggregate report",
      "Agenda qualification signals met for the primary question",
    ],
    criteriaUnmet: [
      "Governing-board adoption (unresolved / counsel-gated)",
    ],
    whoCanActNow:
      "Visitors may inspect the public recommendation, member actions, and audit lineage. No elevated role may privately re-open pre-deliberation promotion.",
    nextTransition:
      "Scheduled review of the Policy Council recommendation; follow-up topics may open from lineage.",
    publicInformation: [
      "Stage, lineage, criteria, agenda trace, recommendation, minority report",
      "Allowlisted Public Input aggregates",
      "Member action opportunities with sponsorship/conflict labels",
    ],
    protectedInformation: [
      "Per-person consultation votes and group membership",
      "Provider participant IDs and account identifiers",
      "Contact, identity, and verification artifacts",
    ],
    lineage: [
      {
        id: "lin-cedar-1",
        at: "2026-01-10",
        type: "converted_to_proposal",
        summary: "Discussion converted to unqualified proposal in Idea Commons.",
        actorRole: "community participant (synthetic)",
      },
      {
        id: "lin-cedar-2",
        at: "2026-01-12",
        type: "entered_formal_pipeline",
        summary: "Published scoping criteria met; formal topic brief opened.",
        actorRole: "process steward (synthetic)",
        publicReason: "Scoping checklist complete; not a preference shortcut.",
      },
      {
        id: "lin-cedar-3",
        at: "2026-03-01",
        type: "public_input_opened",
        summary: "Synthetic Public Input window closed; aggregate report sealed.",
        actorRole: "system fixture",
      },
      {
        id: "lin-cedar-4",
        at: "2026-03-18",
        type: "agenda_qualified",
        summary: "Primary question qualified with independent-signal trace.",
        actorRole: "Agenda steward (synthetic)",
        publicReason:
          "Signals met; pending billing ops handled via deliberation evidence request — popularity not treated as evidence quality.",
      },
      {
        id: "lin-cedar-5",
        at: "2026-04-01",
        type: "deliberation_started",
        summary: "Capacity-limited deliberation opened for observers.",
        actorRole: "deliberation council (synthetic)",
      },
      {
        id: "lin-cedar-6",
        at: "2026-04-22",
        type: "recommendation_published",
        summary: "Policy Council recommendation published with review date.",
        actorRole: "policy council (synthetic)",
      },
      {
        id: "lin-cedar-7",
        at: "2026-04-23",
        type: "actions_published",
        summary: "Member action opportunities published for the recommendation.",
        actorRole: "process steward (synthetic)",
      },
    ],
    trajectoryId: "traj-advance-cedar",
  },
  {
    topicSlug: "cedar-river-billing-ops-gap",
    topicId: "topic-cedar-river-drought-surcharge",
    synthetic: true,
    area: "formal_topic_pipeline",
    currentStage: "agenda",
    originSummary:
      "Scoped readiness item linked from Idea Commons billing-ops proposal; deferred because evidence readiness remains unmet.",
    criteriaMet: [
      "Participation sufficiency on parent consultation",
      "Cross-group procedural consensus on parent consultation",
    ],
    criteriaUnmet: [
      "Accepted billing-system change-cost estimate (evidence readiness)",
    ],
    whoCanActNow:
      "Evidence contributors may attach an operations estimate for review. No moderator or administrator may privately promote this item past the unmet gate.",
    nextTransition:
      "Remain deferred until the evidence-readiness criterion is met or a public override with recorded reason is published.",
    publicInformation: [
      "Deferred state, unmet criterion, human review reason, lineage to parent topic",
    ],
    protectedInformation: [
      "Raw consultation ballots",
      "Staff private moderation notes",
    ],
    lineage: [
      {
        id: "lin-bill-1",
        at: "2026-02-20",
        type: "converted_to_proposal",
        summary: "Idea Commons proposal asking to qualify billing-ops readiness.",
        actorRole: "community participant (synthetic)",
      },
      {
        id: "lin-bill-2",
        at: "2026-03-18",
        type: "agenda_deferred",
        summary: "Deferred — published evidence-readiness criterion unmet.",
        actorRole: "Agenda steward (synthetic)",
        publicReason:
          "Did not override the failed evidence-readiness gate. Preference support is not a substitute for the missing estimate.",
      },
    ],
    trajectoryId: "traj-defer-billing",
  },
];

export const qualificationTraces: QualificationTrace[] = [
  {
    id: "qual-cedar-primary",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    methodVersion: "agenda-qualification-trace@4.1.0",
    importedAt: "2026-03-18T15:00:00.000Z",
    signals: [
      {
        id: "participation_sufficiency",
        label: "Participation sufficiency",
        status: "met",
        summary: "72% average statement response coverage (synthetic).",
        axis: "consultation",
      },
      {
        id: "breadth_cross_group",
        label: "Breadth / cross-group engagement",
        status: "met",
        summary: "Groups A–C each contributed above the illustrative floor.",
        axis: "consultation",
      },
      {
        id: "agreement_findings",
        label: "Agreement findings",
        status: "met",
        summary: "Two procedural statements show cross-group agreement.",
        axis: "consultation",
      },
      {
        id: "disagreement_findings",
        label: "Disagreement findings",
        status: "met",
        summary: "Two high-disagreement statements retained for deliberation.",
        axis: "consultation",
      },
      {
        id: "evidence_readiness",
        label: "Evidence readiness",
        status: "attention",
        summary:
          "Core sources accepted/limited; billing ops estimate pending — handled via deliberation request, not by treating Pol.is results as evidence quality.",
        axis: "evidence",
      },
      {
        id: "scope_jurisdiction",
        label: "Scope and jurisdiction",
        status: "met",
        summary: "Residential meters in fictional district during shortage stages.",
        axis: "scope",
      },
      {
        id: "duplication_lineage",
        label: "Duplication / lineage",
        status: "met",
        summary: "Hardship rebate merged as follow-up; device subsidy rejected as framing duplicate.",
        axis: "lineage",
      },
      {
        id: "capacity",
        label: "Capacity",
        status: "met",
        summary: "Deliberation seat capacity available in the synthetic roster.",
        axis: "capacity",
      },
      {
        id: "moderator_process_safety",
        label: "Moderator process / safety review",
        status: "met",
        summary:
          "Process/safety checks recorded with reasons. Moderators did not assign agenda priority or alter consultation metrics.",
        axis: "process",
      },
    ],
    humanReview: {
      actorRole: "Agenda steward (synthetic)",
      decision: "qualified",
      decidedAt: "2026-03-18",
      conflicts: "None disclosed in the synthetic record.",
      publicReason:
        "Qualified the primary question. Pending billing ops becomes a deliberation evidence request. Popularity is not evidence quality.",
      methodVersion: "agenda-qualification-trace@4.1.0",
    },
    notices: [
      "No single composite truth, importance, or popularity score is computed.",
      "Phase 4 establishes the journey and qualification contract; later agenda-laboratory work may tune methods but cannot erase these governance constraints.",
      "Pol.is / Public Input results never determine evidence quality.",
    ],
  },
  {
    id: "qual-cedar-billing-deferred",
    synthetic: true,
    topicSlug: "cedar-river-billing-ops-gap",
    methodVersion: "agenda-qualification-trace@4.1.0",
    importedAt: "2026-03-18T15:05:00.000Z",
    signals: [
      {
        id: "participation_sufficiency",
        label: "Participation sufficiency",
        status: "met",
        summary: "Parent consultation coverage met.",
        axis: "consultation",
      },
      {
        id: "breadth_cross_group",
        label: "Breadth / cross-group engagement",
        status: "met",
        summary: "Parent consultation breadth met.",
        axis: "consultation",
      },
      {
        id: "agreement_findings",
        label: "Agreement findings",
        status: "met",
        summary: "Procedural agreement exists on the parent question.",
        axis: "consultation",
      },
      {
        id: "disagreement_findings",
        label: "Disagreement findings",
        status: "met",
        summary: "Policy disagreement remains visible on the parent question.",
        axis: "consultation",
      },
      {
        id: "evidence_readiness",
        label: "Evidence readiness",
        status: "unmet",
        summary: "Billing-system change-cost estimate still pending.",
        axis: "evidence",
      },
      {
        id: "scope_jurisdiction",
        label: "Scope and jurisdiction",
        status: "met",
        summary: "Scoped to operations readiness for the parent topic.",
        axis: "scope",
      },
      {
        id: "duplication_lineage",
        label: "Duplication / lineage",
        status: "met",
        summary: "Linked to parent Cedar River lineage; not a silent duplicate.",
        axis: "lineage",
      },
      {
        id: "capacity",
        label: "Capacity",
        status: "attention",
        summary: "Capacity reserved for qualified primary item first.",
        axis: "capacity",
      },
      {
        id: "moderator_process_safety",
        label: "Moderator process / safety review",
        status: "met",
        summary: "No safety block; process review does not create agenda priority.",
        axis: "process",
      },
    ],
    humanReview: {
      actorRole: "Agenda steward (synthetic)",
      decision: "deferred",
      decidedAt: "2026-03-18",
      conflicts: "None disclosed in the synthetic record.",
      publicReason:
        "Deferred because the published evidence-readiness criterion is unmet. No preference-based override.",
      methodVersion: "agenda-qualification-trace@4.1.0",
    },
    notices: [
      "Consultation metrics were not edited by moderators.",
      "Human deferral records reason, role, timestamp, conflicts, and method version.",
    ],
  },
];

export const publicInputAggregateReports: PublicInputAggregateReport[] = [
  {
    id: "pi-report-cedar",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    participationCount: 1240,
    commentTotal: 86,
    voteTotal: 18420,
    opinionGroups: [
      // Exact counts must sum to participationCount (1240). Group D (4) is
      // below provisional threshold 5 and triggers complementary suppression.
      { label: "Group A", participantCount: 421 },
      { label: "Group B", participantCount: 459 },
      { label: "Group C", participantCount: 356 },
      { label: "Group D", participantCount: 4 },
    ],
    crossGroupAgreement: [
      "Publish shortage-stage thresholds before any surcharge applies.",
      "Keep commercial tariffs out of this residential-only scope.",
    ],
    meaningfulDisagreement: [
      "Graduated surcharge versus flat emergency fee.",
      "Whether price tools should be used at all during shortage.",
    ],
    participationSufficiency:
      "Synthetic participation meets the illustrative coverage floor for demo qualification.",
    representationLimitations:
      "Synthetic cohort is not a representative sample of Tennessee or the United States.",
    methodVersion: "public-input-aggregate@4.1.0-synthetic",
    importTimestamp: "2026-03-01T18:00:00.000Z",
    smallCellSuppressionThreshold: SMALL_CELL_SUPPRESSION_THRESHOLD,
    smallCellSuppressionNotice: SMALL_CELL_SUPPRESSION_NOTICE,
  },
];

export const memberActionOpportunities: MemberActionOpportunity[] = [
  {
    id: "action-cedar-town-hall",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    title: "Attend a public town hall on drought-rate communication",
    kind: "town_hall",
    organizer: "Cedar River Civic Forum (synthetic)",
    dateLabel: "2026-05-12 · 18:30",
    locationLabel: "Cedar River Library meeting room (synthetic)",
    sourceLinkLabel: "Synthetic town-hall notice",
    sourceLinkHref: "https://example.invalid/synthetic/cedar-town-hall",
    eligibility: "Open to the public in the synthetic district geography fixture.",
    whyShown:
      "Shown because your demo profile fixture lists Cedar River geography and water-rates interest — not because of any individual Public Input vote.",
    relationshipToRecommendation:
      "Supports public understanding of the Policy Council recommendation’s communication commitments.",
    sponsorshipConflict:
      "Organizer discloses synthetic sponsorship from a regional nonprofit; no utility sponsorship in the fixture.",
    status: "upcoming",
    expiresOn: "2026-05-13",
    nonEndorsement:
      "Listing is not an institutional endorsement of the organizer’s broader agenda.",
  },
  {
    id: "action-cedar-public-comment",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    title: "Submit a public comment on the published recommendation",
    kind: "public_comment",
    organizer: "Synthetic records desk",
    dateLabel: "Open through 2026-05-30",
    locationLabel: "Online comment box (synthetic)",
    sourceLinkLabel: "Synthetic comment instructions",
    sourceLinkHref: "https://example.invalid/synthetic/cedar-public-comment",
    eligibility: "Any visitor may practice locally; no real submission is transmitted.",
    whyShown:
      "Shown for the Cedar River recommendation fixture and explicit water-policy interest tag.",
    relationshipToRecommendation:
      "Collects follow-up public comment before the scheduled review date.",
    sponsorshipConflict: "None disclosed in the synthetic record.",
    status: "open",
    expiresOn: "2026-05-30",
    nonEndorsement:
      "The think tank demonstration does not treat comments as votes or as board adoption.",
  },
  {
    id: "action-cedar-evidence-session",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    title: "Join a follow-up evidence session on billing operations",
    kind: "evidence_session",
    organizer: "Evidence volunteer circle (synthetic)",
    dateLabel: "2026-05-20 · 12:00",
    locationLabel: "Virtual session (synthetic)",
    sourceLinkLabel: "Synthetic session page",
    sourceLinkHref: "https://example.invalid/synthetic/cedar-evidence-session",
    eligibility: "Open to participants interested in operations evidence; not a council seat.",
    whyShown:
      "Linked to the unmet billing-ops evidence follow-up in the qualification lineage.",
    relationshipToRecommendation:
      "Helps prepare evidence for the scheduled recommendation review — separate from Public Input preference totals.",
    sponsorshipConflict:
      "Session hosts disclose no vendor funding in the synthetic fixture.",
    status: "upcoming",
    expiresOn: "2026-05-21",
    nonEndorsement:
      "Attendance is optional and is not an endorsement of any vendor product.",
  },
  {
    id: "action-cedar-agency-review",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    title: "Review a local agency proposal on shortage communication",
    kind: "agency_review",
    organizer: "Fictional basin communications office",
    dateLabel: "Materials posted 2026-05-01",
    locationLabel: "Public docket (synthetic)",
    sourceLinkLabel: "Synthetic docket entry",
    sourceLinkHref: "https://example.invalid/synthetic/cedar-agency-docket",
    eligibility: "Public read-only review in the demo geography fixture.",
    whyShown: "Matched to fixture interest tag “local-services” for Cedar River.",
    relationshipToRecommendation:
      "Adjacent agency materials that participants may compare with the institutional recommendation.",
    sponsorshipConflict: "Agency fixture lists no private sponsor.",
    status: "open",
    expiresOn: "2026-06-15",
    nonEndorsement:
      "Listing does not mean the demonstration adopts the agency draft.",
  },
  {
    id: "action-cedar-interest-group",
    synthetic: true,
    topicSlug: "cedar-river-drought-surcharge",
    title: "Attend an interest-group meeting on household water budgeting",
    kind: "interest_group",
    organizer: "Household Budget League (synthetic)",
    dateLabel: "2026-05-08 · 19:00",
    locationLabel: "Community center room B (synthetic)",
    sourceLinkLabel: "Synthetic meeting notice",
    sourceLinkHref: "https://example.invalid/synthetic/cedar-interest-group",
    eligibility: "Open meeting; not a deliberation-council selection path.",
    whyShown:
      "Shown from explicit fixture interest “household budgeting,” not from inferred ideology or hidden behavioral profiles.",
    relationshipToRecommendation:
      "Optional civic learning related to surcharge communication — separate from institutional decision authority.",
    sponsorshipConflict:
      "Group discloses synthetic dues funding only; no utility PAC funding in the fixture.",
    status: "upcoming",
    expiresOn: "2026-05-09",
    nonEndorsement:
      "The demonstration does not endorse the group’s positions by listing this meeting.",
  },
];

export const journeyCatalog = {
  synthetic: true as const,
  smallCellSuppressionThreshold: SMALL_CELL_SUPPRESSION_THRESHOLD,
  trajectories: journeyTrajectories,
  ideaCommonsPosts,
  formalTopicGateViews,
  qualificationTraces,
  publicInputAggregateReports,
  memberActionOpportunities,
};
