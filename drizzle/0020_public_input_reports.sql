-- Package 4.4: aggregate-only report ingestion + Public Input moderation
-- (schema only). ADR 0018 aggregate-only import, ADR 0019 immutable report
-- versioning/publication, ADR 0020 provider vs institutional moderation
-- axes, ADR 0021 complementary small-cell suppression.
--
-- Rollback (manual, if ever needed before this migration is released):
--   DROP TABLE IF EXISTS "public_input_provider_moderation_records";
--   DROP TABLE IF EXISTS "public_input_report_moderation_actions";
--   DROP TABLE IF EXISTS "public_input_report_findings";
--   DROP TABLE IF EXISTS "public_input_report_groups";
--   DROP TABLE IF EXISTS "public_input_reports";
--   DROP TABLE IF EXISTS "public_input_report_imports";
--   DROP TYPE IF EXISTS "public"."public_input_report_moderation_action";
--   DROP TYPE IF EXISTS "public"."public_input_report_group_cell_status";
--   DROP TYPE IF EXISTS "public"."public_input_provider_moderation_status";
--   DROP TYPE IF EXISTS "public"."public_input_finding_publication";
--   DROP TYPE IF EXISTS "public"."public_input_finding_kind";
--   DROP TYPE IF EXISTS "public"."public_input_report_workflow_state";
--   DROP TYPE IF EXISTS "public"."public_input_report_source_kind";
--
-- Live Pol.is stays fail-closed: source_kind is DB-constrained to
-- ('fixture','manual_aggregate') only. polis_hosted / polis_self_hosted enum
-- labels exist for forward compatibility only and are rejected by a CHECK
-- constraint below and by the service layer
-- (src/lib/public-input/reports/service.ts). No provider network calls,
-- credentials, env vars, raw provider exports, ZIP/CSV storage, or object
-- storage are introduced here. No participant rows, vote matrices, `xid`,
-- tokens, raw URLs, or secrets are ever persisted in these tables.

