import { createHash } from "node:crypto";

/**
 * Machine-readable alpha-reset classification (Phase 3 closure).
 * Mirror of docs/alpha-reset-classification.md — keep in sync.
 */

export const RESET_MANIFEST_VERSION = "3.12.1";

/** Fixed transaction-scoped advisory-lock key for concurrent alpha resets. */
export const ALPHA_RESET_ADVISORY_LOCK_KEY = 3_120_845_120_012;

/** Bounded lock wait inside the destructive transaction (fail closed). */
export const ALPHA_RESET_LOCK_TIMEOUT = "5s";

/** Bounded statement budget inside the destructive transaction (fail closed). */
export const ALPHA_RESET_STATEMENT_TIMEOUT = "120s";

export type AlphaResetTableClass =
  | "reset"
  | "retained"
  | "regenerated"
  | "deferred";

export type AlphaResetTableEntry = {
  table: string;
  class: AlphaResetTableClass;
};

/**
 * Every pgTable in schema.ts — exactly one class each.
 * Count must remain 35 until schema grows (assertManifestComplete).
 */
export const ALPHA_RESET_TABLES: readonly AlphaResetTableEntry[] = [
  { table: "persons", class: "reset" },
  { table: "accounts", class: "reset" },
  { table: "profiles", class: "reset" },
  { table: "invitations", class: "reset" },
  { table: "operator_bootstrap_state", class: "reset" },
  { table: "role_assignments", class: "reset" },
  { table: "council_appointments", class: "reset" },
  // Operational assent document definitions — wiped then regenerated from the
  // checked-in non-participant catalog (not synthetic seed accounts).
  { table: "document_versions", class: "regenerated" },
  { table: "assent_records", class: "reset" },
  { table: "assent_outcomes", class: "reset" },
  { table: "assent_presentations", class: "reset" },
  { table: "verification_cases", class: "reset" },
  { table: "verification_assertions", class: "reset" },
  { table: "verification_artifact_holds", class: "reset" },
  { table: "verification_artifact_payloads", class: "reset" },
  { table: "audit_events", class: "reset" },
  { table: "audit_ledger_head", class: "regenerated" },
  { table: "closed_test_conversations", class: "reset" },
  { table: "conversation_pseudonyms", class: "reset" },
  { table: "retention_policy_settings", class: "regenerated" },
  { table: "account_deletion_requests", class: "reset" },
  { table: "legal_holds", class: "reset" },
  { table: "dual_control_requests", class: "reset" },
  { table: "auth_sessions", class: "reset" },
  { table: "auth_challenges", class: "reset" },
  { table: "schema_meta", class: "retained" },
  { table: "topics", class: "reset" },
  { table: "claims", class: "reset" },
  { table: "evidence_submissions", class: "reset" },
  { table: "claim_evidence_links", class: "reset" },
  { table: "conflict_disclosures", class: "reset" },
  { table: "moderation_actions", class: "reset" },
  { table: "claim_reviews", class: "reset" },
  { table: "content_revisions", class: "reset" },
  { table: "evidence_reviews", class: "reset" },
] as const;

/** Children-first delete order for class=reset tables only (explicit list). */
export const DELETE_ORDER: readonly string[] = [
  "auth_challenges",
  "auth_sessions",
  "conversation_pseudonyms",
  "closed_test_conversations",
  "dual_control_requests",
  "legal_holds",
  "account_deletion_requests",
  "evidence_reviews",
  "claim_reviews",
  "moderation_actions",
  "content_revisions",
  "conflict_disclosures",
  "claim_evidence_links",
  "evidence_submissions",
  "claims",
  "topics",
  "operator_bootstrap_state",
  "audit_events",
  "verification_artifact_payloads",
  "verification_artifact_holds",
  "verification_assertions",
  "verification_cases",
  "assent_presentations",
  "assent_outcomes",
  "assent_records",
  "council_appointments",
  "role_assignments",
  "invitations",
  "profiles",
  "accounts",
  "persons",
] as const;

/**
 * Tables locked inside the destructive transaction (SHARE ROW EXCLUSIVE)
 * so concurrent ordinary writes cannot race counts/deletes/regeneration.
 * Includes reset + regenerated tables; excludes retained schema_meta.
 */
export const RESET_LOCK_TABLES: readonly string[] = [
  ...DELETE_ORDER,
  ...ALPHA_RESET_TABLES.filter((entry) => entry.class === "regenerated").map(
    (entry) => entry.table,
  ),
] as const;

/**
 * Known BEFORE DELETE immutability triggers that must be disabled for operator
 * wipe, then re-enabled. Allowlist only — never DISABLE TRIGGER ALL.
 */
