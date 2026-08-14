-- Commonhall v2 Phase 1 — organization-scoped foundation and institutional kernel.
-- Adds tenancy, appointments, versioned config, and composed governance records
-- alongside existing single-institution tables. Does not relabel legacy council
-- seats or alpha accounts as v2 authority. Does not invent production thresholds.
--
-- Rollback (manual, disposable databases only — never against ostt_dev):
--   DROP TRIGGER IF EXISTS topic_governance_events_immutable ON topic_governance_events;
--   DROP TRIGGER IF EXISTS organization_membership_events_immutable ON organization_membership_events;
--   DROP TRIGGER IF EXISTS ostt_membership_event_parent_match ON organization_membership_events;
--   DROP TRIGGER IF EXISTS ostt_appointment_conflict_parent_match ON appointment_conflicts_and_recusals;
--   DROP TRIGGER IF EXISTS ostt_governance_event_parent_match ON topic_governance_events;
--   DROP FUNCTION IF EXISTS ostt_membership_event_parent_match();
--   DROP FUNCTION IF EXISTS ostt_appointment_conflict_parent_match();
--   DROP FUNCTION IF EXISTS ostt_governance_event_parent_match();
--   ALTER TABLE audit_events DROP COLUMN IF EXISTS projection_class;
--   ALTER TABLE audit_events DROP COLUMN IF EXISTS capability;
--   ALTER TABLE audit_events DROP COLUMN IF EXISTS actor_principal_kind;
--   ALTER TABLE audit_events DROP COLUMN IF EXISTS organization_id;
--   DROP TABLE IF EXISTS appointment_conflicts_and_recusals;
--   DROP TABLE IF EXISTS topic_governance_events;
--   DROP TABLE IF EXISTS topic_governance_records;
--   DROP TABLE IF EXISTS organization_appointments;
--   DROP TABLE IF EXISTS organization_membership_events;
--   DROP TABLE IF EXISTS organization_memberships;
--   DROP TABLE IF EXISTS organization_config_versions;
--   DROP TABLE IF EXISTS organization_service_areas;
--   DROP TABLE IF EXISTS organizations;
--   DROP TYPE IF EXISTS topic_governance_action;
--   DROP TYPE IF EXISTS topic_governance_state;
--   DROP TYPE IF EXISTS audit_projection_class;
--   DROP TYPE IF EXISTS actor_principal_kind;
--   DROP TYPE IF EXISTS appointment_conflict_kind;
--   DROP TYPE IF EXISTS organization_appointment_kind;
--   DROP TYPE IF EXISTS organization_membership_event_kind;
--   DROP TYPE IF EXISTS organization_membership_status;
--   DROP TYPE IF EXISTS organization_config_status;
--   DROP TYPE IF EXISTS organization_service_status;