CREATE TYPE "public"."public_input_report_source_kind" AS ENUM('fixture', 'manual_aggregate', 'polis_hosted', 'polis_self_hosted');
--> statement-breakpoint
CREATE TYPE "public"."public_input_report_workflow_state" AS ENUM('imported', 'validated', 'under_review', 'published', 'rejected', 'superseded');
--> statement-breakpoint
CREATE TYPE "public"."public_input_finding_kind" AS ENUM('cross_group_agreement', 'meaningful_disagreement');
--> statement-breakpoint
CREATE TYPE "public"."public_input_finding_publication" AS ENUM('included', 'withheld', 'superseded');
--> statement-breakpoint
CREATE TYPE "public"."public_input_provider_moderation_status" AS ENUM('pending', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."public_input_report_group_cell_status" AS ENUM('reported', 'suppressed', 'omitted');
--> statement-breakpoint
CREATE TYPE "public"."public_input_report_moderation_action" AS ENUM('include', 'withhold', 'supersede_finding');
--> statement-breakpoint
CREATE TABLE "public_input_report_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"source_kind" "public_input_report_source_kind" NOT NULL,
	"schema_version" text NOT NULL,
	"method_version" text NOT NULL,
	"provider_export_version_label" text,
	"canonical_hash" text NOT NULL,
	"generated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by_account_id" text NOT NULL,
	"participation_count" integer NOT NULL,
	"comment_count" integer NOT NULL,
	"vote_count" integer NOT NULL,
	"participation_sufficiency" text NOT NULL,
	"representation_limitations" text NOT NULL,
	"moderation_reviewed_count" integer DEFAULT 0 NOT NULL,
	"moderation_accepted_count" integer DEFAULT 0 NOT NULL,
	"moderation_rejected_count" integer DEFAULT 0 NOT NULL,
	"moderation_policy_version" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	CONSTRAINT "public_input_report_imports_source_kind_operational_only" CHECK ("public_input_report_imports"."source_kind" IN ('fixture', 'manual_aggregate')),
	CONSTRAINT "public_input_report_imports_canonical_hash_format" CHECK ("public_input_report_imports"."canonical_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_input_report_imports_participation_nonnegative" CHECK ("public_input_report_imports"."participation_count" >= 0),
	CONSTRAINT "public_input_report_imports_comment_nonnegative" CHECK ("public_input_report_imports"."comment_count" >= 0),
	CONSTRAINT "public_input_report_imports_vote_nonnegative" CHECK ("public_input_report_imports"."vote_count" >= 0),
	CONSTRAINT "public_input_report_imports_moderation_counts_nonnegative" CHECK ("public_input_report_imports"."moderation_reviewed_count" >= 0 AND "public_input_report_imports"."moderation_accepted_count" >= 0 AND "public_input_report_imports"."moderation_rejected_count" >= 0),
	CONSTRAINT "public_input_report_imports_moderation_counts_consistent" CHECK (("public_input_report_imports"."moderation_accepted_count" + "public_input_report_imports"."moderation_rejected_count") <= "public_input_report_imports"."moderation_reviewed_count"),
	CONSTRAINT "public_input_report_imports_sufficiency_nonblank" CHECK (char_length(btrim("public_input_report_imports"."participation_sufficiency")) > 0),
	CONSTRAINT "public_input_report_imports_limitations_nonblank" CHECK (char_length(btrim("public_input_report_imports"."representation_limitations")) > 0)
);
--> statement-breakpoint
CREATE TABLE "public_input_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"import_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"version" integer NOT NULL,
	"concurrency_version" integer DEFAULT 1 NOT NULL,
	"workflow_state" "public_input_report_workflow_state" DEFAULT 'imported' NOT NULL,
	"public_title" text NOT NULL,
	"published_at" timestamp with time zone,
	"publisher_account_id" text,
	"importer_account_id" text,
	"superseded_by_report_id" text,
	"is_latest_published" boolean DEFAULT false NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_reports_version_positive" CHECK ("public_input_reports"."version" > 0),
	CONSTRAINT "public_input_reports_concurrency_version_positive" CHECK ("public_input_reports"."concurrency_version" > 0),
	CONSTRAINT "public_input_reports_public_title_nonblank" CHECK (char_length(btrim("public_input_reports"."public_title")) > 0),
	CONSTRAINT "public_input_reports_not_self_superseding" CHECK ("public_input_reports"."superseded_by_report_id" IS NULL OR "public_input_reports"."superseded_by_report_id" <> "public_input_reports"."id"),
	CONSTRAINT "public_input_reports_latest_published_requires_published_state" CHECK ((NOT "public_input_reports"."is_latest_published") OR ("public_input_reports"."workflow_state" = 'published')),
	CONSTRAINT "public_input_reports_published_requires_metadata" CHECK (("public_input_reports"."workflow_state" <> 'published') OR ("public_input_reports"."published_at" IS NOT NULL AND "public_input_reports"."publisher_account_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "public_input_report_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"label" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"raw_share" real NOT NULL,
	"published_status" "public_input_report_group_cell_status" DEFAULT 'reported' NOT NULL,
	"published_share" real,
	"synthetic" boolean DEFAULT false NOT NULL,
	CONSTRAINT "public_input_report_groups_label_nonblank" CHECK (char_length(btrim("public_input_report_groups"."label")) > 0),
	CONSTRAINT "public_input_report_groups_raw_share_bounds" CHECK ("public_input_report_groups"."raw_share" >= 0 AND "public_input_report_groups"."raw_share" <= 1),
	CONSTRAINT "public_input_report_groups_published_share_bounds" CHECK ("public_input_report_groups"."published_share" IS NULL OR ("public_input_report_groups"."published_share" >= 0 AND "public_input_report_groups"."published_share" <= 1)),
	CONSTRAINT "public_input_report_groups_published_share_matches_status" CHECK (("public_input_report_groups"."published_status" = 'reported' AND "public_input_report_groups"."published_share" IS NOT NULL) OR ("public_input_report_groups"."published_status" <> 'reported' AND "public_input_report_groups"."published_share" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "public_input_report_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"kind" "public_input_finding_kind" NOT NULL,
	"statement_text" text NOT NULL,
	"publication_status" "public_input_finding_publication" DEFAULT 'included' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_report_findings_statement_nonblank" CHECK (char_length(btrim("public_input_report_findings"."statement_text")) > 0),
	CONSTRAINT "public_input_report_findings_statement_bounded" CHECK (char_length("public_input_report_findings"."statement_text") <= 500)
);
--> statement-breakpoint
CREATE TABLE "public_input_report_moderation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"finding_id" text,
	"action" "public_input_report_moderation_action" NOT NULL,
	"public_rationale" text,
	"private_note" text,
	"actor_account_id" text NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_report_moderation_actions_finding_scoped" CHECK ("public_input_report_moderation_actions"."finding_id" IS NOT NULL),
	CONSTRAINT "public_input_report_moderation_actions_rationale_required" CHECK (("public_input_report_moderation_actions"."action" = 'include') OR (char_length(btrim("public_input_report_moderation_actions"."public_rationale")) > 0))
);
--> statement-breakpoint
CREATE TABLE "public_input_provider_moderation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"opaque_statement_ref" text NOT NULL,
	"status" "public_input_provider_moderation_status" DEFAULT 'pending' NOT NULL,
	"reason_code" text NOT NULL,
	"private_note" text,
	"actor_account_id" text NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_provider_moderation_records_ref_nonblank" CHECK (char_length(btrim("public_input_provider_moderation_records"."opaque_statement_ref")) > 0),
	CONSTRAINT "public_input_provider_moderation_records_ref_bounded" CHECK (char_length("public_input_provider_moderation_records"."opaque_statement_ref") <= 200),
	CONSTRAINT "public_input_provider_moderation_records_reason_code_nonblank" CHECK (char_length(btrim("public_input_provider_moderation_records"."reason_code")) > 0)
);
--> statement-breakpoint
ALTER TABLE "public_input_report_imports" ADD CONSTRAINT "public_input_report_imports_conversation_id_public_input_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."public_input_conversations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_imports" ADD CONSTRAINT "public_input_report_imports_imported_by_account_id_accounts_id_fk" FOREIGN KEY ("imported_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_conversation_id_public_input_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."public_input_conversations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_import_id_public_input_report_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."public_input_report_imports"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_publisher_account_id_accounts_id_fk" FOREIGN KEY ("publisher_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_importer_account_id_accounts_id_fk" FOREIGN KEY ("importer_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_reports" ADD CONSTRAINT "public_input_reports_superseded_by_report_id_fk" FOREIGN KEY ("superseded_by_report_id") REFERENCES "public"."public_input_reports"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_groups" ADD CONSTRAINT "public_input_report_groups_report_id_public_input_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."public_input_reports"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_findings" ADD CONSTRAINT "public_input_report_findings_report_id_public_input_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."public_input_reports"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_moderation_actions" ADD CONSTRAINT "public_input_report_moderation_actions_report_id_public_input_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."public_input_reports"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_moderation_actions" ADD CONSTRAINT "public_input_report_moderation_actions_finding_id_public_input_report_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."public_input_report_findings"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_report_moderation_actions" ADD CONSTRAINT "public_input_report_moderation_actions_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_provider_moderation_records" ADD CONSTRAINT "public_input_provider_moderation_records_conversation_id_public_input_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."public_input_conversations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_provider_moderation_records" ADD CONSTRAINT "public_input_provider_moderation_records_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "public_input_report_imports_conversation_idx" ON "public_input_report_imports" USING btree ("conversation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_report_imports_conversation_hash_uidx" ON "public_input_report_imports" USING btree ("conversation_id","canonical_hash");
--> statement-breakpoint
CREATE INDEX "public_input_reports_conversation_idx" ON "public_input_reports" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "public_input_reports_workflow_idx" ON "public_input_reports" USING btree ("workflow_state");
--> statement-breakpoint
CREATE INDEX "public_input_reports_topic_idx" ON "public_input_reports" USING btree ("topic_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_reports_conversation_version_uidx" ON "public_input_reports" USING btree ("conversation_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_reports_one_latest_published_uidx" ON "public_input_reports" USING btree ("conversation_id") WHERE "public_input_reports"."is_latest_published" = true;
--> statement-breakpoint
CREATE INDEX "public_input_report_groups_report_idx" ON "public_input_report_groups" USING btree ("report_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_report_groups_report_label_uidx" ON "public_input_report_groups" USING btree ("report_id","label");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_report_groups_report_order_uidx" ON "public_input_report_groups" USING btree ("report_id","display_order");
--> statement-breakpoint
CREATE INDEX "public_input_report_findings_report_kind_idx" ON "public_input_report_findings" USING btree ("report_id","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_report_findings_report_kind_order_uidx" ON "public_input_report_findings" USING btree ("report_id","kind","display_order");
--> statement-breakpoint
CREATE INDEX "public_input_report_moderation_actions_report_idx" ON "public_input_report_moderation_actions" USING btree ("report_id","created_at");
--> statement-breakpoint
CREATE INDEX "public_input_report_moderation_actions_finding_idx" ON "public_input_report_moderation_actions" USING btree ("finding_id");
--> statement-breakpoint
CREATE INDEX "public_input_provider_moderation_records_conversation_idx" ON "public_input_provider_moderation_records" USING btree ("conversation_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_provider_moderation_records_conversation_ref_uidx" ON "public_input_provider_moderation_records" USING btree ("conversation_id","opaque_statement_ref");
--> statement-breakpoint
DROP TRIGGER IF EXISTS public_input_report_imports_immutable ON public_input_report_imports;
--> statement-breakpoint
CREATE TRIGGER public_input_report_imports_immutable
  BEFORE UPDATE OR DELETE ON public_input_report_imports
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS public_input_report_moderation_actions_immutable ON public_input_report_moderation_actions;
--> statement-breakpoint
CREATE TRIGGER public_input_report_moderation_actions_immutable
  BEFORE UPDATE OR DELETE ON public_input_report_moderation_actions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
