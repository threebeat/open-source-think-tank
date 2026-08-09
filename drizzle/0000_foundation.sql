CREATE TYPE "public"."account_lifecycle_state" AS ENUM('invited', 'pending_onboarding', 'active', 'suspended', 'closed', 'anonymization-pending');--> statement-breakpoint
CREATE TYPE "public"."council_role" AS ENUM('deliberation_council', 'policy_council');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('conduct', 'participation', 'privacy_notice', 'other_legal');--> statement-breakpoint
CREATE TYPE "public"."document_state" AS ENUM('draft', 'counsel_reviewed', 'published', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('participant', 'reviewer', 'moderator', 'administrator', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."verification_case_status" AS ENUM('pending', 'approved', 'denied', 'expired', 'appealed');--> statement-breakpoint
CREATE TYPE "public"."verification_assertion_kind" AS ENUM('bot_resistance', 'contact_continuity', 'uniqueness', 'eligibility', 'residency', 'legal_identity');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"contact_channel" text NOT NULL,
	"lifecycle_state" "account_lifecycle_state" NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"contact_verified_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_active_requires_activation_timestamp" CHECK (("accounts"."lifecycle_state" <> 'active') OR ("accounts"."activated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "assent_records" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"document_version_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"method" text NOT NULL,
	"assented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notices_acknowledged" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_role" text NOT NULL,
	"actor_account_id" text,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" text NOT NULL,
	"request_correlation_id" text,
	"reason" text,
	"private_payload" jsonb,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"council_role" "council_role" NOT NULL,
	"selection_path" text NOT NULL,
	"term_starts_on" timestamp with time zone NOT NULL,
	"term_ends_on" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "document_kind" NOT NULL,
	"version_label" text NOT NULL,
	"content_hash" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"state" "document_state" NOT NULL,
	"published_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_published_needs_timestamp" CHECK (("document_versions"."state" <> 'published') OR ("document_versions"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"intended_contact_channel" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_account_id" text,
	"issued_by_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" text PRIMARY KEY NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"display_label" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"account_id" text PRIMARY KEY NOT NULL,
	"preferred_display_name" text NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by_label" text NOT NULL,
	"reason" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_assertions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"kind" "verification_assertion_kind" NOT NULL,
	"assertion_summary" text NOT NULL,
	"evidence_pointer" text,
	"asserted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"kind" "verification_assertion_kind" NOT NULL,
	"status" "verification_case_status" DEFAULT 'pending' NOT NULL,
	"reviewer_account_id" text,
	"decision_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_cases_no_self_review" CHECK ("verification_cases"."reviewer_account_id" IS NULL OR "verification_cases"."reviewer_account_id" <> "verification_cases"."account_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assent_records" ADD CONSTRAINT "assent_records_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assent_records" ADD CONSTRAINT "assent_records_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_appointments" ADD CONSTRAINT "council_appointments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_account_id_accounts_id_fk" FOREIGN KEY ("accepted_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_assertions" ADD CONSTRAINT "verification_assertions_case_id_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."verification_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_reviewer_account_id_accounts_id_fk" FOREIGN KEY ("reviewer_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_contact_channel_uidx" ON "accounts" USING btree ("contact_channel");--> statement-breakpoint
CREATE INDEX "assent_records_account_idx" ON "assent_records" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "audit_events_at_idx" ON "audit_events" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "council_appointments_active_uidx" ON "council_appointments" USING btree ("account_id","council_role") WHERE "council_appointments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_kind_label_uidx" ON "document_versions" USING btree ("kind","version_label");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_uidx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_active_uidx" ON "role_assignments" USING btree ("account_id","role") WHERE "role_assignments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_assertions_case_kind_uidx" ON "verification_assertions" USING btree ("case_id","kind");