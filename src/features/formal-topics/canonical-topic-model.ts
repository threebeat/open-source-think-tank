import type { PublicDiscussionRelationship } from "@/features/formal-topics/discussion-relationships";
import type { PublicInputPublicDto } from "@/features/public-input/aggregate-report";
import type { QualificationTrace } from "@/fixtures/journey-catalog";
import type { FormalTopicGateView } from "@/fixtures/journey-catalog";
import type {
  Claim,
  EvidenceSource,
  Topic,
} from "@/domain/types";
import type { PublicTopicProjection } from "@/lib/topics/public-projection";

export type EvidenceSummaryCounts = {
  totalPublic: number;
  accepted: number;
  limited: number;
  disputed: number;
  pending: number;
  rejected: number;
  readinessLabel: string;
  importantGap: string;
};

export type CanonicalTopicViewModel = {
  lane: "public-demo" | "gated";
  slug: string;
  title: string;
  question: string;
  introduction: string;
  stageLabel: string;
  jurisdictionLabel: string;
  disclosure: string;
  lastPublicUpdate: string | null;
  advancingState: "advancing" | "paused" | "deferred" | "complete";
  whoCanActNow: string;
  nextTransition: string;
  unmetCriteria: string[];
  criteriaMet: string[];
  evidenceSummary: EvidenceSummaryCounts;
  /** Full fixture evidence for public-demo Evidence section. */
  claims: Claim[];
  evidence: EvidenceSource[];
  /** Gated allowlisted projection for Evidence section (null in public-demo). */
  gatedProjection: PublicTopicProjection | null;
  discussions: PublicDiscussionRelationship[];
  discussionsUnavailableReason: string | null;
  publicInputReport: PublicInputPublicDto | null;
  qualificationTrace: QualificationTrace | null;
  gate: FormalTopicGateView | null;
  topic: Topic | null;
};