export const IMMUTABLE_DELETE_TRIGGERS: readonly {
  table: string;
  trigger: string;
}[] = [
  { table: "assent_records", trigger: "assent_records_immutable" },
  { table: "assent_outcomes", trigger: "assent_outcomes_immutable" },
  { table: "audit_events", trigger: "audit_events_immutable" },
  { table: "moderation_actions", trigger: "moderation_actions_immutable" },
  { table: "claim_reviews", trigger: "claim_reviews_immutable" },
  { table: "evidence_reviews", trigger: "evidence_reviews_immutable" },
  { table: "content_revisions", trigger: "content_revisions_immutable" },
] as const;

/** Coarse count families for audit metadata (no PII / no row ids). */
export const COUNT_FAMILIES: readonly {
  family: string;
  tables: readonly string[];
}[] = [
  {
    family: "identity",
    tables: [
      "persons",
      "accounts",
      "profiles",
      "invitations",
      "role_assignments",
      "council_appointments",
      "operator_bootstrap_state",
    ],
  },
  {
    family: "auth",
    tables: ["auth_sessions", "auth_challenges"],
  },
  {
    family: "assent",
    tables: [
      "document_versions",
      "assent_records",
      "assent_outcomes",
      "assent_presentations",
    ],
  },
  {
    family: "verification",
    tables: [
      "verification_cases",
      "verification_assertions",
      "verification_artifact_holds",
      "verification_artifact_payloads",
    ],
  },
  {
    family: "audit",
    tables: ["audit_events"],
  },
  {
    family: "privacy",
    tables: [
      "closed_test_conversations",
      "conversation_pseudonyms",
      "account_deletion_requests",
      "legal_holds",
      "dual_control_requests",
      "retention_policy_settings",
    ],
  },
  {
    family: "topics",
    tables: [
      "topics",
      "claims",
      "evidence_submissions",
      "claim_evidence_links",
      "conflict_disclosures",
      "moderation_actions",
      "claim_reviews",
      "content_revisions",
      "evidence_reviews",
    ],
  },
] as const;

export function tablesByClass(
  classification: AlphaResetTableClass,
): string[] {
  return ALPHA_RESET_TABLES.filter((entry) => entry.class === classification).map(
    (entry) => entry.table,
  );
}

export function hashManifest(): string {
  const canonical = JSON.stringify({
    version: RESET_MANIFEST_VERSION,
    tables: ALPHA_RESET_TABLES,
    deleteOrder: DELETE_ORDER,
    lockTables: RESET_LOCK_TABLES,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Fail closed if schema introduces a table the manifest does not classify,
 * or if the manifest lists a table that is not in the known set.
 */
export function assertManifestComplete(knownTableNames: readonly string[]): void {
  const known = new Set(knownTableNames);
  const classified = new Set(ALPHA_RESET_TABLES.map((entry) => entry.table));

  const missingFromManifest = [...known].filter((name) => !classified.has(name));
  if (missingFromManifest.length > 0) {
    throw new Error(
      `ALPHA_RESET_MANIFEST_INCOMPLETE: missing classification for ${missingFromManifest.sort().join(", ")}`,
    );
  }

  const unknownInManifest = [...classified].filter((name) => !known.has(name));
  if (unknownInManifest.length > 0) {
    throw new Error(
      `ALPHA_RESET_MANIFEST_UNKNOWN: classified but not in schema ${unknownInManifest.sort().join(", ")}`,
    );
  }

  const resetSet = new Set(tablesByClass("reset"));
  const deleteSet = new Set(DELETE_ORDER);
  if (resetSet.size !== deleteSet.size) {
    throw new Error(
      "ALPHA_RESET_DELETE_ORDER_MISMATCH: DELETE_ORDER size differs from reset class",
    );
  }
  for (const table of DELETE_ORDER) {
    if (!resetSet.has(table)) {
      throw new Error(
        `ALPHA_RESET_DELETE_ORDER_MISMATCH: ${table} is not class=reset`,
      );
    }
  }
  for (const table of resetSet) {
    if (!deleteSet.has(table)) {
      throw new Error(
        `ALPHA_RESET_DELETE_ORDER_MISMATCH: reset table ${table} missing from DELETE_ORDER`,
      );
    }
  }

  const regenerated = new Set(tablesByClass("regenerated"));
  for (const table of RESET_LOCK_TABLES) {
    if (!resetSet.has(table) && !regenerated.has(table)) {
      throw new Error(
        `ALPHA_RESET_LOCK_TABLE_MISMATCH: ${table} is neither reset nor regenerated`,
      );
    }
  }
  for (const table of [...resetSet, ...regenerated]) {
    if (!RESET_LOCK_TABLES.includes(table)) {
      throw new Error(
        `ALPHA_RESET_LOCK_TABLE_MISMATCH: ${table} missing from RESET_LOCK_TABLES`,
      );
    }
  }
}
