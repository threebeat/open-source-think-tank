-- Commonhall v2 Phase 3 — organization-scoped Commons discussions.
-- Formal/informal categories follow docs/v2/community-standards.md.
-- Members cannot freely set formal=true; the column is a projection of
-- category rules. Does not relabel legacy Idea Commons rows as v2 formal
-- content. Does not add Agenda, Pol.is, Chamber, or email tables.
--
-- Rollback (manual, disposable databases only — never against ostt_dev):
--   DROP TRIGGER IF EXISTS commons_discussion_revisions_immutable ON commons_discussion_revisions;
--   DROP TRIGGER IF EXISTS ostt_commons_revision_parent_match ON commons_discussion_revisions;
--   DROP TRIGGER IF EXISTS ostt_commons_parent_discussion_match ON commons_discussions;
--   DROP FUNCTION IF EXISTS ostt_commons_revision_parent_match();
--   DROP FUNCTION IF EXISTS ostt_commons_parent_discussion_match();
--   DROP TABLE IF EXISTS commons_discussion_revisions;
--   DROP TABLE IF EXISTS commons_discussions;
--   DROP TYPE IF EXISTS commons_discussion_visibility;
--   DROP TYPE IF EXISTS commons_discussion_category;

DO $$ BEGIN
  CREATE TYPE "public"."commons_discussion_category" AS ENUM(
    'moderator_communications',
    'council_communications',
    'qualified_topic_discussions',
    'qualified_approach_discussions',
    'community_actions',
    'topic_proposals',
    'approach_proposals',
    'general_discussion',
    'disqualified_topics'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."commons_discussion_visibility" AS ENUM(
    'listed',
    'hidden'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "commons_discussions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "public_id" text NOT NULL,
  "category" "commons_discussion_category" NOT NULL,
  "formal" boolean NOT NULL,
  "visibility" "commons_discussion_visibility" NOT NULL DEFAULT 'listed',
  "author_account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "parent_discussion_id" text,
  "topic_governance_record_id" text,
  "synthetic" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "commons_discussions_public_id_nonblank" CHECK (char_length(btrim("public_id")) > 0),
  CONSTRAINT "commons_discussions_title_nonblank" CHECK (char_length(btrim("title")) > 0),
  CONSTRAINT "commons_discussions_body_nonblank" CHECK (char_length(btrim("body")) > 0),
  CONSTRAINT "commons_discussions_formal_matches_category" CHECK (
    (
      "formal" = true AND "category" IN (
        'moderator_communications',
        'council_communications',
        'qualified_topic_discussions',
        'qualified_approach_discussions',
        'community_actions'
      )
    ) OR (
      "formal" = false AND "category" IN (
        'topic_proposals',
        'approach_proposals',
        'general_discussion',
        'disqualified_topics'
      )
    )
  ),
  CONSTRAINT "commons_discussions_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "commons_discussions_org_public_id_uidx"
  ON "commons_discussions" USING btree ("organization_id", "public_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "commons_discussions_org_category_idx"
  ON "commons_discussions" USING btree ("organization_id", "category", "created_at");
--> statement-breakpoint

ALTER TABLE "commons_discussions"
  ADD CONSTRAINT "commons_discussions_parent_fk"
  FOREIGN KEY ("organization_id", "parent_discussion_id")
  REFERENCES "commons_discussions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "commons_discussions"
  ADD CONSTRAINT "commons_discussions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "commons_discussion_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "discussion_id" text NOT NULL,
  "revision_number" integer NOT NULL,
  "editor_account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" "commons_discussion_category" NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "commons_discussion_revisions_title_nonblank" CHECK (char_length(btrim("title")) > 0),
  CONSTRAINT "commons_discussion_revisions_body_nonblank" CHECK (char_length(btrim("body")) > 0),
  CONSTRAINT "commons_discussion_revisions_number_positive" CHECK ("revision_number" > 0),
  CONSTRAINT "commons_discussion_revisions_org_discussion_fk"
    FOREIGN KEY ("organization_id", "discussion_id")
    REFERENCES "commons_discussions" ("organization_id", "id")
    ON DELETE restrict
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "commons_revisions_discussion_number_uidx"
  ON "commons_discussion_revisions" USING btree ("organization_id", "discussion_id", "revision_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "commons_revisions_discussion_idx"
  ON "commons_discussion_revisions" USING btree ("organization_id", "discussion_id", "created_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_commons_parent_discussion_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
BEGIN
  IF NEW.parent_discussion_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO parent_org
    FROM commons_discussions
    WHERE id = NEW.parent_discussion_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'commons_discussions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_commons_parent_discussion_match ON commons_discussions;
--> statement-breakpoint
CREATE TRIGGER ostt_commons_parent_discussion_match
  BEFORE INSERT OR UPDATE ON commons_discussions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_commons_parent_discussion_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_commons_revision_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
BEGIN
  SELECT organization_id INTO parent_org
    FROM commons_discussions
    WHERE id = NEW.discussion_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'commons_discussion_revisions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_commons_revision_parent_match ON commons_discussion_revisions;
--> statement-breakpoint
CREATE TRIGGER ostt_commons_revision_parent_match
  BEFORE INSERT ON commons_discussion_revisions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_commons_revision_parent_match();
--> statement-breakpoint

DROP TRIGGER IF EXISTS commons_discussion_revisions_immutable ON commons_discussion_revisions;
--> statement-breakpoint
CREATE TRIGGER commons_discussion_revisions_immutable
  BEFORE UPDATE OR DELETE ON commons_discussion_revisions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
