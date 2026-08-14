-- Commonhall v2 Phase 5 — Chamber/Council sessions, roll calls, and
-- versioned verdicts/recommendations. Organization-scoped composite FKs.
-- Synthetic fixtures only. Does not enable hosted Pol.is or production
-- Chamber/Council size, quorum, or appointment policy (V2-09/10/11–13).
-- Roll-call positions are exactly yes|no|abstain|recused|absent.
--
-- Rollback (manual, disposable databases only — never against ostt_dev):
--   DROP TRIGGER IF EXISTS ostt_council_roll_call_parent_match ON council_roll_calls;
--   DROP TRIGGER IF EXISTS ostt_chamber_roll_call_parent_match ON chamber_roll_calls;
--   DROP TRIGGER IF EXISTS ostt_council_recommendation_parent_match ON council_recommendation_versions;
--   DROP TRIGGER IF EXISTS ostt_chamber_verdict_parent_match ON chamber_verdict_versions;
--   DROP TRIGGER IF EXISTS ostt_council_session_parent_match ON council_sessions;
--   DROP TRIGGER IF EXISTS ostt_chamber_session_parent_match ON chamber_sessions;
--   DROP FUNCTION IF EXISTS ostt_council_roll_call_parent_match();
--   DROP FUNCTION IF EXISTS ostt_chamber_roll_call_parent_match();
--   DROP FUNCTION IF EXISTS ostt_council_recommendation_parent_match();
--   DROP FUNCTION IF EXISTS ostt_chamber_verdict_parent_match();
--   DROP FUNCTION IF EXISTS ostt_council_session_parent_match();
--   DROP FUNCTION IF EXISTS ostt_chamber_session_parent_match();
--   DROP TABLE IF EXISTS council_roll_calls;
--   DROP TABLE IF EXISTS chamber_roll_calls;
--   DROP TABLE IF EXISTS council_recommendation_versions;
--   DROP TABLE IF EXISTS chamber_verdict_versions;
--   DROP TABLE IF EXISTS council_sessions;
--   DROP TABLE IF EXISTS chamber_sessions;
--   DROP TYPE IF EXISTS chamber_verdict_outcome;
--   DROP TYPE IF EXISTS council_session_status;
--   DROP TYPE IF EXISTS chamber_session_status;
--   DROP TYPE IF EXISTS public_roll_call_position;

