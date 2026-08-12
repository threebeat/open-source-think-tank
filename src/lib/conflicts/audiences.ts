import type { ConflictDisclosureRecord } from "@/lib/conflicts/repository";

/** Owner / matching reviewer DTO — includes private detail for the exact subject. */
export type OwnerOrReviewerConflictDisclosure = {
  id: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  publicSummary: string;
  privateDetail: string | null;
  synthetic: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Moderator-only / anonymous-safe public summary — never private detail. */
export type PublicSummaryConflictDisclosure = {
  id: string;
  claimId: string | null;
  evidenceSubmissionId: string | null;
  publicSummary: string;
  synthetic: boolean;
  createdAt: string;
};

export function toOwnerOrReviewerConflictDisclosure(
  row: ConflictDisclosureRecord,
): OwnerOrReviewerConflictDisclosure {
  return {
    id: row.id,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    publicSummary: row.publicSummary,
    privateDetail: row.privateDetail,
    synthetic: row.synthetic,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicSummaryConflictDisclosure(
  row: ConflictDisclosureRecord,
): PublicSummaryConflictDisclosure {
  return {
    id: row.id,
    claimId: row.claimId,
    evidenceSubmissionId: row.evidenceSubmissionId,
    publicSummary: row.publicSummary,
    synthetic: row.synthetic,
    createdAt: row.createdAt.toISOString(),
  };
}
