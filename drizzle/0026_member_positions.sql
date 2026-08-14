-- Commonhall v2 Phase 4 — member statement positions and Public Agenda catalog
-- fields on topic_governance_records. In-house agree|disagree|pass only.
-- Does not enable hosted Pol.is, live provider kinds, XIDs, or production
-- consultation thresholds (V2-07/11–13 remain open).
--
-- Rollback (manual, disposable databases only — never against ostt_dev):
--   DROP TRIGGER IF EXISTS ostt_member_position_parent_match ON member_statement_positions;
--   DROP FUNCTION IF EXISTS ostt_member_position_parent_match();
--   DROP TABLE IF EXISTS member_statement_positions;
--   DROP TYPE IF EXISTS member_statement_position;
--   DROP INDEX IF EXISTS topic_governance_records_org_slug_uidx;
--   DROP INDEX IF EXISTS topic_governance_records_org_provider_entity_uidx;
--   ALTER TABLE topic_governance_records
--     DROP CONSTRAINT IF EXISTS topic_governance_records_fixture_conversation_fk,
--     DROP CONSTRAINT IF EXISTS topic_governance_records_slug_nonblank,
--     DROP CONSTRAINT IF EXISTS topic_governance_records_title_nonblank,
--     DROP COLUMN IF EXISTS slug,
--     DROP COLUMN IF EXISTS title,
--     DROP COLUMN IF EXISTS question,
--     DROP COLUMN IF EXISTS overview,
--     DROP COLUMN IF EXISTS synthetic_evidence,
--     DROP COLUMN IF EXISTS synthetic_statements,
--     DROP COLUMN IF EXISTS fixture_conversation_id,
--     DROP COLUMN IF EXISTS current_provider_entity_id;

DO $$ BEGIN
  CREATE TYPE "public"."member_statement_position" AS ENUM(
    'agree',
    'disagree',
    'pass'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "topic_governance_records"
  ADD COLUMN IF NOT EXISTS "slug" text,
  ADD COLUMN IF NOT EXISTS "title" text,
  ADD COLUMN IF NOT EXISTS "question" text,
  ADD COLUMN IF NOT EXISTS "overview" text,
  ADD COLUMN IF NOT EXISTS "synthetic_evidence" jsonb,
  ADD COLUMN IF NOT EXISTS "synthetic_statements" jsonb,
  ADD COLUMN IF NOT EXISTS "fixture_conversation_id" text,
  ADD COLUMN IF NOT EXISTS "current_provider_entity_id" text;
--> statement-breakpoint

ALTER TABLE "topic_governance_records"
  DROP CONSTRAINT IF EXISTS "topic_governance_records_slug_nonblank";
--> statement-breakpoint
ALTER TABLE "topic_governance_records"
  ADD CONSTRAINT "topic_governance_records_slug_nonblank"
  CHECK ("slug" IS NULL OR char_length(btrim("slug")) > 0);
--> statement-breakpoint

ALTER TABLE "topic_governance_records"
  DROP CONSTRAINT IF EXISTS "topic_governance_records_title_nonblank";
--> statement-breakpoint
ALTER TABLE "topic_governance_records"
  ADD CONSTRAINT "topic_governance_records_title_nonblank"
  CHECK ("title" IS NULL OR char_length(btrim("title")) > 0);
--> statement-breakpoint

ALTER TABLE "topic_governance_records"
  DROP CONSTRAINT IF EXISTS "topic_governance_records_fixture_conversation_fk";
--> statement-breakpoint
ALTER TABLE "topic_governance_records"
  ADD CONSTRAINT "topic_governance_records_fixture_conversation_fk"
  FOREIGN KEY ("fixture_conversation_id")
  REFERENCES "public_input_conversations" ("id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "topic_governance_records_org_slug_uidx"
  ON "topic_governance_records" ("organization_id", "slug")
  WHERE "slug" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "topic_governance_records_org_provider_entity_uidx"
  ON "topic_governance_records" ("organization_id", "current_provider_entity_id")
  WHERE "current_provider_entity_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "member_statement_positions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "topic_governance_record_id" text NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "statement_public_id" text NOT NULL,
  "position" "member_statement_position" NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "member_statement_positions_statement_nonblank"
    CHECK (char_length(btrim("statement_public_id")) > 0),
  CONSTRAINT "member_statement_positions_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "member_statement_positions_org_record_account_statement_uidx"
  ON "member_statement_positions" USING btree (
    "organization_id",
    "topic_governance_record_id",
    "account_id",
    "statement_public_id"
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "member_statement_positions_org_record_idx"
  ON "member_statement_positions" USING btree (
    "organization_id",
    "topic_governance_record_id"
  );
--> statement-breakpoint

ALTER TABLE "member_statement_positions"
  DROP CONSTRAINT IF EXISTS "member_statement_positions_org_governance_fk";
--> statement-breakpoint
ALTER TABLE "member_statement_positions"
  ADD CONSTRAINT "member_statement_positions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_member_position_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
BEGIN
  SELECT organization_id INTO parent_org
    FROM topic_governance_records
    WHERE id = NEW.topic_governance_record_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'member_statement_positions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_member_position_parent_match ON member_statement_positions;
--> statement-breakpoint
CREATE TRIGGER ostt_member_position_parent_match
  BEFORE INSERT OR UPDATE ON member_statement_positions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_member_position_parent_match();
