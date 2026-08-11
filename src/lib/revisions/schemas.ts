import { z } from "zod";

/** Claim content fields that may appear in revision snapshots / changed_fields. */
export const CLAIM_CONTENT_FIELDS = [
  "title",
  "summary",
  "approachLabel",
] as const;

/** Evidence content fields that may appear in revision snapshots / changed_fields. */
export const EVIDENCE_CONTENT_FIELDS = [
  "sourceUrl",
  "title",
  "organization",
  "authorType",
  "sourceType",
  "limitations",
] as const;

export type ClaimContentField = (typeof CLAIM_CONTENT_FIELDS)[number];
export type EvidenceContentField = (typeof EVIDENCE_CONTENT_FIELDS)[number];

export const claimContentSnapshotSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(4000),
    approachLabel: z.string().trim().min(1).max(200),
  })
  .strict();

const evidenceAuthorTypeSchema = z.enum([
  "agency",
  "researcher",
  "journalist",
  "civil_society",
  "industry",
  "other",
]);

const evidenceSourceTypeSchema = z.enum([
  "report",
  "dataset",
  "peer_reviewed",
  "news",
  "memo",
  "other",
]);

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source URL must be a valid absolute URL",
      });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source URL must use http or https",
      });
    }
  });

export const evidenceContentSnapshotSchema = z
  .object({
    sourceUrl: httpUrlSchema,
    title: z.string().trim().min(1).max(200),
    organization: z.string().trim().min(1).max(200),
    authorType: evidenceAuthorTypeSchema,
    sourceType: evidenceSourceTypeSchema,
    limitations: z.string().trim().min(1).max(4000),
  })
  .strict();

export type ClaimContentSnapshot = z.infer<typeof claimContentSnapshotSchema>;
export type EvidenceContentSnapshot = z.infer<
  typeof evidenceContentSnapshotSchema
>;

export const claimChangedFieldsSchema = z
  .array(z.enum(CLAIM_CONTENT_FIELDS))
  .min(1);

export const evidenceChangedFieldsSchema = z
  .array(z.enum(EVIDENCE_CONTENT_FIELDS))
  .min(1);

/** Human-readable labels for owner/staff history and public summaries. */
export const CONTENT_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  approachLabel: "Approach label",
  sourceUrl: "Source URL",
  organization: "Organization",
  authorType: "Author type",
  sourceType: "Source type",
  limitations: "Limitations",
};

/** Neutral public-facing phrases (never historic bodies). */
export const PUBLIC_FIELD_UPDATE_LABELS: Record<string, string> = {
  title: "title updated",
  summary: "summary updated",
  approachLabel: "approach label updated",
  sourceUrl: "source URL updated",
  organization: "organization updated",
  authorType: "author type updated",
  sourceType: "source type updated",
  limitations: "limitations updated",
};

export function diffClaimContent(
  before: ClaimContentSnapshot,
  after: ClaimContentSnapshot,
): ClaimContentField[] {
  return CLAIM_CONTENT_FIELDS.filter((field) => before[field] !== after[field]);
}

export function diffEvidenceContent(
  before: EvidenceContentSnapshot,
  after: EvidenceContentSnapshot,
): EvidenceContentField[] {
  return EVIDENCE_CONTENT_FIELDS.filter(
    (field) => before[field] !== after[field],
  );
}
