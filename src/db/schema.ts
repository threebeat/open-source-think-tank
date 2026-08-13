import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Platform account lifecycle — see phase-2-plan packages 2.4 / 2.8. */
export const accountLifecycleEnum = pgEnum("account_lifecycle_state", [
  "invited",
  "pending_onboarding",
  "active",
  "suspended",
  "closed",
  "anonymization-pending",
]);

export const platformRoleEnum = pgEnum("platform_role", [
  "participant",
  "reviewer",
  "moderator",
  "administrator",
  "auditor",
]);

/** Institutional council seats — never inferred from each other. */
export const councilRoleEnum = pgEnum("council_role", [
  "deliberation_council",
  "policy_council",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

/** Ordinary participant invites vs first-administrator bootstrap invite (3.3). */
export const invitationKindEnum = pgEnum("invitation_kind", [
  "participant",
  "administrator_bootstrap",
]);

/** Singleton first-administrator bootstrap lifecycle (3.3/3.4). */
export const operatorBootstrapStatusEnum = pgEnum("operator_bootstrap_status", [
  "not_started",
  "invitation_live",
  "completed",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "conduct",
  "participation",
  "privacy_notice",
  "other_legal",
]);

export const documentStateEnum = pgEnum("document_state", [
  "draft",
  "counsel_reviewed",
  "published",
  "superseded",
  "withdrawn",
]);

export const verificationKindEnum = pgEnum("verification_assertion_kind", [
  "bot_resistance",
  "contact_continuity",
  "uniqueness",
  "eligibility",
  "residency",
  "legal_identity",
]);

export const verificationCaseStatusEnum = pgEnum("verification_case_status", [
  "pending",
  "approved",
  "denied",
  "expired",
  "appealed",
  "revoked",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** Human identity distinct from platform account (synthetic-only in seeds). */
export const persons = pgTable("persons", {
  id: text("id").primaryKey(),
  synthetic: boolean("synthetic").notNull().default(true),
  displayLabel: text("display_label").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" }),
    contactChannel: text("contact_channel").notNull(),
    lifecycleState: accountLifecycleEnum("lifecycle_state").notNull(),
    synthetic: boolean("synthetic").notNull().default(true),
    contactVerifiedAt: timestamp("contact_verified_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_contact_channel_uidx").on(table.contactChannel),
    check(
      "accounts_lifecycle_timestamps_consistent",
      sql`(
        (${table.lifecycleState} = 'invited' AND ${table.contactVerifiedAt} IS NULL AND ${table.activatedAt} IS NULL AND ${table.suspendedAt} IS NULL AND ${table.closedAt} IS NULL)
        OR (${table.lifecycleState} = 'pending_onboarding' AND ${table.contactVerifiedAt} IS NOT NULL AND ${table.activatedAt} IS NULL AND ${table.suspendedAt} IS NULL AND ${table.closedAt} IS NULL)
        OR (${table.lifecycleState} = 'active' AND ${table.contactVerifiedAt} IS NOT NULL AND ${table.activatedAt} IS NOT NULL AND ${table.suspendedAt} IS NULL AND ${table.closedAt} IS NULL)
        OR (${table.lifecycleState} = 'suspended' AND ${table.contactVerifiedAt} IS NOT NULL AND ${table.activatedAt} IS NOT NULL AND ${table.suspendedAt} IS NOT NULL AND ${table.closedAt} IS NULL)
        OR (${table.lifecycleState} = 'closed' AND ${table.closedAt} IS NOT NULL)
        OR (${table.lifecycleState} = 'anonymization-pending' AND ${table.closedAt} IS NOT NULL)
      )`,
    ),
  ],
);

export const profiles = pgTable("profiles", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  preferredDisplayName: text("preferred_display_name").notNull(),
  locale: text("locale").notNull().default("en-US"),
  ...timestamps,
});

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    intendedContactChannel: text("intended_contact_channel").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    kind: invitationKindEnum("kind").notNull().default("participant"),
    /**
     * Explicit value required for operational rows. Default false so real
     * issuance cannot silently inherit synthetic=true (seeds set true).
     */
    synthetic: boolean("synthetic").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedAccountId: text("accepted_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    issuedByLabel: text("issued_by_label").notNull(),
    /** Null for historical synthetic seeder rows; set for administrator-issued invites. */
    issuedByAccountId: text("issued_by_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invitations_token_hash_uidx").on(table.tokenHash),
    index("invitations_kind_status_idx").on(table.kind, table.status),
    index("invitations_issued_by_account_idx").on(table.issuedByAccountId),
    uniqueIndex("invitations_one_live_bootstrap_uidx")
      .on(table.kind)
      .where(
        sql`${table.kind} = 'administrator_bootstrap' AND ${table.status} = 'pending'`,
      ),
    uniqueIndex("invitations_one_pending_participant_contact_uidx")
      .on(sql`lower(${table.intendedContactChannel})`)
      .where(
        sql`${table.kind} = 'participant' AND ${table.status} = 'pending'`,
      ),
    check(
      "invitations_accepted_requires_account_and_timestamp",
      sql`(
        (${table.status} <> 'accepted')
        OR (
          ${table.acceptedAt} IS NOT NULL
          AND ${table.acceptedAccountId} IS NOT NULL
        )
      )`,
    ),
    check(
      "invitations_pending_has_no_acceptance",
      sql`(
        (${table.status} <> 'pending')
        OR (
          ${table.acceptedAt} IS NULL
          AND ${table.acceptedAccountId} IS NULL
        )
      )`,
    ),
  ],
);

/**
 * Singleton row (`id = 'default'`) guarding first-administrator bootstrap.
 * Prevents concurrent first-admin completions.
 */
export const operatorBootstrapState = pgTable("operator_bootstrap_state", {
  id: text("id").primaryKey(),
  status: operatorBootstrapStatusEnum("status").notNull().default("not_started"),
  liveInvitationId: text("live_invitation_id").references(() => invitations.id, {
    onDelete: "set null",
  }),
  completedAccountId: text("completed_account_id").references(() => accounts.id, {
    onDelete: "restrict",
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastOperatorLabel: text("last_operator_label"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Platform capabilities — not institutional council seats. */
export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: platformRoleEnum("role").notNull(),
    grantedByLabel: text("granted_by_label").notNull(),
    reason: text("reason").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("role_assignments_active_uidx")
      .on(table.accountId, table.role)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

/** Deliberation vs Policy Council appointments are independent rows. */
export const councilAppointments = pgTable(
  "council_appointments",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    councilRole: councilRoleEnum("council_role").notNull(),
    selectionPath: text("selection_path").notNull(),
    termStartsOn: timestamp("term_starts_on", { withTimezone: true }).notNull(),
    termEndsOn: timestamp("term_ends_on", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("council_appointments_active_uidx")
      .on(table.accountId, table.councilRole)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    kind: documentKindEnum("kind").notNull(),
    versionLabel: text("version_label").notNull(),
    contentHash: text("content_hash").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    state: documentStateEnum("state").notNull(),
    /** Notice identifiers that must be acknowledged before assent. */
    requiredNotices: jsonb("required_notices")
      .$type<string[]>()
      .notNull()
      .default([]),
    counselReviewedAt: timestamp("counsel_reviewed_at", { withTimezone: true }),
    counselReviewedByAccountId: text("counsel_reviewed_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByAccountId: text("published_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_versions_kind_label_uidx").on(
      table.kind,
      table.versionLabel,
    ),
    uniqueIndex("document_versions_id_hash_uidx").on(table.id, table.contentHash),
    /** At most one currently published version per document kind. */
    uniqueIndex("document_versions_one_published_per_kind_uidx")
      .on(table.kind)
      .where(sql`${table.state} = 'published'`),
    check(
      "document_versions_published_needs_timestamp",
      sql`(${table.state} <> 'published') OR (${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      "document_versions_superseded_needs_timestamp",
      sql`(${table.state} <> 'superseded') OR (${table.supersededAt} IS NOT NULL)`,
    ),
    check(
      "document_versions_counsel_reviewed_needs_provenance",
      sql`(${table.state} <> 'counsel_reviewed' AND ${table.state} <> 'published' AND ${table.state} <> 'superseded') OR (${table.counselReviewedAt} IS NOT NULL)`,
    ),
  ],
);

/** Immutable assent records — UPDATEs/DELETEs blocked by migration trigger. */
export const assentRecords = pgTable(
  "assent_records",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    documentVersionId: text("document_version_id").notNull(),
    contentHash: text("content_hash").notNull(),
    method: text("method").notNull(),
    assentedAt: timestamp("assented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    noticesAcknowledged: jsonb("notices_acknowledged")
      .$type<string[]>()
      .notNull()
      .default([]),
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assent_records_account_idx").on(table.accountId),
    uniqueIndex("assent_records_id_account_doc_hash_uidx").on(
      table.id,
      table.accountId,
      table.documentVersionId,
      table.contentHash,
    ),
    foreignKey({
      name: "assent_records_document_hash_fk",
      columns: [table.documentVersionId, table.contentHash],
      foreignColumns: [documentVersions.id, documentVersions.contentHash],
    }).onDelete("restrict"),
  ],
);

export const assentOutcomeEnum = pgEnum("assent_outcome", [
  "declined",
  "withdrawn",
]);

/**
 * Non-assent outcomes (decline / withdraw). Prior assent rows stay immutable;
 * withdrawal never deletes retained assent history.
 */
export const assentOutcomes = pgTable(
  "assent_outcomes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    documentVersionId: text("document_version_id").notNull(),
    contentHash: text("content_hash").notNull(),
    outcome: assentOutcomeEnum("outcome").notNull(),
    priorAssentId: text("prior_assent_id").references(() => assentRecords.id, {
      onDelete: "restrict",
    }),
    reason: text("reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assent_outcomes_account_idx").on(table.accountId),
    foreignKey({
      name: "assent_outcomes_document_hash_fk",
      columns: [table.documentVersionId, table.contentHash],
      foreignColumns: [documentVersions.id, documentVersions.contentHash],
    }).onDelete("restrict"),
    foreignKey({
      name: "assent_outcomes_prior_assent_match_fk",
      columns: [
        table.priorAssentId,
        table.accountId,
        table.documentVersionId,
        table.contentHash,
      ],
      foreignColumns: [
        assentRecords.id,
        assentRecords.accountId,
        assentRecords.documentVersionId,
        assentRecords.contentHash,
      ],
    }).onDelete("restrict"),
    uniqueIndex("assent_outcomes_one_withdrawn_per_assent_uidx")
      .on(table.priorAssentId)
      .where(sql`${table.outcome} = 'withdrawn' AND ${table.priorAssentId} IS NOT NULL`),
    check(
      "assent_outcomes_withdrawn_needs_prior_assent",
      sql`(${table.outcome} <> 'withdrawn') OR (${table.priorAssentId} IS NOT NULL)`,
    ),
    check(
      "assent_outcomes_declined_has_no_prior_assent",
      sql`(${table.outcome} <> 'declined') OR (${table.priorAssentId} IS NULL)`,
    ),
  ],
);

/**
 * Server-issued presentation of a full published document before assent/decline.
 * Assent recording requires an unconsumed, unexpired presentation row.
 */
export const assentPresentations = pgTable(
  "assent_presentations",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    documentVersionId: text("document_version_id").notNull(),
    contentHash: text("content_hash").notNull(),
    presentedAt: timestamp("presented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("assent_presentations_account_idx").on(table.accountId),
    foreignKey({
      name: "assent_presentations_document_hash_fk",
      columns: [table.documentVersionId, table.contentHash],
      foreignColumns: [documentVersions.id, documentVersions.contentHash],
    }).onDelete("restrict"),
  ],
);

export const verificationDecisionSourceEnum = pgEnum(
  "verification_decision_source",
  ["account_reviewer", "operator_bootstrap"],
);

export const verificationCases = pgTable(
  "verification_cases",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: verificationKindEnum("kind").notNull(),
    status: verificationCaseStatusEnum("status").notNull().default("pending"),
    reviewerAccountId: text("reviewer_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    /** Structurally distinguishes ordinary review from one-time operator bootstrap. */
    decisionSource: verificationDecisionSourceEnum("decision_source")
      .notNull()
      .default("account_reviewer"),
    /** Non-secret operator label when decision_source = operator_bootstrap. */
    operatorLabel: text("operator_label"),
    decisionReason: text("decision_reason"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    synthetic: boolean("synthetic").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_cases_id_kind_uidx").on(table.id, table.kind),
    uniqueIndex("verification_cases_one_open_per_account_kind_uidx")
      .on(table.accountId, table.kind)
      .where(
        sql`${table.status} IN ('pending', 'approved', 'appealed')`,
      ),
    check(
      "verification_cases_no_self_review",
      sql`${table.reviewerAccountId} IS NULL OR ${table.reviewerAccountId} <> ${table.accountId}`,
    ),
    check(
      "verification_cases_terminal_needs_reason",
      sql`(${table.status} IN ('pending', 'appealed')) OR (${table.decisionReason} IS NOT NULL AND length(btrim(${table.decisionReason})) > 0)`,
    ),
    check(
      "verification_cases_decided_needs_timestamp",
      sql`(${table.status} IN ('pending', 'appealed')) OR (${table.decidedAt} IS NOT NULL)`,
    ),
    check(
      "verification_cases_operator_bootstrap_provenance",
      sql`(
        (${table.decisionSource} <> 'operator_bootstrap')
        OR (
          ${table.reviewerAccountId} IS NULL
          AND ${table.operatorLabel} IS NOT NULL
          AND char_length(btrim(${table.operatorLabel})) > 0
        )
      )`,
    ),
  ],
);

export const verificationAssertions = pgTable(
  "verification_assertions",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    kind: verificationKindEnum("kind").notNull(),
    assertionSummary: text("assertion_summary").notNull(),
    /**
     * Approved scheme only: `ostt:vhold:<holdId>` or tombstone `ostt:purged:<holdId>`.
     * Never URLs, JWTs, or raw payloads.
     */
    evidencePointer: text("evidence_pointer"),
    assertedAt: timestamp("asserted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verification_assertions_case_kind_uidx").on(
      table.caseId,
      table.kind,
    ),
    foreignKey({
      name: "verification_assertions_case_kind_fk",
      columns: [table.caseId, table.kind],
      foreignColumns: [verificationCases.id, verificationCases.kind],
    }).onDelete("cascade"),
  ],
);

/**
 * Short-lived retention metadata. Payloads live in verification_artifact_payloads
 * and are deleted on purge; assertions are tombstoned.
 */
export const verificationArtifactHolds = pgTable(
  "verification_artifact_holds",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => verificationCases.id, { onDelete: "cascade" }),
    assertionId: text("assertion_id").references(() => verificationAssertions.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(),
    retentionPolicy: text("retention_policy").notNull().default("ttl-24h"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("verification_artifact_holds_case_idx").on(table.caseId),
    index("verification_artifact_holds_expires_idx").on(table.expiresAt),
    check(
      "verification_artifact_holds_purpose_nonempty",
      sql`length(btrim(${table.purpose})) > 0`,
    ),
    check(
      "verification_artifact_holds_retention_nonempty",
      sql`length(btrim(${table.retentionPolicy})) > 0`,
    ),
  ],
);

/** Sensitive artifact body — cleared on purge (not retained indefinitely). */
export const verificationArtifactPayloads = pgTable(
  "verification_artifact_payloads",
  {
    holdId: text("hold_id")
      .primaryKey()
      .references(() => verificationArtifactHolds.id, { onDelete: "cascade" }),
    payload: text("payload"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** Immutable audit events — UPDATEs/DELETEs blocked by migration trigger. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorRole: text("actor_role").notNull(),
    actorAccountId: text("actor_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
    requestCorrelationId: text("request_correlation_id"),
    reason: text("reason"),
    privatePayload: jsonb("private_payload").$type<Record<string, unknown>>(),
    /** Hash chain for continuity / tamper-detection (not absolute tamper-proof). */
    continuityPrevHash: text("continuity_prev_hash"),
    continuityHash: text("continuity_hash"),
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_at_idx").on(table.at),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_actor_idx").on(table.actorAccountId),
  ],
);

/** Singleton row locking the audit continuity head (serialize appends). */
export const auditLedgerHead = pgTable("audit_ledger_head", {
  id: text("id").primaryKey(),
  headEventId: text("head_event_id"),
  headHash: text("head_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const conversationPseudonymPurposeEnum = pgEnum(
  "conversation_pseudonym_purpose",
  ["closed_test_consultation"],
);

export const closedTestConversationStatusEnum = pgEnum(
  "closed_test_conversation_status",
  ["open", "closed", "archived"],
);

/**
 * Server-maintained allowlist of closed/synthetic test conversations (WP 2.10/2.11).
 * Issuance requires an open registry row — prefix matching alone is insufficient.
 */
export const closedTestConversations = pgTable(
  "closed_test_conversations",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    purpose: conversationPseudonymPurposeEnum("purpose").notNull(),
    status: closedTestConversationStatusEnum("status").notNull().default("open"),
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("closed_test_conversations_synthetic_only", sql`${table.synthetic} = true`),
  ],
);

/**
 * Security-restricted account↔conversation pseudonym map (WP 2.10).
 * Never join into public consultation projections; no reverse public APIs.
 */
export const conversationPseudonyms = pgTable(
  "conversation_pseudonyms",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => closedTestConversations.id, { onDelete: "restrict" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Opaque random token — never derived from email/account id. */
    pseudonym: text("pseudonym").notNull(),
    purpose: conversationPseudonymPurposeEnum("purpose").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    supersededById: text("superseded_by_id"),
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversation_pseudonyms_pseudonym_uidx").on(table.pseudonym),
    uniqueIndex("conversation_pseudonyms_active_pair_uidx")
      .on(table.conversationId, table.accountId)
      .where(sql`${table.deletedAt} IS NULL AND ${table.rotatedAt} IS NULL`),
    index("conversation_pseudonyms_account_idx").on(table.accountId),
    index("conversation_pseudonyms_conversation_idx").on(table.conversationId),
    foreignKey({
      columns: [table.supersededById],
      foreignColumns: [table.id],
      name: "conversation_pseudonyms_superseded_by_id_fk",
    }),
    check(
      "conversation_pseudonyms_expires_after_issued",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    check(
      "conversation_pseudonyms_rotation_pair",
      sql`(
        (${table.rotatedAt} IS NULL AND ${table.supersededById} IS NULL)
        OR (${table.rotatedAt} IS NOT NULL AND ${table.supersededById} IS NOT NULL)
      )`,
    ),
    check(
      "conversation_pseudonyms_not_rotated_and_deleted",
      sql`NOT (${table.rotatedAt} IS NOT NULL AND ${table.deletedAt} IS NOT NULL)`,
    ),
  ],
);

export const deletionRequestStatusEnum = pgEnum("deletion_request_status", [
  "pending",
  "approved_pending_hold",
  "closed",
  "cancelled",
  "blocked_by_hold",
]);

export const dualControlStatusEnum = pgEnum("dual_control_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
]);

/** Provisional retention knobs — not counsel-approved legal retention schedules. */
export const retentionPolicySettings = pgTable("retention_policy_settings", {
  key: text("key").primaryKey(),
  valueJson: jsonb("value_json").$type<unknown>().notNull(),
  provisional: boolean("provisional").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByLabel: text("updated_by_label").notNull(),
});

export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    status: deletionRequestStatusEnum("status").notNull().default("pending"),
    reason: text("reason").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    synthetic: boolean("synthetic").notNull().default(true),
  },
  (table) => [
    uniqueIndex("account_deletion_requests_one_open_uidx")
      .on(table.accountId)
      .where(
        sql`${table.status} IN ('pending', 'approved_pending_hold', 'blocked_by_hold')`,
      ),
    check(
      "account_deletion_requests_reason_nonempty",
      sql`length(btrim(${table.reason})) > 0`,
    ),
  ],
);

/** Staff-restricted legal holds — never projected to public feeds. */
export const legalHolds = pgTable(
  "legal_holds",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    reason: text("reason").notNull(),
    placedByAccountId: text("placed_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByAccountId: text("released_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    synthetic: boolean("synthetic").notNull().default(true),
  },
  (table) => [
    uniqueIndex("legal_holds_active_subject_uidx")
      .on(table.subjectType, table.subjectId)
      .where(sql`${table.releasedAt} IS NULL`),
    check(
      "legal_holds_reason_nonempty",
      sql`length(btrim(${table.reason})) > 0`,
    ),
  ],
);

/** Two-administrator approval for selected high-impact operations. */
export const dualControlRequests = pgTable(
  "dual_control_requests",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: dualControlStatusEnum("status").notNull().default("pending"),
    requestedByAccountId: text("requested_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    approvedByAccountId: text("approved_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    synthetic: boolean("synthetic").notNull().default(true),
  },
  (table) => [
    check(
      "dual_control_requests_reason_nonempty",
      sql`length(btrim(${table.reason})) > 0`,
    ),
    check(
      "dual_control_requests_distinct_actors",
      sql`${table.approvedByAccountId} IS NULL OR ${table.approvedByAccountId} <> ${table.requestedByAccountId}`,
    ),
  ],
);

export const authChallengePurposeEnum = pgEnum("auth_challenge_purpose", [
  "contact_verification",
  "sign_in",
  "recovery",
]);

/**
 * Server-side session rows for Auth.js JWT validation and revoke-all.
 * Raw session secrets are never stored — only hashes.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_uidx").on(table.sessionTokenHash),
    index("auth_sessions_account_idx").on(table.accountId),
  ],
);

/** Single-use hashed challenges for contact verification, sign-in, and recovery. */
export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    contactChannel: text("contact_channel").notNull(),
    purpose: authChallengePurposeEnum("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_challenges_token_hash_uidx").on(table.tokenHash),
    index("auth_challenges_contact_idx").on(table.contactChannel),
  ],
);

/** Schema migration journal helper for health checks (optional row). */
export const schemaMeta = pgTable("schema_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Phase 3 — durable topic / claim / evidence model (WP 3.2)                  */
/* Workflow and publication are independent. No Pol.is provider columns.      */
/* -------------------------------------------------------------------------- */

export const topicWorkflowStateEnum = pgEnum("topic_workflow_state", [
  "draft",
  "open_for_submissions",
  "under_review",
  "paused",
  "archived",
]);

export const topicPublicationStatusEnum = pgEnum("topic_publication_status", [
  "unpublished",
  "published",
]);

/** Topic content geography — not eligibility, residency, or voting. */
export const topicJurisdictionLevelEnum = pgEnum("topic_jurisdiction_level", [
  "statewide",
  "county",
]);

export const submissionWorkflowStateEnum = pgEnum("submission_workflow_state", [
  "draft",
  "submitted",
  "changes_requested",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const evidenceQualityStatusEnum = pgEnum("evidence_quality_status", [
  "pending",
  "accepted",
  "limited",
  "disputed",
  "rejected",
]);

/** Stored visibility only — restore is an action back to visible (ADR 0009). */
export const moderationVisibilityEnum = pgEnum("moderation_visibility", [
  "visible",
  "held",
  "hidden",
]);

/** Append-only moderation action kinds (Package 3.8). Restore is never a stored visibility. */
export const moderationActionEnum = pgEnum("moderation_action", [
  "hold",
  "hide",
  "restore",
]);

export const claimEvidenceRelationshipEnum = pgEnum(
  "claim_evidence_relationship",
  ["supporting", "counterevidence"],
);

export const evidenceAuthorTypeEnum = pgEnum("evidence_author_type", [
  "agency",
  "researcher",
  "journalist",
  "civil_society",
  "industry",
  "other",
]);

export const evidenceSourceTypeEnum = pgEnum("evidence_source_type", [
  "report",
  "dataset",
  "peer_reviewed",
  "news",
  "memo",
  "other",
]);

export const claimReviewDecisionEnum = pgEnum("claim_review_decision", [
  "changes_requested",
  "accepted",
  "rejected",
]);

export const evidenceReviewDecisionEnum = pgEnum("evidence_review_decision", [
  "changes_requested",
  "accepted",
  "rejected",
  "quality_decided",
]);

export const topics = pgTable(
  "topics",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    question: text("question").notNull(),
    background: text("background").notNull(),
    scope: text("scope").notNull(),
    workflowState: topicWorkflowStateEnum("workflow_state")
      .notNull()
      .default("draft"),
    publicationStatus: topicPublicationStatusEnum("publication_status")
      .notNull()
      .default("unpublished"),
    /**
     * Content/jurisdiction taxonomy for the Tennessee release.
     * Not an eligibility, residency, representation, or voting rule.
     */
    jurisdictionLevel: topicJurisdictionLevelEnum("jurisdiction_level")
      .notNull()
      .default("statewide"),
    stateCode: text("state_code").notNull().default("TN"),
    countyFips: text("county_fips"),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByAccountId: text("published_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    /** Explicit value required for real rows — default false (not true). */
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("topics_slug_uidx").on(table.slug),
    uniqueIndex("topics_id_uidx").on(table.id),
    index("topics_workflow_idx").on(table.workflowState),
    index("topics_publication_idx").on(table.publicationStatus),
    index("topics_jurisdiction_idx").on(table.jurisdictionLevel),
    index("topics_county_fips_idx").on(table.countyFips),
    index("topics_created_by_idx").on(table.createdByAccountId),
    check(
      "topics_title_nonblank",
      sql`char_length(btrim(${table.title})) > 0`,
    ),
    check(
      "topics_slug_nonblank",
      sql`char_length(btrim(${table.slug})) > 0`,
    ),
    check(
      "topics_question_nonblank",
      sql`char_length(btrim(${table.question})) > 0`,
    ),
    check(
      "topics_background_nonblank",
      sql`char_length(btrim(${table.background})) > 0`,
    ),
    check(
      "topics_scope_nonblank",
      sql`char_length(btrim(${table.scope})) > 0`,
    ),
    check("topics_state_code_tn_only", sql`${table.stateCode} = 'TN'`),
    check(
      "topics_geography_county_requires_fips",
      sql`(
        (${table.jurisdictionLevel} = 'statewide' AND ${table.countyFips} IS NULL)
        OR (
          ${table.jurisdictionLevel} = 'county'
          AND ${table.countyFips} IS NOT NULL
          AND ${table.countyFips} ~ '^47[0-9]{3}$'
        )
      )`,
    ),
    check(
      "topics_published_requires_provenance",
      sql`(${table.publicationStatus} <> 'published') OR (${table.publishedAt} IS NOT NULL AND ${table.publishedByAccountId} IS NOT NULL)`,
    ),
    check(
      "topics_unpublished_clears_publication_stamp",
      sql`(${table.publicationStatus} <> 'unpublished') OR (${table.publishedAt} IS NULL AND ${table.publishedByAccountId} IS NULL)`,
    ),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    authorAccountId: text("author_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    approachLabel: text("approach_label").notNull(),
    workflowState: submissionWorkflowStateEnum("workflow_state")
      .notNull()
      .default("draft"),
    moderationVisibility: moderationVisibilityEnum("moderation_visibility")
      .notNull()
      .default("visible"),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("claims_id_topic_uidx").on(table.id, table.topicId),
    index("claims_topic_idx").on(table.topicId),
    index("claims_workflow_idx").on(table.workflowState),
    index("claims_visibility_idx").on(table.moderationVisibility),
    index("claims_author_idx").on(table.authorAccountId),
    check("claims_title_nonblank", sql`char_length(btrim(${table.title})) > 0`),
    check(
      "claims_summary_nonblank",
      sql`char_length(btrim(${table.summary})) > 0`,
    ),
    check(
      "claims_approach_label_nonblank",
      sql`char_length(btrim(${table.approachLabel})) > 0`,
    ),
  ],
);

/**
 * Single alpha source-submission model: URL + submitter metadata only.
 * No remote fetch/scrape/preview columns.
 */
export const evidenceSubmissions = pgTable(
  "evidence_submissions",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    submitterAccountId: text("submitter_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    authorType: evidenceAuthorTypeEnum("author_type").notNull(),
    sourceType: evidenceSourceTypeEnum("source_type").notNull(),
    limitations: text("limitations").notNull(),
    workflowState: submissionWorkflowStateEnum("workflow_state")
      .notNull()
      .default("draft"),
    qualityStatus: evidenceQualityStatusEnum("quality_status")
      .notNull()
      .default("pending"),
    moderationVisibility: moderationVisibilityEnum("moderation_visibility")
      .notNull()
      .default("visible"),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("evidence_submissions_id_topic_uidx").on(table.id, table.topicId),
    index("evidence_submissions_topic_idx").on(table.topicId),
    index("evidence_submissions_workflow_idx").on(table.workflowState),
    index("evidence_submissions_quality_idx").on(table.qualityStatus),
    index("evidence_submissions_visibility_idx").on(table.moderationVisibility),
    index("evidence_submissions_submitter_idx").on(table.submitterAccountId),
    check(
      "evidence_submissions_title_nonblank",
      sql`char_length(btrim(${table.title})) > 0`,
    ),
    check(
      "evidence_submissions_url_nonblank",
      sql`char_length(btrim(${table.sourceUrl})) > 0`,
    ),
    check(
      "evidence_submissions_organization_nonblank",
      sql`char_length(btrim(${table.organization})) > 0`,
    ),
    check(
      "evidence_submissions_limitations_nonblank",
      sql`char_length(btrim(${table.limitations})) > 0`,
    ),
  ],
);

export const claimEvidenceLinks = pgTable(
  "claim_evidence_links",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    claimId: text("claim_id").notNull(),
    evidenceSubmissionId: text("evidence_submission_id").notNull(),
    relationship: claimEvidenceRelationshipEnum("relationship").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("claim_evidence_links_pair_uidx").on(
      table.claimId,
      table.evidenceSubmissionId,
    ),
    index("claim_evidence_links_topic_idx").on(table.topicId),
    index("claim_evidence_links_claim_idx").on(table.claimId),
    index("claim_evidence_links_evidence_idx").on(table.evidenceSubmissionId),
    foreignKey({
      name: "claim_evidence_links_claim_topic_fk",
      columns: [table.claimId, table.topicId],
      foreignColumns: [claims.id, claims.topicId],
    }).onDelete("restrict"),
    foreignKey({
      name: "claim_evidence_links_evidence_topic_fk",
      columns: [table.evidenceSubmissionId, table.topicId],
      foreignColumns: [evidenceSubmissions.id, evidenceSubmissions.topicId],
    }).onDelete("restrict"),
  ],
);

/**
 * Enforceable subject attachment: exactly one of claim_id / evidence_submission_id.
 * Avoids unenforced polymorphic subject_type/subject_id.
 */
export const conflictDisclosures = pgTable(
  "conflict_disclosures",
  {
    id: text("id").primaryKey(),
    disclosingAccountId: text("disclosing_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    claimId: text("claim_id").references(() => claims.id, {
      onDelete: "restrict",
    }),
    evidenceSubmissionId: text("evidence_submission_id").references(
      () => evidenceSubmissions.id,
      { onDelete: "restrict" },
    ),
    publicSummary: text("public_summary").notNull(),
    privateDetail: text("private_detail"),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("conflict_disclosures_account_idx").on(table.disclosingAccountId),
    index("conflict_disclosures_claim_idx").on(table.claimId),
    index("conflict_disclosures_evidence_idx").on(table.evidenceSubmissionId),
    uniqueIndex("conflict_disclosures_claim_uidx")
      .on(table.claimId)
      .where(sql`${table.claimId} IS NOT NULL`),
    uniqueIndex("conflict_disclosures_evidence_uidx")
      .on(table.evidenceSubmissionId)
      .where(sql`${table.evidenceSubmissionId} IS NOT NULL`),
    check(
      "conflict_disclosures_public_summary_nonblank",
      sql`char_length(btrim(${table.publicSummary})) > 0`,
    ),
    check(
      "conflict_disclosures_exactly_one_subject",
      sql`(
        (${table.claimId} IS NOT NULL AND ${table.evidenceSubmissionId} IS NULL)
        OR (${table.claimId} IS NULL AND ${table.evidenceSubmissionId} IS NOT NULL)
      )`,
    ),
  ],
);

/**
 * Append-only institutional moderation history (Package 3.8).
 * Exactly one of claim_id / evidence_submission_id; immutable via migration trigger.
 * Current visibility remains on the claim/evidence row — never a stored `restored` state.
 */
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    claimId: text("claim_id"),
    evidenceSubmissionId: text("evidence_submission_id"),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    action: moderationActionEnum("action").notNull(),
    fromVisibility: moderationVisibilityEnum("from_visibility").notNull(),
    toVisibility: moderationVisibilityEnum("to_visibility").notNull(),
    publicRationale: text("public_rationale").notNull(),
    privateNotes: text("private_notes"),
    synthetic: boolean("synthetic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moderation_actions_claim_created_idx")
      .on(table.claimId, table.createdAt)
      .where(sql`${table.claimId} IS NOT NULL`),
    index("moderation_actions_evidence_created_idx")
      .on(table.evidenceSubmissionId, table.createdAt)
      .where(sql`${table.evidenceSubmissionId} IS NOT NULL`),
    index("moderation_actions_topic_created_idx").on(
      table.topicId,
      table.createdAt,
    ),
    foreignKey({
      name: "moderation_actions_claim_topic_fk",
      columns: [table.claimId, table.topicId],
      foreignColumns: [claims.id, claims.topicId],
    }).onDelete("restrict"),
    foreignKey({
      name: "moderation_actions_evidence_topic_fk",
      columns: [table.evidenceSubmissionId, table.topicId],
      foreignColumns: [evidenceSubmissions.id, evidenceSubmissions.topicId],
    }).onDelete("restrict"),
    check(
      "moderation_actions_public_rationale_nonblank",
      sql`char_length(btrim(${table.publicRationale})) > 0`,
    ),
    check(
      "moderation_actions_exactly_one_subject",
      sql`(
        (${table.claimId} IS NOT NULL AND ${table.evidenceSubmissionId} IS NULL)
        OR (${table.claimId} IS NULL AND ${table.evidenceSubmissionId} IS NOT NULL)
      )`,
    ),
    check(
      "moderation_actions_hold_transition",
      sql`(
        (${table.action} <> 'hold')
        OR (
          ${table.fromVisibility} = 'visible'
          AND ${table.toVisibility} = 'held'
        )
      )`,
    ),
    check(
      "moderation_actions_hide_transition",
      sql`(
        (${table.action} <> 'hide')
        OR (
          ${table.fromVisibility} IN ('visible', 'held')
          AND ${table.toVisibility} = 'hidden'
        )
      )`,
    ),
    check(
      "moderation_actions_restore_transition",
      sql`(
        (${table.action} <> 'restore')
        OR (
          ${table.fromVisibility} IN ('held', 'hidden')
          AND ${table.toVisibility} = 'visible'
        )
      )`,
    ),
  ],
);

/** Append-only claim workflow review provenance (immutable via migration trigger). */
export const claimReviews = pgTable(
  "claim_reviews",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "restrict" }),
    reviewerAccountId: text("reviewer_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    decision: claimReviewDecisionEnum("decision").notNull(),
    publicRationale: text("public_rationale").notNull(),
    privateNotes: text("private_notes"),
    synthetic: boolean("synthetic").notNull().default(false),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("claim_reviews_claim_idx").on(table.claimId),
    index("claim_reviews_reviewer_idx").on(table.reviewerAccountId),
    index("claim_reviews_decided_at_idx").on(table.decidedAt),
    check(
      "claim_reviews_public_rationale_nonblank",
      sql`char_length(btrim(${table.publicRationale})) > 0`,
    ),
  ],
);

/**
 * Append-only content revision history (Package 3.7).
 * Exactly one of claim_id / evidence_submission_id; snapshots are content-only.
 * Immutable via migration trigger — withdraw/reject/hide never delete rows.
 */
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    claimId: text("claim_id"),
    evidenceSubmissionId: text("evidence_submission_id"),
    revisionNumber: integer("revision_number").notNull(),
    editorAccountId: text("editor_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    changedFields: text("changed_fields").array().notNull(),
    beforeSnapshot: jsonb("before_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    afterSnapshot: jsonb("after_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    synthetic: boolean("synthetic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("content_revisions_claim_revision_uidx")
      .on(table.claimId, table.revisionNumber)
      .where(sql`${table.claimId} IS NOT NULL`),
    uniqueIndex("content_revisions_evidence_revision_uidx")
      .on(table.evidenceSubmissionId, table.revisionNumber)
      .where(sql`${table.evidenceSubmissionId} IS NOT NULL`),
    index("content_revisions_claim_created_idx")
      .on(table.claimId, table.createdAt)
      .where(sql`${table.claimId} IS NOT NULL`),
    index("content_revisions_evidence_created_idx")
      .on(table.evidenceSubmissionId, table.createdAt)
      .where(sql`${table.evidenceSubmissionId} IS NOT NULL`),
    index("content_revisions_topic_created_idx").on(
      table.topicId,
      table.createdAt,
    ),
    foreignKey({
      name: "content_revisions_claim_topic_fk",
      columns: [table.claimId, table.topicId],
      foreignColumns: [claims.id, claims.topicId],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_revisions_evidence_topic_fk",
      columns: [table.evidenceSubmissionId, table.topicId],
      foreignColumns: [evidenceSubmissions.id, evidenceSubmissions.topicId],
    }).onDelete("restrict"),
    check(
      "content_revisions_revision_number_positive",
      sql`${table.revisionNumber} > 0`,
    ),
    check(
      "content_revisions_changed_fields_nonempty",
      sql`cardinality(${table.changedFields}) > 0`,
    ),
    check(
      "content_revisions_exactly_one_subject",
      sql`(
        (${table.claimId} IS NOT NULL AND ${table.evidenceSubmissionId} IS NULL)
        OR (${table.claimId} IS NULL AND ${table.evidenceSubmissionId} IS NOT NULL)
      )`,
    ),
  ],
);

/**
 * Append-only evidence workflow + quality review provenance
 * (immutable via migration trigger). Quality decisions never rewrite
 * popularity/consensus fields (none exist on these tables).
 */
export const evidenceReviews = pgTable(
  "evidence_reviews",
  {
    id: text("id").primaryKey(),
    evidenceSubmissionId: text("evidence_submission_id")
      .notNull()
      .references(() => evidenceSubmissions.id, { onDelete: "restrict" }),
    reviewerAccountId: text("reviewer_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    decision: evidenceReviewDecisionEnum("decision").notNull(),
    /** Present when decision records or revises quality_status. */
    qualityStatus: evidenceQualityStatusEnum("quality_status"),
    /** Present when decision records a workflow outcome. */
    workflowDecision: submissionWorkflowStateEnum("workflow_decision"),
    publicRationale: text("public_rationale").notNull(),
    privateNotes: text("private_notes"),
    synthetic: boolean("synthetic").notNull().default(false),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("evidence_reviews_evidence_idx").on(table.evidenceSubmissionId),
    index("evidence_reviews_reviewer_idx").on(table.reviewerAccountId),
    index("evidence_reviews_decided_at_idx").on(table.decidedAt),
    check(
      "evidence_reviews_public_rationale_nonblank",
      sql`char_length(btrim(${table.publicRationale})) > 0`,
    ),
    check(
      "evidence_reviews_quality_decided_needs_status",
      sql`(${table.decision} <> 'quality_decided') OR (${table.qualityStatus} IS NOT NULL)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Phase 4.3 — Public Input conversation lifecycle (domain/schema only).       */
/* Live Pol.is stays fail-closed: provider_kind is DB-constrained to the two   */
/* operational values; hosted/self-hosted values exist only so a future,      */
/* explicitly-authorized package can migrate the CHECK — they are rejected    */
/* by both this constraint and the service layer today. providerConversationRef*/
/* is a protected opaque reference: never selected into public projections,   */
/* URLs, or logs (see src/lib/public-input/lifecycle/sanitize-log.ts).          */
/* -------------------------------------------------------------------------- */

export const publicInputWorkflowStateEnum = pgEnum("public_input_workflow_state", [
  "draft",
  "ready",
  "open",
  "commenting_closed",
  "voting_closed",
  "closed",
  "archived",
]);

export const publicInputProviderAvailabilityEnum = pgEnum(
  "public_input_provider_availability",
  ["not_configured", "available", "degraded", "unavailable"],
);

/**
 * `polis_hosted` / `polis_self_hosted` are declared for forward schema
 * compatibility only. A DB CHECK constraint (below) and the service layer
 * both reject them today — no permitted-services register addendum or
 * owner authorization exists for a live provider in Phase 4.3.
 */
export const publicInputProviderKindEnum = pgEnum("public_input_provider_kind", [
  "none",
  "fixture",
  "polis_hosted",
  "polis_self_hosted",
]);

export const publicInputConversationDesignationEnum = pgEnum(
  "public_input_conversation_designation",
  ["current", "historical"],
);

/**
 * One row per Public Input conversation lifecycle attempt for a topic.
 * `providerConversationRef` is a protected opaque reference — never joined
 * into public projections. `version` guards optimistic concurrency for both
 * workflow transitions and the independent provider-availability axis.
 */
export const publicInputConversations = pgTable(
  "public_input_conversations",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    providerKind: publicInputProviderKindEnum("provider_kind")
      .notNull()
      .default("none"),
    /** Protected opaque ref — never a raw provider URL; never public. */
    providerConversationRef: text("provider_conversation_ref"),
    workflowState: publicInputWorkflowStateEnum("workflow_state")
      .notNull()
      .default("draft"),
    providerAvailability: publicInputProviderAvailabilityEnum(
      "provider_availability",
    )
      .notNull()
      .default("not_configured"),
    publicTitle: text("public_title").notNull(),
    publicPrompt: text("public_prompt").notNull(),
    configurationVersion: integer("configuration_version")
      .notNull()
      .default(1),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    lastTransitionByAccountId: text(
      "last_transition_by_account_id",
    ).references(() => accounts.id, { onDelete: "set null" }),
    designation: publicInputConversationDesignationEnum("designation")
      .notNull()
      .default("current"),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("public_input_conversations_topic_idx").on(table.topicId),
    index("public_input_conversations_workflow_idx").on(table.workflowState),
    index("public_input_conversations_availability_idx").on(
      table.providerAvailability,
    ),
    /** At most one *current* conversation per topic (historical rows are unlimited). */
    uniqueIndex("public_input_conversations_one_current_per_topic_uidx")
      .on(table.topicId)
      .where(sql`${table.designation} = 'current'`),
    check(
      "public_input_conversations_public_title_nonblank",
      sql`char_length(btrim(${table.publicTitle})) > 0`,
    ),
    check(
      "public_input_conversations_public_prompt_nonblank",
      sql`char_length(btrim(${table.publicPrompt})) > 0`,
    ),
    check(
      "public_input_conversations_configuration_version_positive",
      sql`${table.configurationVersion} > 0`,
    ),
    check(
      "public_input_conversations_version_positive",
      sql`${table.version} > 0`,
    ),
    check(
      "public_input_conversations_closes_after_opens",
      sql`(
        ${table.opensAt} IS NULL
        OR ${table.closesAt} IS NULL
        OR ${table.closesAt} > ${table.opensAt}
      )`,
    ),
    /**
     * Fail-closed defense in depth: only the two operational kinds may be
     * stored, regardless of application-layer bugs. Migrating this to allow
     * a live kind requires its own explicitly-authorized package.
     */
    check(
      "public_input_conversations_kind_operational_only",
      sql`${table.providerKind} IN ('none', 'fixture')`,
    ),
    check(
      "public_input_conversations_none_kind_has_no_ref",
      sql`(${table.providerKind} <> 'none') OR (${table.providerConversationRef} IS NULL)`,
    ),
  ],
);

/**
 * Append-only conversation lifecycle history (immutable via migration trigger).
 * `fromState` is null only for the initial creation transition into `draft`.
 * Recovery transitions (`isRecovery = true`) always carry a reason.
 */
export const publicInputConversationTransitions = pgTable(
  "public_input_conversation_transitions",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => publicInputConversations.id, { onDelete: "restrict" }),
    fromState: publicInputWorkflowStateEnum("from_state"),
    toState: publicInputWorkflowStateEnum("to_state").notNull(),
    reason: text("reason"),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    isRecovery: boolean("is_recovery").notNull().default(false),
    synthetic: boolean("synthetic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("public_input_conversation_transitions_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("public_input_conversation_transitions_actor_idx").on(
      table.actorAccountId,
    ),
    check(
      "public_input_conversation_transitions_recovery_requires_reason",
      sql`(NOT ${table.isRecovery}) OR (char_length(btrim(${table.reason})) > 0)`,
    ),
    check(
      "public_input_conversation_transitions_from_to_distinct",
      sql`${table.fromState} IS NULL OR ${table.fromState} <> ${table.toState}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Phase 4.4 — aggregate report ingestion + Public Input moderation
// (ADR 0018 aggregate-only import, ADR 0019 immutable versions/publication,
// ADR 0020 provider vs institutional moderation axes, ADR 0021 complementary
// small-cell suppression). Operational source kinds stay `fixture` |
// `manual_aggregate` only — `polis_hosted` / `polis_self_hosted` exist for
// forward schema compatibility and are rejected by a DB CHECK + the service
// layer (src/lib/public-input/reports/service.ts), matching the 4.3
// provider-kind pattern. No raw provider export / ZIP / CSV / object storage;
// no participant rows, vote matrices, `xid`, tokens, raw URLs, or secrets are
// ever persisted here.
// ---------------------------------------------------------------------------

export const publicInputReportSourceKindEnum = pgEnum(
  "public_input_report_source_kind",
  ["fixture", "manual_aggregate", "polis_hosted", "polis_self_hosted"],
);

export const publicInputReportWorkflowStateEnum = pgEnum(
  "public_input_report_workflow_state",
  ["imported", "validated", "under_review", "published", "rejected", "superseded"],
);

export const publicInputFindingKindEnum = pgEnum("public_input_finding_kind", [
  "cross_group_agreement",
  "meaningful_disagreement",
]);

export const publicInputFindingPublicationEnum = pgEnum(
  "public_input_finding_publication",
  ["included", "withheld", "superseded"],
);

export const publicInputProviderModerationStatusEnum = pgEnum(
  "public_input_provider_moderation_status",
  ["pending", "accepted", "rejected"],
);

/** Published-projection cell status for an opinion-group row (ADR 0021). */
export const publicInputReportGroupCellStatusEnum = pgEnum(
  "public_input_report_group_cell_status",
  ["reported", "suppressed", "omitted"],
);

/** Institutional finding-eligibility decision kind (ADR 0020). */
export const publicInputReportModerationActionEnum = pgEnum(
  "public_input_report_moderation_action",
  ["include", "withhold", "supersede_finding"],
);

/**
 * Documentation-only axis distinction (no dedicated DB column needs this
 * union): `provider_side_record` rows live in
 * `public_input_provider_moderation_records` (observational provenance);
 * `institutional_finding_decision` rows live in
 * `public_input_report_moderation_actions` (append-only reasoned decisions).
 * Never collapse these two axes (ADR 0020).
 */
export type PublicInputReportModerationAxis =
  | "provider_side_record"
  | "institutional_finding_decision";

/**
 * One row per validated aggregate-only import attempt (ADR 0018). Immutable
 * after insert (trigger below) — corrections require a new import version,
 * never an in-place edit. `canonicalHash` is the sha256 hex digest of the
 * canonicalized import payload (src/lib/public-input/reports/hash.ts) and
 * gives idempotent re-import within a conversation.
 */
export const publicInputReportImports = pgTable(
  "public_input_report_imports",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => publicInputConversations.id, { onDelete: "restrict" }),
    sourceKind: publicInputReportSourceKindEnum("source_kind").notNull(),
    schemaVersion: text("schema_version").notNull(),
    methodVersion: text("method_version").notNull(),
    providerExportVersionLabel: text("provider_export_version_label"),
    canonicalHash: text("canonical_hash").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    importedByAccountId: text("imported_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    participationCount: integer("participation_count").notNull(),
    commentCount: integer("comment_count").notNull(),
    voteCount: integer("vote_count").notNull(),
    participationSufficiency: text("participation_sufficiency").notNull(),
    representationLimitations: text("representation_limitations").notNull(),
    /** Bounded provider-side moderation summary counts only — never rejected statement text. */
    moderationReviewedCount: integer("moderation_reviewed_count")
      .notNull()
      .default(0),
    moderationAcceptedCount: integer("moderation_accepted_count")
      .notNull()
      .default(0),
    moderationRejectedCount: integer("moderation_rejected_count")
      .notNull()
      .default(0),
    moderationPolicyVersion: text("moderation_policy_version"),
    synthetic: boolean("synthetic").notNull().default(false),
  },
  (table) => [
    index("public_input_report_imports_conversation_idx").on(
      table.conversationId,
    ),
    uniqueIndex("public_input_report_imports_conversation_hash_uidx").on(
      table.conversationId,
      table.canonicalHash,
    ),
    check(
      "public_input_report_imports_source_kind_operational_only",
      sql`${table.sourceKind} IN ('fixture', 'manual_aggregate')`,
    ),
    check(
      "public_input_report_imports_canonical_hash_format",
      sql`${table.canonicalHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "public_input_report_imports_participation_nonnegative",
      sql`${table.participationCount} >= 0`,
    ),
    check(
      "public_input_report_imports_comment_nonnegative",
      sql`${table.commentCount} >= 0`,
    ),
    check(
      "public_input_report_imports_vote_nonnegative",
      sql`${table.voteCount} >= 0`,
    ),
    check(
      "public_input_report_imports_moderation_counts_nonnegative",
      sql`${table.moderationReviewedCount} >= 0 AND ${table.moderationAcceptedCount} >= 0 AND ${table.moderationRejectedCount} >= 0`,
    ),
    check(
      "public_input_report_imports_moderation_counts_consistent",
      sql`(${table.moderationAcceptedCount} + ${table.moderationRejectedCount}) <= ${table.moderationReviewedCount}`,
    ),
    check(
      "public_input_report_imports_sufficiency_nonblank",
      sql`char_length(btrim(${table.participationSufficiency})) > 0`,
    ),
    check(
      "public_input_report_imports_limitations_nonblank",
      sql`char_length(btrim(${table.representationLimitations})) > 0`,
    ),
  ],
);

/**
 * Immutable report version (ADR 0019). Content rows (this table + groups +
 * findings) are never updated after create — a correction is a new
 * (conversationId, version) row. `topicId` is denormalized from the owning
 * conversation for join safety and must equal
 * `public_input_conversations.topic_id` (enforced by the service layer at
 * create time — cross-table CHECKs are not expressible in SQL here).
 * `version` is the monotonic report-version number; `concurrencyVersion` is a
 * separate optimistic-concurrency token bumped on every workflow mutation of
 * this same row (review/publish/reject/supersede).
 */
export const publicInputReports = pgTable(
  "public_input_reports",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => publicInputConversations.id, { onDelete: "restrict" }),
    importId: text("import_id")
      .notNull()
      .references(() => publicInputReportImports.id, { onDelete: "restrict" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    concurrencyVersion: integer("concurrency_version").notNull().default(1),
    workflowState: publicInputReportWorkflowStateEnum("workflow_state")
      .notNull()
      .default("imported"),
    publicTitle: text("public_title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Set at publish time; never edited by moderators. */
    publisherAccountId: text("publisher_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    /** Denormalized from the owning import's `importedByAccountId` (same-actor provenance checks). */
    importerAccountId: text("importer_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    supersededByReportId: text("superseded_by_report_id"),
    isLatestPublished: boolean("is_latest_published").notNull().default(false),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.supersededByReportId],
      foreignColumns: [table.id],
      name: "public_input_reports_superseded_by_report_id_fk",
    }),
    index("public_input_reports_conversation_idx").on(table.conversationId),
    index("public_input_reports_workflow_idx").on(table.workflowState),
    index("public_input_reports_topic_idx").on(table.topicId),
    uniqueIndex("public_input_reports_conversation_version_uidx").on(
      table.conversationId,
      table.version,
    ),
    /** At most one currently-published report per conversation. */
    uniqueIndex("public_input_reports_one_latest_published_uidx")
      .on(table.conversationId)
      .where(sql`${table.isLatestPublished} = true`),
    check(
      "public_input_reports_version_positive",
      sql`${table.version} > 0`,
    ),
    check(
      "public_input_reports_concurrency_version_positive",
      sql`${table.concurrencyVersion} > 0`,
    ),
    check(
      "public_input_reports_public_title_nonblank",
      sql`char_length(btrim(${table.publicTitle})) > 0`,
    ),
    check(
      "public_input_reports_not_self_superseding",
      sql`${table.supersededByReportId} IS NULL OR ${table.supersededByReportId} <> ${table.id}`,
    ),
    check(
      "public_input_reports_latest_published_requires_published_state",
      sql`(NOT ${table.isLatestPublished}) OR (${table.workflowState} = 'published')`,
    ),
    check(
      "public_input_reports_published_requires_metadata",
      sql`(${table.workflowState} <> 'published') OR (${table.publishedAt} IS NOT NULL AND ${table.publisherAccountId} IS NOT NULL)`,
    ),
  ],
);

/**
 * Opinion-group rows for a report version. `rawShare` is the staff-only value
 * from the import; `publishedShare` is the value shown in the public
 * projection after complementary small-cell suppression is applied at
 * publish time (src/lib/public-input/reports/suppression.ts) — `null`
 * whenever `publishedStatus` is not `reported`. Suppressed values are never
 * coerced to `0`.
 */
export const publicInputReportGroups = pgTable(
  "public_input_report_groups",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => publicInputReports.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    rawShare: real("raw_share").notNull(),
    publishedStatus: publicInputReportGroupCellStatusEnum("published_status")
      .notNull()
      .default("reported"),
    publishedShare: real("published_share"),
    synthetic: boolean("synthetic").notNull().default(false),
  },
  (table) => [
    index("public_input_report_groups_report_idx").on(table.reportId),
    uniqueIndex("public_input_report_groups_report_label_uidx").on(
      table.reportId,
      table.label,
    ),
    uniqueIndex("public_input_report_groups_report_order_uidx").on(
      table.reportId,
      table.displayOrder,
    ),
    check(
      "public_input_report_groups_label_nonblank",
      sql`char_length(btrim(${table.label})) > 0`,
    ),
    check(
      "public_input_report_groups_raw_share_bounds",
      sql`${table.rawShare} >= 0 AND ${table.rawShare} <= 1`,
    ),
    check(
      "public_input_report_groups_published_share_bounds",
      sql`${table.publishedShare} IS NULL OR (${table.publishedShare} >= 0 AND ${table.publishedShare} <= 1)`,
    ),
    check(
      "public_input_report_groups_published_share_matches_status",
      sql`(${table.publishedStatus} = 'reported' AND ${table.publishedShare} IS NOT NULL) OR (${table.publishedStatus} <> 'reported' AND ${table.publishedShare} IS NULL)`,
    ),
  ],
);

/**
 * Cross-group agreement / meaningful disagreement finding rows for a report
 * version. `publicationStatus` is the current eligibility projection;
 * `public_input_report_moderation_actions` holds the append-only reasoned
 * history behind each change (ADR 0020).
 */
export const publicInputReportFindings = pgTable(
  "public_input_report_findings",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => publicInputReports.id, { onDelete: "restrict" }),
    kind: publicInputFindingKindEnum("kind").notNull(),
    statementText: text("statement_text").notNull(),
    publicationStatus: publicInputFindingPublicationEnum("publication_status")
      .notNull()
      .default("included"),
    displayOrder: integer("display_order").notNull().default(0),
    synthetic: boolean("synthetic").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("public_input_report_findings_report_kind_idx").on(
      table.reportId,
      table.kind,
    ),
    uniqueIndex("public_input_report_findings_report_kind_order_uidx").on(
      table.reportId,
      table.kind,
      table.displayOrder,
    ),
    check(
      "public_input_report_findings_statement_nonblank",
      sql`char_length(btrim(${table.statementText})) > 0`,
    ),
    check(
      "public_input_report_findings_statement_bounded",
      sql`char_length(${table.statementText}) <= 500`,
    ),
  ],
);

/**
 * Append-only institutional finding-eligibility decisions (ADR 0020).
 * Immutable via trigger below. `findingId` is nullable in the column
 * definition for forward compatibility, but every action kind implemented
 * today is finding-scoped (CHECK below requires it).
 */
export const publicInputReportModerationActions = pgTable(
  "public_input_report_moderation_actions",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => publicInputReports.id, { onDelete: "restrict" }),
    findingId: text("finding_id").references(
      () => publicInputReportFindings.id,
      { onDelete: "restrict" },
    ),
    action: publicInputReportModerationActionEnum("action").notNull(),
    /** Required for withhold/supersede_finding; optional for include. */
    publicRationale: text("public_rationale"),
    privateNote: text("private_note"),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    synthetic: boolean("synthetic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("public_input_report_moderation_actions_report_idx").on(
      table.reportId,
      table.createdAt,
    ),
    index("public_input_report_moderation_actions_finding_idx").on(
      table.findingId,
    ),
    check(
      "public_input_report_moderation_actions_finding_scoped",
      sql`${table.findingId} IS NOT NULL`,
    ),
    check(
      "public_input_report_moderation_actions_rationale_required",
      sql`(${table.action} = 'include') OR (char_length(btrim(${table.publicRationale})) > 0)`,
    ),
  ],
);

/**
 * Provider-side comment-moderation shadow (ADR 0020) — observational
 * provenance only, never a live remote execution. `opaqueStatementRef` is a
 * protected fingerprint (never the statement text itself, and never public).
 * Rejected statement text is never stored anywhere in this row.
 */
export const publicInputProviderModerationRecords = pgTable(
  "public_input_provider_moderation_records",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => publicInputConversations.id, { onDelete: "restrict" }),
    opaqueStatementRef: text("opaque_statement_ref").notNull(),
    status: publicInputProviderModerationStatusEnum("status")
      .notNull()
      .default("pending"),
    reasonCode: text("reason_code").notNull(),
    privateNote: text("private_note"),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    synthetic: boolean("synthetic").notNull().default(false),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("public_input_provider_moderation_records_conversation_idx").on(
      table.conversationId,
      table.status,
    ),
    uniqueIndex(
      "public_input_provider_moderation_records_conversation_ref_uidx",
    ).on(table.conversationId, table.opaqueStatementRef),
    check(
      "public_input_provider_moderation_records_ref_nonblank",
      sql`char_length(btrim(${table.opaqueStatementRef})) > 0`,
    ),
    check(
      "public_input_provider_moderation_records_ref_bounded",
      sql`char_length(${table.opaqueStatementRef}) <= 200`,
    ),
    check(
      "public_input_provider_moderation_records_reason_code_nonblank",
      sql`char_length(btrim(${table.reasonCode})) > 0`,
    ),
  ],
);

export const foundationTables = {
  persons,
  accounts,
  profiles,
  invitations,
  roleAssignments,
  councilAppointments,
  documentVersions,
  assentRecords,
  assentOutcomes,
  assentPresentations,
  verificationCases,
  verificationAssertions,
  verificationArtifactHolds,
  verificationArtifactPayloads,
  auditEvents,
  auditLedgerHead,
  closedTestConversations,
  conversationPseudonyms,
  retentionPolicySettings,
  accountDeletionRequests,
  legalHolds,
  dualControlRequests,
  authSessions,
  authChallenges,
  schemaMeta,
  operatorBootstrapState,
  topics,
  claims,
  evidenceSubmissions,
  claimEvidenceLinks,
  conflictDisclosures,
  moderationActions,
  contentRevisions,
  claimReviews,
  evidenceReviews,
  publicInputConversations,
  publicInputConversationTransitions,
  publicInputReportImports,
  publicInputReports,
  publicInputReportGroups,
  publicInputReportFindings,
  publicInputReportModerationActions,
  publicInputProviderModerationRecords,
};
