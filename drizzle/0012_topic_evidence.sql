-- Phase 3.2 durable topic / claim / evidence model.
-- Incremental only — does not recreate Phase 2 foundation tables.
-- No Pol.is / popularity / consensus columns on topic/claim/evidence tables.

CREATE TYPE "public"."claim_evidence_relationship" AS ENUM('supporting', 'counterevidence');
--> statement-breakpoint
CREATE TYPE "public"."claim_review_decision" AS ENUM('changes_requested', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."evidence_author_type" AS ENUM('agency', 'researcher', 'journalist', 'civil_society', 'industry', 'other');
--> statement-breakpoint
CREATE TYPE "public"."evidence_quality_status" AS ENUM('pending', 'accepted', 'limited', 'disputed', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."evidence_review_decision" AS ENUM('changes_requested', 'accepted', 'rejected', 'quality_decided');
--> statement-breakpoint
CREATE TYPE "public"."evidence_source_type" AS ENUM('report', 'dataset', 'peer_reviewed', 'news', 'memo', 'other');
--> statement-breakpoint
CREATE TYPE "public"."moderation_visibility" AS ENUM('visible', 'held', 'hidden');
--> statement-breakpoint
CREATE TYPE "public"."submission_workflow_state" AS ENUM('draft', 'submitted', 'changes_requested', 'accepted', 'rejected', 'withdrawn');
--> statement-breakpoint
CREATE TYPE "public"."topic_publication_status" AS ENUM('unpublished', 'published');
--> statement-breakpoint
CREATE TYPE "public"."topic_workflow_state" AS ENUM('draft', 'open_for_submissions', 'under_review', 'paused', 'archived');
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"background" text NOT NULL,
	"scope" text NOT NULL,
	"workflow_state" "topic_workflow_state" DEFAULT 'draft' NOT NULL,
	"publication_status" "topic_publication_status" DEFAULT 'unpublished' NOT NULL,
	"created_by_account_id" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_account_id" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_title_nonblank" CHECK (char_length(btrim("topics"."title")) > 0),
	CONSTRAINT "topics_slug_nonblank" CHECK (char_length(btrim("topics"."slug")) > 0),
	CONSTRAINT "topics_question_nonblank" CHECK (char_length(btrim("topics"."question")) > 0),
	CONSTRAINT "topics_background_nonblank" CHECK (char_length(btrim("topics"."background")) > 0),
	CONSTRAINT "topics_scope_nonblank" CHECK (char_length(btrim("topics"."scope")) > 0),
	CONSTRAINT "topics_published_requires_provenance" CHECK (("topics"."publication_status" <> 'published') OR ("topics"."published_at" IS NOT NULL AND "topics"."published_by_account_id" IS NOT NULL)),
	CONSTRAINT "topics_unpublished_clears_publication_stamp" CHECK (("topics"."publication_status" <> 'unpublished') OR ("topics"."published_at" IS NULL AND "topics"."published_by_account_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"author_account_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"approach_label" text NOT NULL,
	"workflow_state" "submission_workflow_state" DEFAULT 'draft' NOT NULL,
	"moderation_visibility" "moderation_visibility" DEFAULT 'visible' NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_title_nonblank" CHECK (char_length(btrim("claims"."title")) > 0),
	CONSTRAINT "claims_summary_nonblank" CHECK (char_length(btrim("claims"."summary")) > 0),
	CONSTRAINT "claims_approach_label_nonblank" CHECK (char_length(btrim("claims"."approach_label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "evidence_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"submitter_account_id" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"author_type" "evidence_author_type" NOT NULL,
	"source_type" "evidence_source_type" NOT NULL,
	"limitations" text NOT NULL,
	"workflow_state" "submission_workflow_state" DEFAULT 'draft' NOT NULL,
	"quality_status" "evidence_quality_status" DEFAULT 'pending' NOT NULL,
	"moderation_visibility" "moderation_visibility" DEFAULT 'visible' NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_submissions_title_nonblank" CHECK (char_length(btrim("evidence_submissions"."title")) > 0),
	CONSTRAINT "evidence_submissions_url_nonblank" CHECK (char_length(btrim("evidence_submissions"."source_url")) > 0),
	CONSTRAINT "evidence_submissions_organization_nonblank" CHECK (char_length(btrim("evidence_submissions"."organization")) > 0),
	CONSTRAINT "evidence_submissions_limitations_nonblank" CHECK (char_length(btrim("evidence_submissions"."limitations")) > 0)
);
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_published_by_account_id_accounts_id_fk" FOREIGN KEY ("published_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence_submissions" ADD CONSTRAINT "evidence_submissions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence_submissions" ADD CONSTRAINT "evidence_submissions_submitter_account_id_accounts_id_fk" FOREIGN KEY ("submitter_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_uidx" ON "topics" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "topics_id_uidx" ON "topics" USING btree ("id");
--> statement-breakpoint
CREATE INDEX "topics_workflow_idx" ON "topics" USING btree ("workflow_state");
--> statement-breakpoint
CREATE INDEX "topics_publication_idx" ON "topics" USING btree ("publication_status");
--> statement-breakpoint
CREATE INDEX "topics_created_by_idx" ON "topics" USING btree ("created_by_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "claims_id_topic_uidx" ON "claims" USING btree ("id","topic_id");
--> statement-breakpoint
CREATE INDEX "claims_topic_idx" ON "claims" USING btree ("topic_id");
--> statement-breakpoint
CREATE INDEX "claims_workflow_idx" ON "claims" USING btree ("workflow_state");
--> statement-breakpoint
CREATE INDEX "claims_visibility_idx" ON "claims" USING btree ("moderation_visibility");
--> statement-breakpoint
CREATE INDEX "claims_author_idx" ON "claims" USING btree ("author_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_submissions_id_topic_uidx" ON "evidence_submissions" USING btree ("id","topic_id");
--> statement-breakpoint
CREATE INDEX "evidence_submissions_topic_idx" ON "evidence_submissions" USING btree ("topic_id");
--> statement-breakpoint
CREATE INDEX "evidence_submissions_workflow_idx" ON "evidence_submissions" USING btree ("workflow_state");
--> statement-breakpoint
CREATE INDEX "evidence_submissions_quality_idx" ON "evidence_submissions" USING btree ("quality_status");
--> statement-breakpoint
CREATE INDEX "evidence_submissions_visibility_idx" ON "evidence_submissions" USING btree ("moderation_visibility");
--> statement-breakpoint
CREATE INDEX "evidence_submissions_submitter_idx" ON "evidence_submissions" USING btree ("submitter_account_id");
--> statement-breakpoint
CREATE TABLE "claim_evidence_links" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"evidence_submission_id" text NOT NULL,
	"relationship" "claim_evidence_relationship" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_claim_topic_fk" FOREIGN KEY ("claim_id","topic_id") REFERENCES "public"."claims"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_evidence_topic_fk" FOREIGN KEY ("evidence_submission_id","topic_id") REFERENCES "public"."evidence_submissions"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "claim_evidence_links_pair_uidx" ON "claim_evidence_links" USING btree ("claim_id","evidence_submission_id");
--> statement-breakpoint
CREATE INDEX "claim_evidence_links_topic_idx" ON "claim_evidence_links" USING btree ("topic_id");
--> statement-breakpoint
CREATE INDEX "claim_evidence_links_claim_idx" ON "claim_evidence_links" USING btree ("claim_id");
--> statement-breakpoint
CREATE INDEX "claim_evidence_links_evidence_idx" ON "claim_evidence_links" USING btree ("evidence_submission_id");
--> statement-breakpoint
CREATE TABLE "conflict_disclosures" (
	"id" text PRIMARY KEY NOT NULL,
	"disclosing_account_id" text NOT NULL,
	"claim_id" text,
	"evidence_submission_id" text,
	"public_summary" text NOT NULL,
	"private_detail" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conflict_disclosures_public_summary_nonblank" CHECK (char_length(btrim("conflict_disclosures"."public_summary")) > 0),
	CONSTRAINT "conflict_disclosures_exactly_one_subject" CHECK ((
        ("conflict_disclosures"."claim_id" IS NOT NULL AND "conflict_disclosures"."evidence_submission_id" IS NULL)
        OR ("conflict_disclosures"."claim_id" IS NULL AND "conflict_disclosures"."evidence_submission_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "conflict_disclosures" ADD CONSTRAINT "conflict_disclosures_disclosing_account_id_accounts_id_fk" FOREIGN KEY ("disclosing_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conflict_disclosures" ADD CONSTRAINT "conflict_disclosures_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conflict_disclosures" ADD CONSTRAINT "conflict_disclosures_evidence_submission_id_evidence_submissions_id_fk" FOREIGN KEY ("evidence_submission_id") REFERENCES "public"."evidence_submissions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conflict_disclosures_account_idx" ON "conflict_disclosures" USING btree ("disclosing_account_id");
--> statement-breakpoint
CREATE INDEX "conflict_disclosures_claim_idx" ON "conflict_disclosures" USING btree ("claim_id");
--> statement-breakpoint
CREATE INDEX "conflict_disclosures_evidence_idx" ON "conflict_disclosures" USING btree ("evidence_submission_id");
--> statement-breakpoint
CREATE TABLE "claim_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"reviewer_account_id" text NOT NULL,
	"decision" "claim_review_decision" NOT NULL,
	"public_rationale" text NOT NULL,
	"private_notes" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_reviews_public_rationale_nonblank" CHECK (char_length(btrim("claim_reviews"."public_rationale")) > 0)
);
--> statement-breakpoint
ALTER TABLE "claim_reviews" ADD CONSTRAINT "claim_reviews_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "claim_reviews" ADD CONSTRAINT "claim_reviews_reviewer_account_id_accounts_id_fk" FOREIGN KEY ("reviewer_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "claim_reviews_claim_idx" ON "claim_reviews" USING btree ("claim_id");
--> statement-breakpoint
CREATE INDEX "claim_reviews_reviewer_idx" ON "claim_reviews" USING btree ("reviewer_account_id");
--> statement-breakpoint
CREATE INDEX "claim_reviews_decided_at_idx" ON "claim_reviews" USING btree ("decided_at");
--> statement-breakpoint
CREATE TABLE "evidence_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_submission_id" text NOT NULL,
	"reviewer_account_id" text NOT NULL,
	"decision" "evidence_review_decision" NOT NULL,
	"quality_status" "evidence_quality_status",
	"workflow_decision" "submission_workflow_state",
	"public_rationale" text NOT NULL,
	"private_notes" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_reviews_public_rationale_nonblank" CHECK (char_length(btrim("evidence_reviews"."public_rationale")) > 0),
	CONSTRAINT "evidence_reviews_quality_decided_needs_status" CHECK (("evidence_reviews"."decision" <> 'quality_decided') OR ("evidence_reviews"."quality_status" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_evidence_submission_id_evidence_submissions_id_fk" FOREIGN KEY ("evidence_submission_id") REFERENCES "public"."evidence_submissions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_reviewer_account_id_accounts_id_fk" FOREIGN KEY ("reviewer_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "evidence_reviews_evidence_idx" ON "evidence_reviews" USING btree ("evidence_submission_id");
--> statement-breakpoint
CREATE INDEX "evidence_reviews_reviewer_idx" ON "evidence_reviews" USING btree ("reviewer_account_id");
--> statement-breakpoint
CREATE INDEX "evidence_reviews_decided_at_idx" ON "evidence_reviews" USING btree ("decided_at");
--> statement-breakpoint
-- Append-only review provenance (reuse ostt_reject_mutation from 0001).
DROP TRIGGER IF EXISTS claim_reviews_immutable ON claim_reviews;
--> statement-breakpoint
CREATE TRIGGER claim_reviews_immutable
  BEFORE UPDATE OR DELETE ON claim_reviews
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS evidence_reviews_immutable ON evidence_reviews;
--> statement-breakpoint
CREATE TRIGGER evidence_reviews_immutable
  BEFORE UPDATE OR DELETE ON evidence_reviews
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
