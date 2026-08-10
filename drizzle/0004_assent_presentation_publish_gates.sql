CREATE TABLE "assent_presentations" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"document_version_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"presented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "required_notices" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "counsel_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "counsel_reviewed_by_account_id" text;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "published_by_account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "assent_records_id_account_doc_hash_uidx" ON "assent_records" USING btree ("id","account_id","document_version_id","content_hash");--> statement-breakpoint
ALTER TABLE "assent_presentations" ADD CONSTRAINT "assent_presentations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assent_presentations" ADD CONSTRAINT "assent_presentations_document_hash_fk" FOREIGN KEY ("document_version_id","content_hash") REFERENCES "public"."document_versions"("id","content_hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assent_presentations_account_idx" ON "assent_presentations" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "assent_outcomes" ADD CONSTRAINT "assent_outcomes_prior_assent_match_fk" FOREIGN KEY ("prior_assent_id","account_id","document_version_id","content_hash") REFERENCES "public"."assent_records"("id","account_id","document_version_id","content_hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_counsel_reviewed_by_account_id_accounts_id_fk" FOREIGN KEY ("counsel_reviewed_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_published_by_account_id_accounts_id_fk" FOREIGN KEY ("published_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assent_outcomes_one_withdrawn_per_assent_uidx" ON "assent_outcomes" USING btree ("prior_assent_id") WHERE "assent_outcomes"."outcome" = 'withdrawn' AND "assent_outcomes"."prior_assent_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "assent_outcomes" ADD CONSTRAINT "assent_outcomes_declined_has_no_prior_assent" CHECK (("assent_outcomes"."outcome" <> 'declined') OR ("assent_outcomes"."prior_assent_id" IS NULL));--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_counsel_reviewed_needs_provenance" CHECK (("document_versions"."state" <> 'counsel_reviewed' AND "document_versions"."state" <> 'published' AND "document_versions"."state" <> 'superseded') OR ("document_versions"."counsel_reviewed_at" IS NOT NULL));--> statement-breakpoint
-- Replace publish-content guard with full state-transition + content rules (2.6 feedback).
CREATE OR REPLACE FUNCTION ostt_document_version_state_machine()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'draft' THEN
      RAISE EXCEPTION 'document_versions may only be inserted as draft'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.title ILIKE '%not legally reviewed%'
      OR NEW.body ILIKE '%not legally reviewed%' THEN
      -- Drafts may contain the marker; publishing is blocked later.
      NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Content immutable once reviewed/published (including the publish update itself).
  IF OLD.state IN ('counsel_reviewed', 'published', 'superseded', 'withdrawn') THEN
    IF NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.kind IS DISTINCT FROM OLD.kind
      OR NEW.version_label IS DISTINCT FROM OLD.version_label
      OR NEW.required_notices IS DISTINCT FROM OLD.required_notices THEN
      RAISE EXCEPTION 'reviewed or published document content cannot be changed in place'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF OLD.state = 'draft' AND NEW.state = 'counsel_reviewed' THEN
      IF NEW.counsel_reviewed_at IS NULL THEN
        RAISE EXCEPTION 'counsel_reviewed requires counsel_reviewed_at'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    ELSIF OLD.state = 'counsel_reviewed' AND NEW.state = 'published' THEN
      IF NEW.published_at IS NULL THEN
        RAISE EXCEPTION 'published requires published_at'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF NEW.counsel_reviewed_at IS NULL THEN
        RAISE EXCEPTION 'published requires prior counsel review provenance'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
      IF NEW.title ILIKE '%not legally reviewed%'
        OR NEW.body ILIKE '%not legally reviewed%' THEN
        RAISE EXCEPTION 'documents marked not legally reviewed cannot become published assent documents'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    ELSIF OLD.state = 'published' AND NEW.state = 'superseded' THEN
      IF NEW.superseded_at IS NULL THEN
        RAISE EXCEPTION 'superseded requires superseded_at'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    ELSIF OLD.state = 'published' AND NEW.state = 'withdrawn' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'invalid document_versions state transition % → %', OLD.state, NEW.state
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS document_versions_protect_published_content ON document_versions;--> statement-breakpoint
DROP TRIGGER IF EXISTS document_versions_state_machine ON document_versions;--> statement-breakpoint
CREATE TRIGGER document_versions_state_machine
  BEFORE INSERT OR UPDATE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_document_version_state_machine();
