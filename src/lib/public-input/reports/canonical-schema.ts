import { z } from "zod";

import { findForbiddenPublicInputKeys } from "@/lib/public-input/reports/forbidden-keys";

/**
 * Canonical aggregate-only import descriptor (ADR 0018 + Phase 4.5A).
 *
 * Schema `@1.1` requires exact integer `participantCount` per opinion group
 * (never inferred from rounded shares). Partition sum must equal
 * `participationCount`. Duplicate normalized labels are rejected.
 */
export const CANONICAL_IMPORT_SCHEMA_VERSION =
  "public-input-aggregate-import@1.1";

export const MAX_OPINION_GROUPS = 20;
export const MAX_FINDINGS_PER_KIND = 50;
const MAX_LABEL_LENGTH = 120;
const MAX_FINDING_TEXT_LENGTH = 500;
const MAX_SUFFICIENCY_TEXT_LENGTH = 1000;
const MAX_LIMITATIONS_TEXT_LENGTH = 1000;
const MAX_METHOD_VERSION_LENGTH = 100;
const MAX_PROVIDER_EXPORT_LABEL_LENGTH = 100;
const MAX_PUBLIC_TITLE_LENGTH = 200;
const MAX_MODERATION_POLICY_VERSION_LENGTH = 100;

export const CANONICAL_IMPORT_SOURCE_KINDS = [
  "fixture",
  "manual_aggregate",
] as const;
export type CanonicalImportSourceKind =
  (typeof CANONICAL_IMPORT_SOURCE_KINDS)[number];

function boundedNonBlankString(max: number) {
  return z.string().trim().min(1).max(max);
}

const safeNonnegativeInt = z.number().int().nonnegative().safe();

const opinionGroupSchema = z
  .object({
    label: boundedNonBlankString(MAX_LABEL_LENGTH),
    participantCount: safeNonnegativeInt,
  })
  .strict();

const findingTextSchema = boundedNonBlankString(MAX_FINDING_TEXT_LENGTH);

const aggregateModerationDisclosureSchema = z
  .object({
    reviewedCount: safeNonnegativeInt,
    acceptedCount: safeNonnegativeInt,
    rejectedCount: safeNonnegativeInt,
    policyVersion: boundedNonBlankString(MAX_MODERATION_POLICY_VERSION_LENGTH)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.acceptedCount + value.rejectedCount > value.reviewedCount) {
      ctx.addIssue({
        code: "custom",
        message:
          "acceptedCount + rejectedCount must be <= reviewedCount",
        path: ["reviewedCount"],
      });
    }
  });

export const canonicalAggregateImportSchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_IMPORT_SCHEMA_VERSION),
    sourceKind: z.enum(CANONICAL_IMPORT_SOURCE_KINDS),
    methodVersion: boundedNonBlankString(MAX_METHOD_VERSION_LENGTH),
    providerExportVersionLabel: boundedNonBlankString(
      MAX_PROVIDER_EXPORT_LABEL_LENGTH,
    )
      .nullable()
      .optional(),
    generatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    publicTitle: boundedNonBlankString(MAX_PUBLIC_TITLE_LENGTH),
    participationCount: safeNonnegativeInt,
    commentCount: safeNonnegativeInt,
    voteCount: safeNonnegativeInt,
    participationSufficiency: boundedNonBlankString(
      MAX_SUFFICIENCY_TEXT_LENGTH,
    ),
    representationLimitations: boundedNonBlankString(
      MAX_LIMITATIONS_TEXT_LENGTH,
    ),
    opinionGroups: z.array(opinionGroupSchema).max(MAX_OPINION_GROUPS),
    crossGroupAgreement: z
      .array(findingTextSchema)
      .max(MAX_FINDINGS_PER_KIND),
    meaningfulDisagreement: z
      .array(findingTextSchema)
      .max(MAX_FINDINGS_PER_KIND),
    /**
     * Optional immutable aggregate moderation summary carried in the import.
     * When omitted/null, public projections omit moderation disclosure entirely
     * (never invent “Reviewed 0”).
     */
    aggregateModerationDisclosure: aggregateModerationDisclosureSchema
      .nullable()
      .optional(),
  })
  .strict();

export type CanonicalAggregateImport = z.infer<
  typeof canonicalAggregateImportSchema
>;

export type CanonicalImportValidationResult =
  | { ok: true; value: CanonicalAggregateImport }
  | {
      ok: false;
      error: string;
      code: string;
      issues: string[];
    };

/** Normalize labels for duplicate detection (NFC + trim + casefold). */
export function normalizeOpinionGroupLabel(label: string): string {
  return label.normalize("NFC").trim().toLocaleLowerCase("en-US");
}

function partitionAndLabelIssues(
  value: CanonicalAggregateImport,
): string[] {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  let sum = 0;
  for (const group of value.opinionGroups) {
    sum += group.participantCount;
    const key = normalizeOpinionGroupLabel(group.label);
    if (seen.has(key)) {
      issues.push(
        `opinionGroups: duplicate normalized label "${group.label}" (conflicts with "${seen.get(key)}")`,
      );
    } else {
      seen.set(key, group.label);
    }
  }
  if (sum !== value.participationCount) {
    issues.push(
      `opinionGroups: participantCount sum ${sum} must equal participationCount ${value.participationCount}`,
    );
  }
  return issues;
}

export function validateCanonicalAggregateImport(
  raw: unknown,
): CanonicalImportValidationResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "Import payload must be a JSON object",
      code: "IMPORT_PAYLOAD_NOT_OBJECT",
      issues: [],
    };
  }

  const forbiddenHits = findForbiddenPublicInputKeys(raw);
  if (forbiddenHits.length > 0) {
    return {
      ok: false,
      error: "Import payload contains forbidden keys",
      code: "IMPORT_PAYLOAD_FORBIDDEN_KEYS",
      issues: forbiddenHits,
    };
  }

  const parsed = canonicalAggregateImportSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Import payload failed canonical schema validation",
      code: "IMPORT_PAYLOAD_SCHEMA_INVALID",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }

  if (
    !(CANONICAL_IMPORT_SOURCE_KINDS as readonly string[]).includes(
      parsed.data.sourceKind,
    )
  ) {
    return {
      ok: false,
      error: "Only fixture/manual_aggregate sources are accepted",
      code: "IMPORT_SOURCE_KIND_NOT_OPERATIONAL",
      issues: [],
    };
  }

  const partitionIssues = partitionAndLabelIssues(parsed.data);
  if (partitionIssues.length > 0) {
    return {
      ok: false,
      error: "Import payload failed partition/label consistency checks",
      code: "IMPORT_PAYLOAD_PARTITION_INVALID",
      issues: partitionIssues,
    };
  }

  return { ok: true, value: parsed.data };
}
