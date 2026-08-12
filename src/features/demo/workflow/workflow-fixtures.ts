import type { ComparableEvidenceItem } from "@/components/topics/EvidenceComparison";

import type { ModerationPreviewState } from "@/features/demo/workflow/workflow-query";

/**
 * Pure synthetic DTOs for the public-demo operational workflow feature tour.
 * No gated repositories, auth, DB, audit, or persistence imports.
 */

export type WorkflowRevisionEntryFixture = {
  revisionNumber: number;
  createdAt: string;
  changedFieldLabels: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

export type WorkflowRevisionHistoryFixture = {
  subjectKind: "claim" | "evidence";
  subjectId: string;
  entries: WorkflowRevisionEntryFixture[];
  latestRevisionAt: string | null;
};

export type WorkflowPublicRevisionSummaryFixture = {
  revisionCount: number;
  latestRevisionAt: string | null;
  changedFieldLabels: string[];
};

export type WorkflowModerationNoticeFixture = {
  action: "hold" | "hide" | "restore";
  publicRationale: string;
  recordedAt: string;
  subjectKind: "claim" | "evidence";
};

export type WorkflowParticipantFixture = {
  roleLabel: string;
  claimTitle: string;
  claimSummary: string;
  evidenceTitle: string;
  evidenceOrganization: string;
  relationship: "supporting" | "counterevidence";
  limitations: string;
  publicConflictSummary: string;
  /** Synthetic staff-only example — never shown in visitor projection. */
  privateConflictDetail: string;
  privateDetailBoundaryNote: string;
};

export type WorkflowReviewFixture = {
  roleLabel: string;
  claimWorkflowStatus: string;
  claimPublicRationale: string;
  claimPrivateRationaleLabel: string;
  claimPrivateRationaleNote: string;
  evidenceQualityStatus: string;
  evidenceQualityPlainLanguage: string;
  evidenceQualityPublicRationale: string;
  evidenceWorkflowPublicRationale: string;
  independenceNote: string;
};

export type WorkflowRevisionFixture = {
  roleLabel: string;
  chronologyTitle: string;
  history: WorkflowRevisionHistoryFixture;
  publicSummary: WorkflowPublicRevisionSummaryFixture;
  publicSummaryDistinction: string;
};

export type WorkflowComparisonFixture = {
  roleLabel: string;
  claimTitle: string;
  supportingHeading: string;
  counterHeading: string;
  items: ComparableEvidenceItem[];
};

export type WorkflowModerationStateFixture = {
  roleLabel: string;
  stateLabel: string;
  visibility: "visible" | "held" | "hidden";
  bodyIncluded: boolean;
  claimTitle: string;
  claimSummary: string | null;
  timelineNote: string;
  publicRationaleRequired: string;
  privateNoteRedactionNote: string;
  preservedRevisionHistoryNote: string;
  notice: WorkflowModerationNoticeFixture | null;
  previewNextState: ModerationPreviewState | null;
  previewNextStateLabel: string | null;
};

export type WorkflowVisitorStateFixture = {
  roleLabel: string;
  stateLabel: string;
  topicTitle: string;
  claimTitle: string | null;
  claimSummary: string | null;
  bodyExcludedNote: string | null;
  publicConflictSummary: string | null;
  /** Public summary for an included evidence disclosure (never private detail). */
  evidenceConflictPublicSummary: string | null;
  revisionSummary: WorkflowPublicRevisionSummaryFixture | null;
  comparisonItems: ComparableEvidenceItem[];
  moderationNotice: WorkflowModerationNoticeFixture | null;
  projectionNote: string;
  /** True when the published topic has no currently included claim/evidence. */
  emptyPublishedShell?: boolean;
};

const COMPARISON_ITEMS: ComparableEvidenceItem[] = [
  {
    key: "synth-support-memo",
    relationship: "supporting",
    title: "Basin metering pilot memo (synthetic)",
    organization: "Cedar River Utilities Desk",
    authorType: "agency",
    sourceType: "memo",
    limitations:
      "Synthetic pilot covers one basin only; seasonal peaks are not measured.",
    qualityStatus: "limited",
    qualityPlainLanguage:
      "Limited quality means constraints apply; it does not prove the claim.",
    qualityPublicRationale:
      "Sample window is short; treat as directional, not conclusive.",
    workflowPublicRationale:
      "Accepted for publication with limitations clearly labeled.",
    sourceUrl: "https://example.ostt.synth.test/basin-metering-memo",
    revisionSummaryLabel: "1 content revision · Summary",
  },
  {
    key: "synth-counter-report",
    relationship: "counterevidence",
    title: "Household burden counter-brief (synthetic)",
    organization: "Independent Rate Review Desk",
    authorType: "researcher",
    sourceType: "report",
    limitations:
      "Synthetic counter-brief models average bills; hardship cases vary widely.",
    qualityStatus: "accepted",
    qualityPlainLanguage:
      "Accepted quality does not certify truth or institutional adoption.",
    qualityPublicRationale:
      "Methods are transparent; geographic coverage remains incomplete.",
    workflowPublicRationale: "Accepted as linked counterevidence for readers.",
    sourceUrl: "https://example.ostt.synth.test/household-burden-brief",
    revisionSummaryLabel: null,
  },
];

export const workflowParticipantFixture: WorkflowParticipantFixture = {
  roleLabel: "Synthetic role preview — participant submission",
  claimTitle: "Metered drought surcharge reduces peak residential use",
  claimSummary:
    "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
  evidenceTitle: "Basin metering pilot memo (synthetic)",
  evidenceOrganization: "Cedar River Utilities Desk",
  relationship: "supporting",
  limitations:
    "Synthetic pilot covers one basin only; seasonal peaks are not measured.",
  publicConflictSummary:
    "Submitter notes a prior consulting engagement with a regional metering vendor (ended more than two years ago).",
  privateConflictDetail:
    "Synthetic private detail for staff review only: former client code CR-UTIL-19; invoice references remain off the public record.",
  privateDetailBoundaryNote:
    "Private detail appears only in this participant/staff snapshot as an example of what staff would see. It is omitted entirely from visitor projections — never CSS-hidden.",
};

export const workflowReviewFixture: WorkflowReviewFixture = {
  roleLabel: "Synthetic role preview — independent review",
  claimWorkflowStatus: "accepted",
  claimPublicRationale:
    "Claim is specific enough to review against linked sources; wording stays descriptive rather than advocacy.",
  claimPrivateRationaleLabel: "Private staff rationale (not public)",
  claimPrivateRationaleNote:
    "Synthetic private note: ask submitter to keep approach label neutral on future edits. Private notes never enter the visitor projection.",
  evidenceQualityStatus: "limited",
  evidenceQualityPlainLanguage:
    "Limited quality means constraints apply; it does not prove the claim is true.",
  evidenceQualityPublicRationale:
    "Sample window is short; treat as directional, not conclusive.",
  evidenceWorkflowPublicRationale:
    "Accepted for publication with limitations clearly labeled.",
  independenceNote:
    "Claim workflow status, evidence-quality status, and later consultation agreement stay independent. No popularity score moves these labels.",
};

export const workflowRevisionFixture: WorkflowRevisionFixture = {
  roleLabel: "Synthetic role preview — revision chronology",
  chronologyTitle: "Synthetic claim revision history",
  history: {
    subjectKind: "claim",
    subjectId: "synth-claim-cedar-surcharge",
    latestRevisionAt: "2026-03-12T15:10:00.000Z",
    entries: [
      {
        revisionNumber: 1,
        createdAt: "2026-03-12T15:10:00.000Z",
        changedFieldLabels: ["Summary", "Approach label"],
        before: {
          title: "Metered drought surcharge reduces peak residential use",
          summary:
            "A drought surcharge will cut household water use across the basin.",
          approachLabel: "pro-surcharge framing",
        },
        after: {
          title: "Metered drought surcharge reduces peak residential use",
          summary:
            "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
          approachLabel: "usage-reduction hypothesis",
        },
      },
    ],
  },
  publicSummary: {
    revisionCount: 1,
    latestRevisionAt: "2026-03-12T15:10:00.000Z",
    changedFieldLabels: ["Summary", "Approach label"],
  },
  publicSummaryDistinction:
    "Visitors see a revision summary (counts and field labels only). Full before/current bodies stay in this staff-style chronology preview and are not the public projection.",
};

export const workflowComparisonFixture: WorkflowComparisonFixture = {
  roleLabel: "Synthetic role preview — supporting vs counterevidence",
  claimTitle: "Metered drought surcharge reduces peak residential use",
  supportingHeading: "Supporting evidence (fixture)",
  counterHeading: "Counterevidence (fixture)",
  items: COMPARISON_ITEMS,
};

const MODERATION_TIMELINE =
  "Synthetic timeline: visible → held → hidden → restored-to-visible. Restore returns visibility to visible; “restored” is not stored as a durable state.";

export const workflowModerationFixtures: Record<
  ModerationPreviewState,
  WorkflowModerationStateFixture
> = {
  visible: {
    roleLabel: "Synthetic role preview — moderation",
    stateLabel: "Visible (starting state)",
    visibility: "visible",
    bodyIncluded: true,
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary:
      "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
    timelineNote: MODERATION_TIMELINE,
    publicRationaleRequired:
      "A public rationale is required before hold or hide. Restoration also records a public rationale.",
    privateNoteRedactionNote:
      "Private moderator notes stay staff-only and are redacted from every public projection.",
    preservedRevisionHistoryNote:
      "Visibility actions do not delete content or erase revision history.",
    notice: null,
    previewNextState: "held",
    previewNextStateLabel: "Preview next state: held",
  },
  held: {
    roleLabel: "Synthetic role preview — moderation",
    stateLabel: "Example held state",
    visibility: "held",
    bodyIncluded: false,
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary: null,
    timelineNote: MODERATION_TIMELINE,
    publicRationaleRequired:
      "Public rationale (required): Temporary hold while source citations are checked against the linked memo.",
    privateNoteRedactionNote:
      "Private moderator notes stay staff-only and are redacted from every public projection.",
    preservedRevisionHistoryNote:
      "Hold withholds the body from publication; the row and revision history remain.",
    notice: {
      action: "hold",
      publicRationale:
        "Temporary hold while source citations are checked against the linked memo.",
      recordedAt: "2026-03-14T11:00:00.000Z",
      subjectKind: "claim",
    },
    previewNextState: "hidden",
    previewNextStateLabel: "Preview next state: hidden",
  },
  hidden: {
    roleLabel: "Synthetic role preview — moderation",
    stateLabel: "Example hidden state",
    visibility: "hidden",
    bodyIncluded: false,
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary: null,
    timelineNote: MODERATION_TIMELINE,
    publicRationaleRequired:
      "Public rationale (required): Hidden from this publication after unresolved citation mismatches; content is retained, not deleted.",
    privateNoteRedactionNote:
      "Private moderator notes stay staff-only and are redacted from every public projection.",
    preservedRevisionHistoryNote:
      "Hide ≠ delete. Revision chronology remains available to authorized staff after alpha reset rules allow.",
    notice: {
      action: "hide",
      publicRationale:
        "Hidden from this publication after unresolved citation mismatches; content is retained, not deleted.",
      recordedAt: "2026-03-15T09:30:00.000Z",
      subjectKind: "claim",
    },
    previewNextState: "restored",
    previewNextStateLabel: "Preview next state: restored to visible",
  },
  restored: {
    roleLabel: "Synthetic role preview — moderation",
    stateLabel: "Restored to visible",
    visibility: "visible",
    bodyIncluded: true,
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary:
      "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
    timelineNote: MODERATION_TIMELINE,
    publicRationaleRequired:
      "Public rationale (required): Citations verified; claim returned to the published projection. Restoration is not approval or consensus.",
    privateNoteRedactionNote:
      "Private moderator notes stay staff-only and are redacted from every public projection.",
    preservedRevisionHistoryNote:
      "Restore lands on visible. History of hold/hide/restore reasons remains; content was never deleted.",
    notice: {
      action: "restore",
      publicRationale:
        "Citations verified; claim returned to the published projection. Restoration is not approval or consensus.",
      recordedAt: "2026-03-16T16:45:00.000Z",
      subjectKind: "claim",
    },
    previewNextState: null,
    previewNextStateLabel: null,
  },
  empty: {
    roleLabel: "Synthetic role preview — moderation",
    stateLabel: "Not a moderation visibility state",
    visibility: "visible",
    bodyIncluded: false,
    claimTitle: null,
    claimSummary: null,
    timelineNote:
      "“Empty” is a visitor-publication preview: the topic stays published while no claim/evidence currently meets the allowlist. It is not a stored moderation visibility value.",
    publicRationaleRequired:
      "No additional moderation action is implied by the empty published shell.",
    privateNoteRedactionNote:
      "Private moderator notes stay staff-only and are redacted from every public projection.",
    preservedRevisionHistoryNote:
      "Publication status remains published; operational workflow and moderation stay independent axes.",
    notice: null,
    previewNextState: null,
    previewNextStateLabel: null,
  },
};

export const workflowVisitorFixtures: Record<
  ModerationPreviewState,
  WorkflowVisitorStateFixture
> = {
  visible: {
    roleLabel: "Synthetic role preview — visitor public projection",
    stateLabel: "Visitor view while claim is visible",
    topicTitle: "Cedar River residential drought surcharge (synthetic)",
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary:
      "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
    bodyExcludedNote: null,
    publicConflictSummary:
      "Submitter notes a prior consulting engagement with a regional metering vendor (ended more than two years ago).",
    evidenceConflictPublicSummary:
      "Evidence author notes a fictional prior research stipend related to the linked metering memo.",
    revisionSummary: {
      revisionCount: 1,
      latestRevisionAt: "2026-03-12T15:10:00.000Z",
      changedFieldLabels: ["Summary", "Approach label"],
    },
    comparisonItems: COMPARISON_ITEMS,
    moderationNotice: null,
    projectionNote:
      "Allowlisted public fields only: no private conflict detail, no private review notes, no account identifiers. Evidence quality and workflow explanations stay separate from claim truth.",
  },
  held: {
    roleLabel: "Synthetic role preview — visitor public projection",
    stateLabel: "Visitor view during example held state",
    topicTitle: "Cedar River residential drought surcharge (synthetic)",
    claimTitle: null,
    claimSummary: null,
    bodyExcludedNote:
      "Claim body is absent from this projection while held. Withholding is a visibility action; content is retained.",
    publicConflictSummary: null,
    evidenceConflictPublicSummary: null,
    revisionSummary: null,
    comparisonItems: [],
    moderationNotice: {
      action: "hold",
      publicRationale:
        "Temporary hold while source citations are checked against the linked memo.",
      recordedAt: "2026-03-14T11:00:00.000Z",
      subjectKind: "claim",
    },
    projectionNote:
      "Visitors see the public moderation notice and do not see excluded bodies, private notes, or staff-only detail.",
  },
  hidden: {
    roleLabel: "Synthetic role preview — visitor public projection",
    stateLabel: "Visitor view during example hidden state",
    topicTitle: "Cedar River residential drought surcharge (synthetic)",
    claimTitle: null,
    claimSummary: null,
    bodyExcludedNote:
      "Claim body remains absent while hidden. Hide does not delete the submission or its revision history.",
    publicConflictSummary: null,
    evidenceConflictPublicSummary: null,
    revisionSummary: null,
    comparisonItems: [],
    moderationNotice: {
      action: "hide",
      publicRationale:
        "Hidden from this publication after unresolved citation mismatches; content is retained, not deleted.",
      recordedAt: "2026-03-15T09:30:00.000Z",
      subjectKind: "claim",
    },
    projectionNote:
      "Visitors see the public moderation notice and do not see excluded bodies, private notes, or staff-only detail.",
  },
  restored: {
    roleLabel: "Synthetic role preview — visitor public projection",
    stateLabel: "Visitor view after restore-to-visible",
    topicTitle: "Cedar River residential drought surcharge (synthetic)",
    claimTitle: "Metered drought surcharge reduces peak residential use",
    claimSummary:
      "Synthetic claim: a temporary residential drought surcharge paired with meter upgrades can reduce peak summer use without cutting essential indoor water.",
    bodyExcludedNote: null,
    publicConflictSummary:
      "Submitter notes a prior consulting engagement with a regional metering vendor (ended more than two years ago).",
    evidenceConflictPublicSummary:
      "Evidence author notes a fictional prior research stipend related to the linked metering memo.",
    revisionSummary: {
      revisionCount: 1,
      latestRevisionAt: "2026-03-12T15:10:00.000Z",
      changedFieldLabels: ["Summary", "Approach label"],
    },
    comparisonItems: COMPARISON_ITEMS,
    moderationNotice: {
      action: "restore",
      publicRationale:
        "Citations verified; claim returned to the published projection. Restoration is not approval or consensus.",
      recordedAt: "2026-03-16T16:45:00.000Z",
      subjectKind: "claim",
    },
    projectionNote:
      "Restoration returns content to the published projection; it is not approval, truth certification, or consensus.",
  },
  empty: {
    roleLabel: "Synthetic role preview — visitor public projection",
    stateLabel: "Visitor view of a published topic with no included content",
    topicTitle: "Cedar River residential drought surcharge (synthetic)",
    claimTitle: null,
    claimSummary: null,
    bodyExcludedNote:
      "This topic remains published, but no claim or evidence currently meets the public projection allowlist. Excluded titles, bodies, and URLs are not listed.",
    publicConflictSummary: null,
    evidenceConflictPublicSummary: null,
    revisionSummary: null,
    comparisonItems: [],
    moderationNotice: null,
    emptyPublishedShell: true,
    projectionNote:
      "A published-but-empty shell stays addressable. Moderation and quality decisions do not silently unpublish the topic.",
  },
};

export const workflowDemoDisclosure = {
  demonstrates: [
    "Participant claim/evidence submission with conflict disclosure split (public summary vs private detail).",
    "Independent claim workflow and evidence-quality review labels.",
    "Revision chronology vs visitor-safe revision summary.",
    "Supporting vs counterevidence comparison as a local reading aid.",
    "Moderation visibility timeline (visible → held → hidden → restored-to-visible) with required public rationales.",
    "Visitor allowlisted projection, including absent bodies while held or hidden.",
    "Evidence public conflict summary beside included sources; private detail never shown.",
    "Published topic with no currently included content remains an addressable empty shell.",
  ],
  remainsSimulated: [
    "No live accounts, sessions, invitations, or administrator console.",
    "No database, Auth.js, audit writes, or moderation mutations.",
    "No claim that other visitors are live or that actions completed.",
    "Selectors only change fixture presentation via the URL.",
  ],
} as const;
