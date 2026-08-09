import { z } from "zod";

import {
  AGENDA_STATES,
  AMENDMENT_STATUSES,
  AUTHOR_TYPES,
  DECISION_OUTCOMES,
  EVIDENCE_REVIEW_STATUSES,
  PROPOSAL_STATES,
  SOURCE_TYPES,
  TOPIC_STAGES,
  TOPIC_STATUSES,
  VOTE_CHOICES,
} from "@/domain/status";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected ISO date");

export const topicChangelogEntrySchema = z.object({
  at: isoDate,
  summary: z.string().min(1),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  synthetic: z.literal(true),
  title: z.string().min(1),
  question: z.string().min(1),
  background: z.string().min(1),
  scope: z.string().min(1),
  stage: z.enum(TOPIC_STAGES),
  status: z.enum(TOPIC_STATUSES),
  subjectTags: z.array(z.string().min(1)).min(1),
  claimIds: z.array(z.string().min(1)),
  changelog: z.array(topicChangelogEntrySchema),
  nextStep: z.string().min(1),
  participationSummary: z.string().optional(),
});

export const claimSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  topicId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Neutral label for a policy approach — not an ideology. */
  approachLabel: z.string().min(1),
  supportingEvidenceIds: z.array(z.string().min(1)),
  counterEvidenceIds: z.array(z.string().min(1)),
});

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  topicId: z.string().min(1),
  title: z.string().min(1),
  organization: z.string().min(1),
  authorType: z.enum(AUTHOR_TYPES),
  sourceType: z.enum(SOURCE_TYPES),
  publishedOn: isoDate,
  reviewStatus: z.enum(EVIDENCE_REVIEW_STATUSES),
  conflicts: z.string().min(1),
  limitations: z.string().min(1),
  summary: z.string().min(1),
});

export const consultationStatementSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  topicId: z.string().min(1),
  text: z.string().min(1),
  relatedClaimIds: z.array(z.string().min(1)).default([]),
  relatedEvidenceIds: z.array(z.string().min(1)).default([]),
  isCrossGroupConsensus: z.boolean(),
  isHighDisagreement: z.boolean(),
  isPopularWeakEvidence: z.boolean(),
  isLessPopularStrongEvidence: z.boolean(),
});

export const opinionGroupSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  label: z.string().min(1),
});

export const statementGroupSupportSchema = z.object({
  statementId: z.string().min(1),
  agreeShare: z.number().min(0).max(1),
  groupAgreeShares: z.record(z.string(), z.number().min(0).max(1)),
});

export const consultationResultSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  synthetic: z.literal(true),
  participationCount: z.number().int().positive(),
  responseCoverage: z.number().min(0).max(1),
  opinionGroupIds: z.array(z.string().min(1)).min(3),
  statementIds: z.array(z.string().min(1)).min(8),
  consensusStatementIds: z.array(z.string().min(1)).min(2),
  highDisagreementStatementIds: z.array(z.string().min(1)).min(2),
  statementMetrics: z.array(statementGroupSupportSchema).min(1),
  methodVersion: z.string().min(1),
  notRepresentativeNotice: z.string().min(1),
});

export const agendaThresholdSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.string().min(1),
  actual: z.string().min(1),
  met: z.boolean(),
});

export const humanReviewSchema = z.object({
  reviewerRole: z.string().min(1),
  decision: z.enum(AGENDA_STATES),
  decidedAt: isoDate,
  conflicts: z.string().min(1),
  rationale: z.string().min(1),
});

export const agendaItemSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    topicId: z.string().min(1),
    consultationResultId: z.string().min(1),
    synthetic: z.literal(true),
    state: z.enum(AGENDA_STATES),
    title: z.string().min(1),
    thresholds: z.array(agendaThresholdSchema).min(1),
    participationCoverage: z.string().min(1),
    crossGroupSupport: z.string().min(1),
    disagreementSalience: z.string().min(1),
    evidenceReadiness: z.string().min(1),
    representationWarning: z.string().min(1),
    methodVersion: z.string().min(1),
    calculationTrace: z.array(z.string().min(1)).min(1),
    sensitivityNote: z.string().min(1),
    humanReview: humanReviewSchema,
  })
  .superRefine((item, ctx) => {
    if (item.state !== item.humanReview.decision) {
      ctx.addIssue({
        code: "custom",
        message:
          "Agenda item state must equal humanReview.decision so list and review outcomes cannot contradict",
        path: ["humanReview", "decision"],
      });
    }
  });

export const proposalSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  topicId: z.string().min(1),
  version: z.number().int().positive(),
  state: z.enum(PROPOSAL_STATES),
  title: z.string().min(1),
  body: z.string().min(1),
  createdAt: isoDate,
});

