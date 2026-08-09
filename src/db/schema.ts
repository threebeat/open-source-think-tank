import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

/** Human identity distinct from platform account (synthetic-only in 2.3 seeds). */
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
      "accounts_active_requires_activation_timestamp",
      sql`(${table.lifecycleState} <> 'active') OR (${table.activatedAt} IS NOT NULL)`,
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
    check(
      "document_versions_published_needs_timestamp",
      sql`(${table.state} <> 'published') OR (${table.publishedAt} IS NOT NULL)`,
    ),
  ],
);

/** Immutable assent records — UPDATEs/DELETEs blocked by DB trigger. */
export const assentRecords = pgTable(
  "assent_records",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    documentVersionId: text("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "restrict" }),
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
    caseId: text("case_id")
      .notNull()
      .references(() => verificationCases.id, { onDelete: "cascade" }),
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
  ],
);

/** Immutable audit events — UPDATEs/DELETEs blocked by DB trigger. */
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
  schemaMeta,
};
