CREATE TYPE "public"."assent_outcome" AS ENUM('declined', 'withdrawn');--> statement-breakpoint
CREATE TABLE "assent_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"document_version_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"outcome" "assent_outcome" NOT NULL,
	"prior_assent_id" text,
	"reason" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assent_outcomes_withdrawn_needs_prior_assent" CHECK (("assent_outcomes"."outcome" <> 'withdrawn') OR ("assent_outcomes"."prior_assent_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "assent_outcomes" ADD CONSTRAINT "assent_outcomes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assent_outcomes" ADD CONSTRAINT "assent_outcomes_prior_assent_id_assent_records_id_fk" FOREIGN KEY ("prior_assent_id") REFERENCES "public"."assent_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assent_outcomes" ADD CONSTRAINT "assent_outcomes_document_hash_fk" FOREIGN KEY ("document_version_id","content_hash") REFERENCES "public"."document_versions"("id","content_hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assent_outcomes_account_idx" ON "assent_outcomes" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_one_published_per_kind_uidx" ON "document_versions" USING btree ("kind") WHERE "document_versions"."state" = 'published';--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_superseded_needs_timestamp" CHECK (("document_versions"."state" <> 'superseded') OR ("document_versions"."superseded_at" IS NOT NULL));--> statement-breakpoint
-- Published document content is immutable in place (Work Package 2.6).
CREATE OR REPLACE FUNCTION ostt_protect_published_document_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.state IN ('published', 'superseded', 'withdrawn') THEN
    IF NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.kind IS DISTINCT FROM OLD.kind
      OR NEW.version_label IS DISTINCT FROM OLD.version_label THEN
      RAISE EXCEPTION 'published document content cannot be changed in place'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF NEW.state = 'published'
    AND (
      TG_OP = 'INSERT'
      OR OLD.state IS DISTINCT FROM 'published'
    )
    AND (
      NEW.title ILIKE '%not legally reviewed%'
      OR NEW.body ILIKE '%not legally reviewed%'
    ) THEN
    RAISE EXCEPTION 'documents marked not legally reviewed cannot become published assent documents'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS document_versions_protect_published_content ON document_versions;--> statement-breakpoint
CREATE TRIGGER document_versions_protect_published_content
  BEFORE INSERT OR UPDATE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_protect_published_document_content();--> statement-breakpoint
DROP TRIGGER IF EXISTS assent_outcomes_immutable ON assent_outcomes;--> statement-breakpoint
CREATE TRIGGER assent_outcomes_immutable
  BEFORE UPDATE OR DELETE ON assent_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();