import { z } from "zod";

export const MAX_PUBLIC_SUMMARY = 1000;
export const MAX_PRIVATE_DETAIL = 4000;
export const NO_CONFLICT_SUMMARY =
  "No known conflict of interest to disclose.";

export const disclosureChoiceSchema = z.enum(["none", "disclose"]);

const expectedUpdatedAtSchema = z.union([
  z.date(),
  z.string().datetime({ offset: true }),
]);

export const claimDisclosureUpsertSchema = z
  .object({
    claimId: z.string().min(1),
    disclosureChoice: disclosureChoiceSchema,
    publicSummary: z.string().trim().max(MAX_PUBLIC_SUMMARY).optional(),
    privateDetail: z
      .string()
      .trim()
      .max(MAX_PRIVATE_DETAIL)
      .optional()
      .nullable(),
    /** Required when updating an existing disclosure; omit for first create. */
    expectedUpdatedAt: expectedUpdatedAtSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.disclosureChoice === "disclose") {
      const summary = value.publicSummary?.trim() ?? "";
      if (summary.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Public conflict summary is required when disclosing",
          path: ["publicSummary"],
        });
      }
    }
  });

export const evidenceDisclosureUpsertSchema = z
  .object({
    evidenceSubmissionId: z.string().min(1),
    disclosureChoice: disclosureChoiceSchema,
    publicSummary: z.string().trim().max(MAX_PUBLIC_SUMMARY).optional(),
    privateDetail: z
      .string()
      .trim()
      .max(MAX_PRIVATE_DETAIL)
      .optional()
      .nullable(),
    expectedUpdatedAt: expectedUpdatedAtSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.disclosureChoice === "disclose") {
      const summary = value.publicSummary?.trim() ?? "";
      if (summary.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Public conflict summary is required when disclosing",
          path: ["publicSummary"],
        });
      }
    }
  });

export type ClaimDisclosureUpsertInput = z.infer<
  typeof claimDisclosureUpsertSchema
>;
export type EvidenceDisclosureUpsertInput = z.infer<
  typeof evidenceDisclosureUpsertSchema
>;

export function resolveDisclosurePublicSummary(input: {
  disclosureChoice: "none" | "disclose";
  publicSummary?: string;
}): string {
  if (input.disclosureChoice === "none") {
    return NO_CONFLICT_SUMMARY;
  }
  return (input.publicSummary ?? "").trim();
}

export function resolveDisclosurePrivateDetail(input: {
  disclosureChoice: "none" | "disclose";
  privateDetail?: string | null;
}): string | null {
  if (input.disclosureChoice === "none") {
    return null;
  }
  const detail = input.privateDetail?.trim() ?? "";
  return detail.length > 0 ? detail : null;
}

export function normalizeExpectedUpdatedAt(
  value: Date | string | undefined,
): Date | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value : new Date(value);
}
