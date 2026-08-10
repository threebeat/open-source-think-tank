import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
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
    synthetic: boolean("synthetic").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedAccountId: text("accepted_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    issuedByLabel: text("issued_by_label").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invitations_token_hash_uidx").on(table.tokenHash),
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
    publishedAt: timestamp("published_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_versions_kind_label_uidx").on(
      table.kind,
      table.versionLabel,
    ),
    uniqueIndex("document_versions_id_hash_uidx").on(table.id, table.contentHash),
    check(
      "document_versions_published_needs_timestamp",
      sql`(${table.state} <> 'published') OR (${table.publishedAt} IS NOT NULL)`,
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
    foreignKey({
      name: "assent_records_document_hash_fk",
      columns: [table.documentVersionId, table.contentHash],
      foreignColumns: [documentVersions.id, documentVersions.contentHash],
    }).onDelete("restrict"),
  ],
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
    decisionReason: text("decision_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_cases_id_kind_uidx").on(table.id, table.kind),
    check(
      "verification_cases_no_self_review",
      sql`${table.reviewerAccountId} IS NULL OR ${table.reviewerAccountId} <> ${table.accountId}`,
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
    /** Status only — raw artifacts must not be stored in this table. */
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
    synthetic: boolean("synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_events_at_idx").on(table.at)],
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

export const foundationTables = {
  persons,
  accounts,
  profiles,
  invitations,
  roleAssignments,
  councilAppointments,
  documentVersions,
  assentRecords,
  verificationCases,
  verificationAssertions,
  auditEvents,
  authSessions,
  authChallenges,
  schemaMeta,
};
