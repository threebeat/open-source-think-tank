import { z } from "zod";

import { findForbiddenPublicInputKeys } from "@/lib/public-input/reports/forbidden-keys";

/**
 * Canonical aggregate-only import descriptor (ADR 0018).
 *
 * This is the *only* accepted ingest shape for Phase 4.4. It intentionally
 * has no room for per-person rows, vote matrices, membership maps, provider
 * participant/account ids, `xid`, raw provider URLs, or secrets — those
 * fields simply do not exist in the schema, and `.strict()` at every object
 * level plus the recursive forbidden-key walker below both reject them if a
 * caller tries to smuggle them in anyway.
 */
export const CANONICAL_IMPORT_SCHEMA_VERSION = "public-input-aggregate-import@1";

export const MAX_OPINION_GROUPS = 20;
export const MAX_FINDINGS_PER_KIND = 50;
const MAX_LABEL_LENGTH = 120;
const MAX_FINDING_TEXT_LENGTH = 500;
const MAX_SUFFICIENCY_TEXT_LENGTH = 1000;
const MAX_LIMITATIONS_TEXT_LENGTH = 1000;
const MAX_METHOD_VERSION_LENGTH = 100;
const MAX_PROVIDER_EXPORT_LABEL_LENGTH = 100;
const MAX_PUBLIC_TITLE_LENGTH = 200;

/** Enum-level source kinds the canonical schema will even parse — operational subset only. */
export const CANONICAL_IMPORT_SOURCE_KINDS = [
  "fixture",
  "manual_aggregate",
] as const;
export type CanonicalImportSourceKind =
  (typeof CANONICAL_IMPORT_SOURCE_KINDS)[number];

function boundedNonBlankString(max: number) {
  return z.string().trim().min(1).max(max);
}

const shareSchema = z.number().finite().min(0).max(1);

const opinionGroupSchema = z
  .object({
    label: boundedNonBlankString(MAX_LABEL_LENGTH),
    share: shareSchema,
  })
  .strict();

const findingTextSchema = boundedNonBlankString(MAX_FINDING_TEXT_LENGTH);

const safeNonnegativeInt = z.number().int().nonnegative().safe();

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

/**
 * Validate an arbitrary unknown payload against the canonical import schema.
 * Runs the recursive forbidden-key walker *before* zod parsing so a
 * malicious/careless payload that smuggles a forbidden key inside an object
 * zod would otherwise reject anyway (or, if the shapes ever loosen, might
 * not) is always caught with an explicit diagnostic.
 */
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

  // Belt-and-suspenders: the enum already excludes live provider kinds, but
  // fail closed explicitly rather than trusting enum membership alone.
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

  return { ok: true, value: parsed.data };
}
