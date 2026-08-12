import { z } from "zod";

export const MIN_PUBLIC_RATIONALE = 8;
export const MAX_PUBLIC_RATIONALE = 4000;
export const MAX_PRIVATE_NOTES = 4000;

export const moderationActionKindSchema = z.enum(["hold", "hide", "restore"]);
export const moderationVisibilitySchema = z.enum([
  "visible",
  "held",
  "hidden",
]);

const expectedUpdatedAtSchema = z.union([
  z.date(),
  z.string().datetime({ offset: true }),
]);

export const claimModerationInputSchema = z.object({
  claimId: z.string().min(1),
  action: moderationActionKindSchema,
  publicRationale: z
    .string()
    .trim()
    .min(MIN_PUBLIC_RATIONALE)
    .max(MAX_PUBLIC_RATIONALE),
  privateNotes: z
    .string()
    .trim()
    .max(MAX_PRIVATE_NOTES)
    .optional()
    .nullable(),
  expectedVisibility: moderationVisibilitySchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const evidenceModerationInputSchema = z.object({
  evidenceSubmissionId: z.string().min(1),
  action: moderationActionKindSchema,
  publicRationale: z
    .string()
    .trim()
    .min(MIN_PUBLIC_RATIONALE)
    .max(MAX_PUBLIC_RATIONALE),
  privateNotes: z
    .string()
    .trim()
    .max(MAX_PRIVATE_NOTES)
    .optional()
    .nullable(),
  expectedVisibility: moderationVisibilitySchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type ModerationActionKind = z.infer<typeof moderationActionKindSchema>;
export type ModerationVisibility = z.infer<typeof moderationVisibilitySchema>;

export function resolveModerationTransition(
  action: ModerationActionKind,
  fromVisibility: ModerationVisibility,
): ModerationVisibility | null {
  switch (action) {
    case "hold":
      return fromVisibility === "visible" ? "held" : null;
    case "hide":
      return fromVisibility === "visible" || fromVisibility === "held"
        ? "hidden"
        : null;
    case "restore":
      return fromVisibility === "held" || fromVisibility === "hidden"
        ? "visible"
        : null;
  }
}

export function auditActionFor(
  action: ModerationActionKind,
):
  | "moderation.submission_held"
  | "moderation.submission_hidden"
  | "moderation.submission_restored" {
  switch (action) {
    case "hold":
      return "moderation.submission_held";
    case "hide":
      return "moderation.submission_hidden";
    case "restore":
      return "moderation.submission_restored";
  }
}

export function normalizeExpectedUpdatedAt(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Safe public moderation notice — never subject title/body/URL or private notes. */
export type PublicModerationNotice = {
  action: ModerationActionKind;
  publicRationale: string;
  recordedAt: string;
};

export function toPublicModerationNotice(input: {
  action: ModerationActionKind;
  publicRationale: string;
  createdAt: Date | string;
}): PublicModerationNotice {
  return {
    action: input.action,
    publicRationale: input.publicRationale,
    recordedAt:
      typeof input.createdAt === "string"
        ? input.createdAt
        : input.createdAt.toISOString(),
  };
}