DO $$ BEGIN
  CREATE TYPE "public"."public_roll_call_position" AS ENUM(
    'yes',
    'no',
    'abstain',
    'recused',
    'absent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."chamber_session_status" AS ENUM(
    'scheduled',
    'in_session',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."council_session_status" AS ENUM(
    'scheduled',
    'in_session',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."chamber_verdict_outcome" AS ENUM(
    'accepted',
    'disputed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chamber_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "public_id" text NOT NULL,
  "topic_governance_record_id" text NOT NULL,
  "status" "chamber_session_status" NOT NULL,
  "timezone" text NOT NULL,
  "scheduled_opens_at" timestamp with time zone NOT NULL,
  "scheduled_closes_at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chamber_sessions_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "chamber_sessions_public_id_nonblank"
    CHECK (char_length(btrim("public_id")) > 0),
  CONSTRAINT "chamber_sessions_timezone_nonblank"
    CHECK (char_length(btrim("timezone")) > 0),
  CONSTRAINT "chamber_sessions_schedule_order"
    CHECK ("scheduled_closes_at" > "scheduled_opens_at")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chamber_sessions_org_public_id_uidx"
  ON "chamber_sessions" ("organization_id", "public_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chamber_sessions_org_topic_uidx"
  ON "chamber_sessions" ("organization_id", "topic_governance_record_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chamber_sessions_org_status_idx"
  ON "chamber_sessions" ("organization_id", "status", "scheduled_opens_at");
--> statement-breakpoint

ALTER TABLE "chamber_sessions"
  DROP CONSTRAINT IF EXISTS "chamber_sessions_org_governance_fk";
--> statement-breakpoint
ALTER TABLE "chamber_sessions"
  ADD CONSTRAINT "chamber_sessions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chamber_verdict_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "session_id" text NOT NULL,
  "topic_governance_record_id" text NOT NULL,
  "version" integer NOT NULL,
  "outcome" "chamber_verdict_outcome" NOT NULL,
  "rationale" text NOT NULL,
  "minority_reasoning" text,
  "published_at" timestamp with time zone NOT NULL,
  "roster_snapshot" jsonb NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chamber_verdict_versions_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "chamber_verdict_versions_version_positive" CHECK ("version" > 0),
  CONSTRAINT "chamber_verdict_versions_rationale_nonblank"
    CHECK (char_length(btrim("rationale")) > 0)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chamber_verdict_versions_org_session_version_uidx"
  ON "chamber_verdict_versions" ("organization_id", "session_id", "version");
--> statement-breakpoint

ALTER TABLE "chamber_verdict_versions"
  DROP CONSTRAINT IF EXISTS "chamber_verdict_versions_org_session_fk";
--> statement-breakpoint
ALTER TABLE "chamber_verdict_versions"
  ADD CONSTRAINT "chamber_verdict_versions_org_session_fk"
  FOREIGN KEY ("organization_id", "session_id")
  REFERENCES "chamber_sessions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "chamber_verdict_versions"
  DROP CONSTRAINT IF EXISTS "chamber_verdict_versions_org_governance_fk";
--> statement-breakpoint
ALTER TABLE "chamber_verdict_versions"
  ADD CONSTRAINT "chamber_verdict_versions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chamber_roll_calls" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "session_id" text NOT NULL,
  "verdict_version_id" text NOT NULL,
  "appointment_id" text NOT NULL,
  "member_public_id" text NOT NULL,
  "position" "public_roll_call_position" NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chamber_roll_calls_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "chamber_roll_calls_member_public_id_nonblank"
    CHECK (char_length(btrim("member_public_id")) > 0)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chamber_roll_calls_org_verdict_appointment_uidx"
  ON "chamber_roll_calls" ("organization_id", "verdict_version_id", "appointment_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chamber_roll_calls_org_verdict_member_uidx"
  ON "chamber_roll_calls" ("organization_id", "verdict_version_id", "member_public_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chamber_roll_calls_org_session_idx"
  ON "chamber_roll_calls" ("organization_id", "session_id");
--> statement-breakpoint

ALTER TABLE "chamber_roll_calls"
  DROP CONSTRAINT IF EXISTS "chamber_roll_calls_org_session_fk";
--> statement-breakpoint
ALTER TABLE "chamber_roll_calls"
  ADD CONSTRAINT "chamber_roll_calls_org_session_fk"
  FOREIGN KEY ("organization_id", "session_id")
  REFERENCES "chamber_sessions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "chamber_roll_calls"
  DROP CONSTRAINT IF EXISTS "chamber_roll_calls_org_verdict_fk";
--> statement-breakpoint
ALTER TABLE "chamber_roll_calls"
  ADD CONSTRAINT "chamber_roll_calls_org_verdict_fk"
  FOREIGN KEY ("organization_id", "verdict_version_id")
  REFERENCES "chamber_verdict_versions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "chamber_roll_calls"
  DROP CONSTRAINT IF EXISTS "chamber_roll_calls_org_appointment_fk";
--> statement-breakpoint
ALTER TABLE "chamber_roll_calls"
  ADD CONSTRAINT "chamber_roll_calls_org_appointment_fk"
  FOREIGN KEY ("organization_id", "appointment_id")
  REFERENCES "organization_appointments" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "council_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "public_id" text NOT NULL,
  "topic_governance_record_id" text NOT NULL,
  "status" "council_session_status" NOT NULL,
  "timezone" text NOT NULL,
  "scheduled_opens_at" timestamp with time zone NOT NULL,
  "scheduled_closes_at" timestamp with time zone NOT NULL,
  "intake_reason" text,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "council_sessions_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "council_sessions_public_id_nonblank"
    CHECK (char_length(btrim("public_id")) > 0),
  CONSTRAINT "council_sessions_timezone_nonblank"
    CHECK (char_length(btrim("timezone")) > 0),
  CONSTRAINT "council_sessions_schedule_order"
    CHECK ("scheduled_closes_at" > "scheduled_opens_at")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "council_sessions_org_public_id_uidx"
  ON "council_sessions" ("organization_id", "public_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "council_sessions_org_topic_uidx"
  ON "council_sessions" ("organization_id", "topic_governance_record_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "council_sessions_org_status_idx"
  ON "council_sessions" ("organization_id", "status", "scheduled_opens_at");
--> statement-breakpoint

ALTER TABLE "council_sessions"
  DROP CONSTRAINT IF EXISTS "council_sessions_org_governance_fk";
--> statement-breakpoint
ALTER TABLE "council_sessions"
  ADD CONSTRAINT "council_sessions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "council_recommendation_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "session_id" text NOT NULL,
  "topic_governance_record_id" text NOT NULL,
  "version" integer NOT NULL,
  "rationale" text NOT NULL,
  "minority_reasoning" text,
  "published_at" timestamp with time zone NOT NULL,
  "roster_snapshot" jsonb NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "council_recommendation_versions_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "council_recommendation_versions_version_positive" CHECK ("version" > 0),
  CONSTRAINT "council_recommendation_versions_rationale_nonblank"
    CHECK (char_length(btrim("rationale")) > 0)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "council_recommendation_versions_org_session_version_uidx"
  ON "council_recommendation_versions" ("organization_id", "session_id", "version");
--> statement-breakpoint

ALTER TABLE "council_recommendation_versions"
  DROP CONSTRAINT IF EXISTS "council_recommendation_versions_org_session_fk";
--> statement-breakpoint
ALTER TABLE "council_recommendation_versions"
  ADD CONSTRAINT "council_recommendation_versions_org_session_fk"
  FOREIGN KEY ("organization_id", "session_id")
  REFERENCES "council_sessions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "council_recommendation_versions"
  DROP CONSTRAINT IF EXISTS "council_recommendation_versions_org_governance_fk";
--> statement-breakpoint
ALTER TABLE "council_recommendation_versions"
  ADD CONSTRAINT "council_recommendation_versions_org_governance_fk"
  FOREIGN KEY ("organization_id", "topic_governance_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "council_roll_calls" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "session_id" text NOT NULL,
  "recommendation_version_id" text NOT NULL,
  "appointment_id" text NOT NULL,
  "member_public_id" text NOT NULL,
  "position" "public_roll_call_position" NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "council_roll_calls_org_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "council_roll_calls_member_public_id_nonblank"
    CHECK (char_length(btrim("member_public_id")) > 0)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "council_roll_calls_org_recommendation_appointment_uidx"
  ON "council_roll_calls" (
    "organization_id",
    "recommendation_version_id",
    "appointment_id"
  );
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "council_roll_calls_org_recommendation_member_uidx"
  ON "council_roll_calls" (
    "organization_id",
    "recommendation_version_id",
    "member_public_id"
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "council_roll_calls_org_session_idx"
  ON "council_roll_calls" ("organization_id", "session_id");
--> statement-breakpoint

ALTER TABLE "council_roll_calls"
  DROP CONSTRAINT IF EXISTS "council_roll_calls_org_session_fk";
--> statement-breakpoint
ALTER TABLE "council_roll_calls"
  ADD CONSTRAINT "council_roll_calls_org_session_fk"
  FOREIGN KEY ("organization_id", "session_id")
  REFERENCES "council_sessions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "council_roll_calls"
  DROP CONSTRAINT IF EXISTS "council_roll_calls_org_recommendation_fk";
--> statement-breakpoint
ALTER TABLE "council_roll_calls"
  ADD CONSTRAINT "council_roll_calls_org_recommendation_fk"
  FOREIGN KEY ("organization_id", "recommendation_version_id")
  REFERENCES "council_recommendation_versions" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

ALTER TABLE "council_roll_calls"
  DROP CONSTRAINT IF EXISTS "council_roll_calls_org_appointment_fk";
--> statement-breakpoint
ALTER TABLE "council_roll_calls"
  ADD CONSTRAINT "council_roll_calls_org_appointment_fk"
  FOREIGN KEY ("organization_id", "appointment_id")
  REFERENCES "organization_appointments" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_chamber_session_parent_match()
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
    RAISE EXCEPTION 'chamber_sessions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_chamber_session_parent_match ON chamber_sessions;
--> statement-breakpoint
CREATE TRIGGER ostt_chamber_session_parent_match
  BEFORE INSERT OR UPDATE ON chamber_sessions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_chamber_session_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_chamber_verdict_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_org text;
  record_org text;
BEGIN
  SELECT organization_id INTO session_org
    FROM chamber_sessions
    WHERE id = NEW.session_id;
  SELECT organization_id INTO record_org
    FROM topic_governance_records
    WHERE id = NEW.topic_governance_record_id;
  IF session_org IS DISTINCT FROM NEW.organization_id
     OR record_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'chamber_verdict_versions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_chamber_verdict_parent_match ON chamber_verdict_versions;
--> statement-breakpoint
CREATE TRIGGER ostt_chamber_verdict_parent_match
  BEFORE INSERT OR UPDATE ON chamber_verdict_versions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_chamber_verdict_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_chamber_roll_call_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_org text;
  verdict_org text;
  appointment_org text;
BEGIN
  SELECT organization_id INTO session_org
    FROM chamber_sessions
    WHERE id = NEW.session_id;
  SELECT organization_id INTO verdict_org
    FROM chamber_verdict_versions
    WHERE id = NEW.verdict_version_id;
  SELECT organization_id INTO appointment_org
    FROM organization_appointments
    WHERE id = NEW.appointment_id;
  IF session_org IS DISTINCT FROM NEW.organization_id
     OR verdict_org IS DISTINCT FROM NEW.organization_id
     OR appointment_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'chamber_roll_calls parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_chamber_roll_call_parent_match ON chamber_roll_calls;
--> statement-breakpoint
CREATE TRIGGER ostt_chamber_roll_call_parent_match
  BEFORE INSERT OR UPDATE ON chamber_roll_calls
  FOR EACH ROW
  EXECUTE FUNCTION ostt_chamber_roll_call_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_council_session_parent_match()
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
    RAISE EXCEPTION 'council_sessions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_council_session_parent_match ON council_sessions;
--> statement-breakpoint
CREATE TRIGGER ostt_council_session_parent_match
  BEFORE INSERT OR UPDATE ON council_sessions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_council_session_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_council_recommendation_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_org text;
  record_org text;
BEGIN
  SELECT organization_id INTO session_org
    FROM council_sessions
    WHERE id = NEW.session_id;
  SELECT organization_id INTO record_org
    FROM topic_governance_records
    WHERE id = NEW.topic_governance_record_id;
  IF session_org IS DISTINCT FROM NEW.organization_id
     OR record_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'council_recommendation_versions parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_council_recommendation_parent_match ON council_recommendation_versions;
--> statement-breakpoint
CREATE TRIGGER ostt_council_recommendation_parent_match
  BEFORE INSERT OR UPDATE ON council_recommendation_versions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_council_recommendation_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_council_roll_call_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_org text;
  recommendation_org text;
  appointment_org text;
BEGIN
  SELECT organization_id INTO session_org
    FROM council_sessions
    WHERE id = NEW.session_id;
  SELECT organization_id INTO recommendation_org
    FROM council_recommendation_versions
    WHERE id = NEW.recommendation_version_id;
  SELECT organization_id INTO appointment_org
    FROM organization_appointments
    WHERE id = NEW.appointment_id;
  IF session_org IS DISTINCT FROM NEW.organization_id
     OR recommendation_org IS DISTINCT FROM NEW.organization_id
     OR appointment_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'council_roll_calls parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_council_roll_call_parent_match ON council_roll_calls;
--> statement-breakpoint
CREATE TRIGGER ostt_council_roll_call_parent_match
  BEFORE INSERT OR UPDATE ON council_roll_calls
  FOR EACH ROW
  EXECUTE FUNCTION ostt_council_roll_call_parent_match();