DO $$ BEGIN
  CREATE TYPE "public"."organization_service_status" AS ENUM(
    'proposed',
    'seeded_synthetic',
    'disabled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."organization_config_status" AS ENUM(
    'draft',
    'published',
    'superseded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."organization_membership_status" AS ENUM(
    'assigned',
    'active',
    'suspended',
    'closed',
    'appeal_pending'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."organization_membership_event_kind" AS ENUM(
    'assignment',
    'activation',
    'transfer',
    'suspension',
    'closure',
    'correction',
    'appeal_opened',
    'appeal_resolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."organization_appointment_kind" AS ENUM(
    'chamber_member',
    'chamber_clerk',
    'council_member',
    'council_clerk',
    'moderator',
    'organization_admin'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."appointment_conflict_kind" AS ENUM(
    'conflict',
    'recusal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."actor_principal_kind" AS ENUM(
    'service_operator',
    'organization_officer',
    'community_member',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."audit_projection_class" AS ENUM(
    'public',
    'protected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."topic_governance_state" AS ENUM(
    'informal_draft',
    'formal_review_pending',
    'qualified_consultation',
    'community_accepted',
    'community_disputed',
    'consultation_inconclusive',
    'chamber_queued',
    'chamber_deliberating',
    'chamber_accepted',
    'chamber_disputed',
    'council_scheduled',
    'council_deliberating',
    'recommendations_published',
    'council_declined',
    'honorably_disqualified',
    'dishonorably_disqualified'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."topic_governance_action" AS ENUM(
    'submit_for_formal_review',
    'return_for_revision',
    'qualify',
    'remove_for_serious_breach',
    'close_as_accepted',
    'close_as_disputed',
    'close_as_inconclusive',
    'queue_for_chamber',
    'start_chamber_deliberation',
    'record_chamber_acceptance',
    'record_chamber_dispute',
    'accept_to_council_agenda',
    'decline_council_intake',
    'accept_disputed_to_council_agenda',
    'decline_disputed_council_intake',
    'start_council_deliberation',
    'publish_recommendations',
    'expire_disputed',
    'expire_inconclusive',
    'expire_council_declined',
    'disqualify_for_serious_breach',
    'disqualify_chamber_topic_for_serious_breach',
    'disqualify_deliberating_topic_for_serious_breach'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "public_id" text NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "service_status" "organization_service_status" NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_public_id_unique" UNIQUE("public_id"),
  CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
  CONSTRAINT "organizations_slug_nonblank" CHECK (char_length(btrim("slug")) > 0),
  CONSTRAINT "organizations_display_name_nonblank" CHECK (char_length(btrim("display_name")) > 0),
  CONSTRAINT "organizations_public_id_nonblank" CHECK (char_length(btrim("public_id")) > 0)
);
--> statement-breakpoint

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_service_areas" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "region_code" text NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_service_areas_region_nonblank" CHECK (char_length(btrim("region_code")) > 0),
  CONSTRAINT "organization_service_areas_region_coarse" CHECK ("region_code" ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_service_areas_org_region_uidx"
  ON "organization_service_areas" USING btree ("organization_id", "region_code");
--> statement-breakpoint

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_config_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "version" integer NOT NULL,
  "constitutional_floor_version" text NOT NULL,
  "config" jsonb NOT NULL,
  "status" "organization_config_status" NOT NULL,
  "published_at" timestamp with time zone,
  "published_by_account_id" text REFERENCES "accounts"("id") ON DELETE restrict,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_config_versions_version_positive" CHECK ("version" > 0),
  CONSTRAINT "organization_config_versions_floor_nonblank" CHECK (char_length(btrim("constitutional_floor_version")) > 0),
  CONSTRAINT "organization_config_hosted_polis_disabled" CHECK (("config"->>'hostedPolisEnabled') IS DISTINCT FROM 'true'),
  CONSTRAINT "organization_config_published_metadata" CHECK (
    ("status" <> 'published')
    OR ("published_at" IS NOT NULL AND "published_by_account_id" IS NOT NULL)
  ),
  CONSTRAINT "organization_config_versions_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_config_versions_org_version_uidx"
  ON "organization_config_versions" USING btree ("organization_id", "version");
--> statement-breakpoint

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "status" "organization_membership_status" NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false,
  "assigned_at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_memberships_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_memberships_active_account_uidx"
  ON "organization_memberships" USING btree ("organization_id", "account_id")
  WHERE "status" <> 'closed';
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_memberships_one_primary_uidx"
  ON "organization_memberships" USING btree ("account_id")
  WHERE "is_primary" AND "status" IN ('assigned', 'active');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_membership_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "membership_id" text NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "event_kind" "organization_membership_event_kind" NOT NULL,
  "actor_principal_kind" "actor_principal_kind" NOT NULL,
  "actor_account_id" text REFERENCES "accounts"("id") ON DELETE restrict,
  "reason" text,
  "rule_version" text NOT NULL,
  "at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_membership_events_rule_nonblank" CHECK (char_length(btrim("rule_version")) > 0),
  CONSTRAINT "organization_membership_events_org_membership_fk"
    FOREIGN KEY ("organization_id", "membership_id")
    REFERENCES "organization_memberships" ("organization_id", "id")
    ON DELETE restrict
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_membership_events_membership_idx"
  ON "organization_membership_events" USING btree ("organization_id", "membership_id", "at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_appointments" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "appointment_kind" "organization_appointment_kind" NOT NULL,
  "term_starts_at" timestamp with time zone NOT NULL,
  "term_ends_at" timestamp with time zone,
  "issued_by_account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "issued_by_principal_kind" "actor_principal_kind" NOT NULL,
  "revoked_at" timestamp with time zone,
  "revocation_reason" text,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_appointments_no_self_grant" CHECK ("issued_by_account_id" <> "account_id"),
  CONSTRAINT "organization_appointments_term_order" CHECK (
    "term_ends_at" IS NULL OR "term_ends_at" > "term_starts_at"
  ),
  CONSTRAINT "organization_appointments_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_appointments_active_kind_uidx"
  ON "organization_appointments" USING btree ("organization_id", "account_id", "appointment_kind")
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "topic_governance_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "public_id" text NOT NULL,
  "state" "topic_governance_state" NOT NULL,
  "config_version_id" text NOT NULL,
  "author_account_id" text REFERENCES "accounts"("id") ON DELETE restrict,
  "retention_deadline_at" timestamp with time zone,
  "legacy_topic_id" text REFERENCES "topics"("id") ON DELETE restrict,
  "predecessor_record_id" text,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "topic_governance_records_public_id_nonblank" CHECK (char_length(btrim("public_id")) > 0),
  CONSTRAINT "topic_governance_records_org_config_fk"
    FOREIGN KEY ("organization_id", "config_version_id")
    REFERENCES "organization_config_versions" ("organization_id", "id")
    ON DELETE restrict,
  CONSTRAINT "topic_governance_records_org_id_key" UNIQUE ("organization_id", "id")
);
--> statement-breakpoint

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "topic_governance_records_org_public_id_uidx"
  ON "topic_governance_records" USING btree ("organization_id", "public_id");
--> statement-breakpoint

ALTER TABLE "topic_governance_records"
  ADD CONSTRAINT "topic_governance_records_predecessor_fk"
  FOREIGN KEY ("organization_id", "predecessor_record_id")
  REFERENCES "topic_governance_records" ("organization_id", "id")
  ON DELETE restrict;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "topic_governance_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "record_id" text NOT NULL,
  "from_state" "topic_governance_state" NOT NULL,
  "to_state" "topic_governance_state" NOT NULL,
  "action" "topic_governance_action" NOT NULL,
  "actor_principal_kind" "actor_principal_kind" NOT NULL,
  "actor_account_id" text REFERENCES "accounts"("id") ON DELETE restrict,
  "reason" text,
  "criteria_trace" jsonb,
  "metrics_snapshot" jsonb,
  "config_version_id" text NOT NULL,
  "rule_version" text NOT NULL,
  "at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "topic_governance_events_rule_nonblank" CHECK (char_length(btrim("rule_version")) > 0),
  CONSTRAINT "topic_governance_events_org_record_fk"
    FOREIGN KEY ("organization_id", "record_id")
    REFERENCES "topic_governance_records" ("organization_id", "id")
    ON DELETE restrict,
  CONSTRAINT "topic_governance_events_org_config_fk"
    FOREIGN KEY ("organization_id", "config_version_id")
    REFERENCES "organization_config_versions" ("organization_id", "id")
    ON DELETE restrict
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "topic_governance_events_record_idx"
  ON "topic_governance_events" USING btree ("organization_id", "record_id", "at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "appointment_conflicts_and_recusals" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "appointment_id" text NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "kind" "appointment_conflict_kind" NOT NULL,
  "topic_governance_record_id" text,
  "reason" text NOT NULL,
  "at" timestamp with time zone NOT NULL,
  "synthetic" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "appointment_conflicts_reason_nonblank" CHECK (char_length(btrim("reason")) > 0),
  CONSTRAINT "appointment_conflicts_org_appointment_fk"
    FOREIGN KEY ("organization_id", "appointment_id")
    REFERENCES "organization_appointments" ("organization_id", "id")
    ON DELETE restrict,
  CONSTRAINT "appointment_conflicts_org_topic_fk"
    FOREIGN KEY ("organization_id", "topic_governance_record_id")
    REFERENCES "topic_governance_records" ("organization_id", "id")
    ON DELETE restrict
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "appointment_conflicts_appointment_idx"
  ON "appointment_conflicts_and_recusals" USING btree ("organization_id", "appointment_id");
--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "organization_id" text REFERENCES "organizations"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "actor_principal_kind" "actor_principal_kind";
--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "capability" text;
--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "projection_class" "audit_projection_class";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_events_organization_idx"
  ON "audit_events" USING btree ("organization_id");
--> statement-breakpoint

-- Parent-match triggers: reject org A parent id with org B organization_id even
-- if a caller bypasses composite FKs (defense in depth).
CREATE OR REPLACE FUNCTION ostt_membership_event_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
  parent_account text;
BEGIN
  SELECT organization_id, account_id INTO parent_org, parent_account
    FROM organization_memberships
    WHERE id = NEW.membership_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id
    OR parent_account IS DISTINCT FROM NEW.account_id THEN
    RAISE EXCEPTION 'organization_membership_events parent organization/account mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_membership_event_parent_match ON organization_membership_events;
--> statement-breakpoint
CREATE TRIGGER ostt_membership_event_parent_match
  BEFORE INSERT ON organization_membership_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_membership_event_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_appointment_conflict_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
  parent_account text;
BEGIN
  SELECT organization_id, account_id INTO parent_org, parent_account
    FROM organization_appointments
    WHERE id = NEW.appointment_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id
    OR parent_account IS DISTINCT FROM NEW.account_id THEN
    RAISE EXCEPTION 'appointment_conflicts_and_recusals parent organization/account mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_appointment_conflict_parent_match ON appointment_conflicts_and_recusals;
--> statement-breakpoint
CREATE TRIGGER ostt_appointment_conflict_parent_match
  BEFORE INSERT ON appointment_conflicts_and_recusals
  FOR EACH ROW
  EXECUTE FUNCTION ostt_appointment_conflict_parent_match();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_governance_event_parent_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org text;
BEGIN
  SELECT organization_id INTO parent_org
    FROM topic_governance_records
    WHERE id = NEW.record_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'topic_governance_events parent organization mismatch'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ostt_governance_event_parent_match ON topic_governance_events;
--> statement-breakpoint
CREATE TRIGGER ostt_governance_event_parent_match
  BEFORE INSERT ON topic_governance_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_governance_event_parent_match();
--> statement-breakpoint

DROP TRIGGER IF EXISTS organization_membership_events_immutable ON organization_membership_events;
--> statement-breakpoint
CREATE TRIGGER organization_membership_events_immutable
  BEFORE UPDATE OR DELETE ON organization_membership_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
--> statement-breakpoint

DROP TRIGGER IF EXISTS topic_governance_events_immutable ON topic_governance_events;
--> statement-breakpoint
CREATE TRIGGER topic_governance_events_immutable
  BEFORE UPDATE OR DELETE ON topic_governance_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