export const amendmentSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  proposalId: z.string().min(1),
  status: z.enum(AMENDMENT_STATUSES),
  title: z.string().min(1),
  rationale: z.string().min(1),
  body: z.string().min(1),
  createdAt: isoDate,
  relatedEvidenceIds: z.array(z.string().min(1)).default([]),
  relatedStatementIds: z.array(z.string().min(1)).default([]),
  relatedClaimIds: z.array(z.string().min(1)).default([]),
});

export const councilParticipantSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  displayName: z.string().min(1),
  termStart: isoDate,
  termEnd: isoDate,
  selectionPath: z.string().min(1),
  voting: z.boolean(),
});

export const conflictDisclosureSchema = z.object({
  id: z.string().min(1),
  synthetic: z.literal(true),
  participantId: z.string().min(1),
  summary: z.string().min(1),
  disclosedAt: isoDate,
});

export const evidenceRequestSchema = z.object({
  id: z.string().min(1),
  request: z.string().min(1),
  response: z.string().min(1),
  requestedAt: isoDate,
  respondedAt: isoDate,
  relatedEvidenceIds: z.array(z.string().min(1)).min(1),
});

export const recusalSchema = z.object({
  participantId: z.string().min(1),
  publicReason: z.string().min(1),
  recordedAt: isoDate,
});

export const deliberationTimelineEntrySchema = z.object({
  at: isoDate,
  summary: z.string().min(1),
});

export const publicRedactionSchema = z.object({
  scope: z.string().min(1),
  publicReason: z.string().min(1),
});

export const deliberationSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  topicId: z.string().min(1),
  agendaItemId: z.string().min(1),
  synthetic: z.literal(true),
  selectionExplanation: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1),
  conflictDisclosureIds: z.array(z.string().min(1)),
  proposalIds: z.array(z.string().min(1)).min(1),
  amendmentIds: z.array(z.string().min(1)).min(2),
  evidenceRequest: evidenceRequestSchema,
  recusal: recusalSchema,
  timeline: z.array(deliberationTimelineEntrySchema).min(1),
  observerNotice: z.string().min(1),
  publicRedaction: publicRedactionSchema,
});

export const rollCallEntrySchema = z.object({
  participantId: z.string().min(1),
  vote: z.enum(VOTE_CHOICES),
});

export const minorityReportSchema = z.object({
  title: z.string().min(1),
  authorParticipantIds: z.array(z.string().min(1)).min(1),
  body: z.string().min(1),
});

export const decisionSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    topicId: z.string().min(1),
    deliberationId: z.string().min(1),
    finalProposalId: z.string().min(1),
    synthetic: z.literal(true),
    outcome: z.enum(DECISION_OUTCOMES),
    adoptingBody: z.string().min(1),
    /** When the decision record was published. */
    publishedOn: isoDate,
    /** Set when the Policy Council (or equivalent) recommends a position. */
    recommendedOn: isoDate.optional(),
    /** Reserved for true institutional adoption; omit for recommendations. */
    effectiveOn: isoDate.optional(),
    reviewOn: isoDate,
    voteFor: z.number().int().nonnegative(),
    voteAgainst: z.number().int().nonnegative(),
    voteAbstain: z.number().int().nonnegative(),
    rollCall: z.array(rollCallEntrySchema).min(1),
    rationale: z.string().min(1),
    minorityReport: minorityReportSchema,
    proposalVersionIds: z.array(z.string().min(1)).min(1),
  })
  .superRefine((decision, ctx) => {
    if (decision.outcome === "recommended") {
      if (!decision.recommendedOn) {
        ctx.addIssue({
          code: "custom",
          message: "recommendedOn is required when outcome is recommended",
          path: ["recommendedOn"],
        });
      }
      if (decision.effectiveOn) {
        ctx.addIssue({
          code: "custom",
          message: "effectiveOn is reserved for adopted outcomes",
          path: ["effectiveOn"],
        });
      }
    }
    if (decision.outcome === "adopted" && !decision.effectiveOn) {
      ctx.addIssue({
        code: "custom",
        message: "effectiveOn is required when outcome is adopted",
        path: ["effectiveOn"],
      });
    }
  });

export const auditEventSchema = z.object({
  id: z.string().min(1),
  at: isoDate,
  actorRole: z.string().min(1),
  action: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  summary: z.string().min(1),
  synthetic: z.literal(true),
});

export const fixtureCatalogSchema = z.object({
  synthetic: z.literal(true),
  topics: z.array(topicSchema).min(3),
  claims: z.array(claimSchema),
  evidenceSources: z.array(evidenceSourceSchema),
  consultationStatements: z.array(consultationStatementSchema),
  opinionGroups: z.array(opinionGroupSchema),
  consultationResults: z.array(consultationResultSchema),
  agendaItems: z.array(agendaItemSchema),
  proposals: z.array(proposalSchema),
  amendments: z.array(amendmentSchema),
  councilParticipants: z.array(councilParticipantSchema),
  conflictDisclosures: z.array(conflictDisclosureSchema),
  deliberations: z.array(deliberationSchema),
  decisions: z.array(decisionSchema),
  auditEvents: z.array(auditEventSchema),
});
