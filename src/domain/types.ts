import type { z } from "zod";

import type {
  agendaItemSchema,
  amendmentSchema,
  auditEventSchema,
  claimSchema,
  conflictDisclosureSchema,
  consultationResultSchema,
  consultationStatementSchema,
  councilParticipantSchema,
  decisionSchema,
  deliberationSchema,
  evidenceSourceSchema,
  fixtureCatalogSchema,
  opinionGroupSchema,
  proposalSchema,
  topicSchema,
} from "@/domain/schemas";

export type Topic = z.infer<typeof topicSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type ConsultationStatement = z.infer<typeof consultationStatementSchema>;
export type OpinionGroup = z.infer<typeof opinionGroupSchema>;
export type ConsultationResult = z.infer<typeof consultationResultSchema>;
export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Amendment = z.infer<typeof amendmentSchema>;
export type CouncilParticipant = z.infer<typeof councilParticipantSchema>;
export type ConflictDisclosure = z.infer<typeof conflictDisclosureSchema>;
export type Deliberation = z.infer<typeof deliberationSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type FixtureCatalog = z.infer<typeof fixtureCatalogSchema>;

export type {
  AgendaState,
  AmendmentStatus,
  DecisionOutcome,
  EvidenceReviewStatus,
  ProposalState,
  TopicStage,
  TopicStatus,
  VoteChoice,
} from "@/domain/status";
