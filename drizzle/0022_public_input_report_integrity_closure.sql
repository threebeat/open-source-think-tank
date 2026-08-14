-- Phase 4.5A.1 — Report integrity closure
-- Report-root transition matrix; child INSERT/UPDATE/DELETE guards with parent FOR UPDATE;
-- exact-count invalidation for legacy estimated backfills; suppression-policy + data provenance.
--
-- Rollback (manual, pre-release only): drop new triggers/functions/columns/enums carefully
-- after confirming no dependent code remains.

-- ---------------------------------------------------------------------------
-- Enums / columns: data provenance, count provenance, suppression snapshot
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."public_input_report_data_provenance" AS ENUM(
    'synthetic_fixture',
    'manual_aggregate'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."public_input_report_count_provenance" AS ENUM(
    'exact',
    'legacy_estimated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "public_input_report_imports"
  ADD COLUMN IF NOT EXISTS "data_provenance" "public_input_report_data_provenance";
--> statement-breakpoint

-- Critical-bug fix (4.5A.1 review): public_input_report_imports has carried a
-- blanket BEFORE UPDATE OR DELETE immutability trigger since 0020
-- (ostt_reject_mutation rejects every UPDATE unconditionally, regardless of
-- which columns change), so the one-time backfill below would otherwise
-- always fail. Disable it only for this single backfill statement and
-- re-enable it immediately after — no runtime code path gets a window to
-- mutate these rows.
ALTER TABLE "public_input_report_imports"
  DISABLE TRIGGER "public_input_report_imports_immutable";
--> statement-breakpoint

UPDATE "public_input_report_imports"
SET "data_provenance" = CASE
  WHEN "source_kind" = 'fixture' THEN 'synthetic_fixture'::"public_input_report_data_provenance"
  ELSE 'manual_aggregate'::"public_input_report_data_provenance"
END
WHERE "data_provenance" IS NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_imports"
  ENABLE TRIGGER "public_input_report_imports_immutable";
--> statement-breakpoint

ALTER TABLE "public_input_report_imports"
  ALTER COLUMN "data_provenance" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "data_provenance" "public_input_report_data_provenance";
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "requires_reimport" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "small_cell_policy_version" text;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "small_cell_algorithm_version" text;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "small_cell_threshold" integer;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD COLUMN IF NOT EXISTS "small_cell_min_participation" integer;
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ADD COLUMN IF NOT EXISTS "count_provenance" "public_input_report_count_provenance";
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ADD COLUMN IF NOT EXISTS "data_provenance" "public_input_report_data_provenance";
--> statement-breakpoint

ALTER TABLE "public_input_report_findings"
  ADD COLUMN IF NOT EXISTS "data_provenance" "public_input_report_data_provenance";
--> statement-breakpoint

-- Legacy 0021 FLOOR backfill is not exact — mark groups and force reimport.
UPDATE "public_input_report_groups" AS g
SET
  "count_provenance" = 'legacy_estimated'::"public_input_report_count_provenance",
  "data_provenance" = COALESCE(
    (
      SELECT CASE
        WHEN i."source_kind" = 'fixture' THEN 'synthetic_fixture'::"public_input_report_data_provenance"
        ELSE 'manual_aggregate'::"public_input_report_data_provenance"
      END
      FROM "public_input_reports" AS r
      JOIN "public_input_report_imports" AS i ON i."id" = r."import_id"
      WHERE r."id" = g."report_id"
    ),
    'manual_aggregate'::"public_input_report_data_provenance"
  )
WHERE g."count_provenance" IS NULL;
--> statement-breakpoint

UPDATE "public_input_reports" AS r
SET
  "requires_reimport" = true,
  "data_provenance" = COALESCE(
    (
      SELECT i."data_provenance"
      FROM "public_input_report_imports" AS i
      WHERE i."id" = r."import_id"
    ),
    'manual_aggregate'::"public_input_report_data_provenance"
  )
WHERE EXISTS (
  SELECT 1
  FROM "public_input_report_groups" AS g
  WHERE g."report_id" = r."id"
    AND g."count_provenance" = 'legacy_estimated'
)
OR EXISTS (
  SELECT 1
  FROM "public_input_report_imports" AS i
  WHERE i."id" = r."import_id"
    AND i."schema_version" IS DISTINCT FROM 'public-input-aggregate-import@1.1'
);
--> statement-breakpoint

UPDATE "public_input_reports" AS r
SET "data_provenance" = i."data_provenance"
FROM "public_input_report_imports" AS i
WHERE i."id" = r."import_id"
  AND r."data_provenance" IS NULL;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ALTER COLUMN "data_provenance" SET NOT NULL;
--> statement-breakpoint

UPDATE "public_input_report_findings" AS f
SET "data_provenance" = r."data_provenance"
FROM "public_input_reports" AS r
WHERE r."id" = f."report_id"
  AND f."data_provenance" IS NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ALTER COLUMN "count_provenance" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ALTER COLUMN "data_provenance" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_findings"
  ALTER COLUMN "data_provenance" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  DROP CONSTRAINT IF EXISTS "public_input_reports_small_cell_threshold_positive";
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD CONSTRAINT "public_input_reports_small_cell_threshold_positive"
  CHECK (
    "small_cell_threshold" IS NULL OR "small_cell_threshold" > 0
  );
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  DROP CONSTRAINT IF EXISTS "public_input_reports_small_cell_min_participation_positive";
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD CONSTRAINT "public_input_reports_small_cell_min_participation_positive"
  CHECK (
    "small_cell_min_participation" IS NULL OR "small_cell_min_participation" > 0
  );
--> statement-breakpoint

-- Invalidate legacy approximate-count / pre-@1.1 reports before publish-guard
-- CHECKs — estimated counts must never remain publicly projectable.
UPDATE "public_input_reports"
SET
  "is_latest_published" = false,
  "workflow_state" = 'rejected',
  "requires_reimport" = true,
  "updated_at" = NOW()
WHERE "requires_reimport" = true
  AND "workflow_state" IN ('published', 'superseded', 'under_review', 'validated', 'imported');
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  DROP CONSTRAINT IF EXISTS "public_input_reports_published_suppression_complete";
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD CONSTRAINT "public_input_reports_published_suppression_complete"
  CHECK (
    ("workflow_state" <> 'published' AND "workflow_state" <> 'superseded')
    OR (
      "small_cell_policy_version" IS NOT NULL
      AND "small_cell_algorithm_version" IS NOT NULL
      AND "small_cell_threshold" IS NOT NULL
      AND "small_cell_min_participation" IS NOT NULL
    )
  );
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  DROP CONSTRAINT IF EXISTS "public_input_reports_no_publish_when_reimport_required";
--> statement-breakpoint

ALTER TABLE "public_input_reports"
  ADD CONSTRAINT "public_input_reports_no_publish_when_reimport_required"
  CHECK (
    (NOT "requires_reimport")
    OR ("workflow_state" <> 'published' AND "workflow_state" <> 'superseded')
  );
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Report-root transition matrix + immutable content columns
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ostt_public_input_report_root_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'public_input_reports rows cannot be deleted outside alpha reset'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.import_id IS DISTINCT FROM OLD.import_id
      OR NEW.topic_id IS DISTINCT FROM OLD.topic_id
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.public_title IS DISTINCT FROM OLD.public_title
      OR NEW.importer_account_id IS DISTINCT FROM OLD.importer_account_id
      OR NEW.synthetic IS DISTINCT FROM OLD.synthetic
      OR NEW.data_provenance IS DISTINCT FROM OLD.data_provenance
      OR NEW.requires_reimport IS DISTINCT FROM OLD.requires_reimport
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'public_input_reports immutable columns cannot change'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.workflow_state IS DISTINCT FROM OLD.workflow_state THEN
      allowed :=
        (OLD.workflow_state = 'imported' AND NEW.workflow_state IN ('validated', 'rejected'))
        OR (OLD.workflow_state = 'validated' AND NEW.workflow_state IN ('under_review', 'rejected'))
        OR (OLD.workflow_state = 'under_review' AND NEW.workflow_state IN ('published', 'rejected'))
        OR (OLD.workflow_state = 'published' AND NEW.workflow_state = 'superseded');
      IF NOT allowed THEN
        RAISE EXCEPTION 'illegal public_input_reports workflow transition % -> %',
          OLD.workflow_state, NEW.workflow_state
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;

    -- Suppression provenance may be written only on the under_review → published transition.
    IF NEW.small_cell_policy_version IS DISTINCT FROM OLD.small_cell_policy_version
      OR NEW.small_cell_algorithm_version IS DISTINCT FROM OLD.small_cell_algorithm_version
      OR NEW.small_cell_threshold IS DISTINCT FROM OLD.small_cell_threshold
      OR NEW.small_cell_min_participation IS DISTINCT FROM OLD.small_cell_min_participation
    THEN
      IF NOT (
        OLD.workflow_state = 'under_review'
        AND NEW.workflow_state = 'published'
      ) THEN
        RAISE EXCEPTION 'suppression provenance may be set only when publishing'
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS public_input_reports_root_guard ON public_input_reports;
--> statement-breakpoint

CREATE TRIGGER public_input_reports_root_guard
  BEFORE UPDATE OR DELETE ON public_input_reports
  FOR EACH ROW
  EXECUTE FUNCTION ostt_public_input_report_root_guard();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Child guards: INSERT/UPDATE/DELETE with parent row lock
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ostt_public_input_report_finding_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_state text;
  parent_id text;
BEGIN
  parent_id := COALESCE(NEW.report_id, OLD.report_id);

  -- Serialize against publish / workflow transitions.
  SELECT workflow_state INTO parent_state
    FROM public_input_reports
    WHERE id = parent_id
    FOR UPDATE;

  IF parent_state IS NULL THEN
    RAISE EXCEPTION 'public_input_report_findings parent report missing'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF parent_state IS DISTINCT FROM 'imported' THEN
      RAISE EXCEPTION 'findings may be inserted only while report is imported (found %)',
        parent_state
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'public_input_report_findings cannot be deleted outside alpha reset'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.statement_text IS DISTINCT FROM OLD.statement_text
      OR NEW.kind IS DISTINCT FROM OLD.kind
      OR NEW.display_order IS DISTINCT FROM OLD.display_order
      OR NEW.report_id IS DISTINCT FROM OLD.report_id
      OR NEW.synthetic IS DISTINCT FROM OLD.synthetic
      OR NEW.data_provenance IS DISTINCT FROM OLD.data_provenance
    THEN
      RAISE EXCEPTION 'public_input_report_findings content columns are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.publication_status IS DISTINCT FROM OLD.publication_status THEN
      IF parent_state IS DISTINCT FROM 'under_review' THEN
        RAISE EXCEPTION 'finding publication_status may change only while report is under_review (found %)',
          parent_state
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS public_input_report_findings_guard ON public_input_report_findings;
--> statement-breakpoint

CREATE TRIGGER public_input_report_findings_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public_input_report_findings
  FOR EACH ROW
  EXECUTE FUNCTION ostt_public_input_report_finding_guard();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_public_input_report_group_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_state text;
  parent_id text;
BEGIN
  parent_id := COALESCE(NEW.report_id, OLD.report_id);

  SELECT workflow_state INTO parent_state
    FROM public_input_reports
    WHERE id = parent_id
    FOR UPDATE;

  IF parent_state IS NULL THEN
    RAISE EXCEPTION 'public_input_report_groups parent report missing'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF parent_state IS DISTINCT FROM 'imported' THEN
      RAISE EXCEPTION 'groups may be inserted only while report is imported (found %)',
        parent_state
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.count_provenance IS DISTINCT FROM 'exact' THEN
      RAISE EXCEPTION 'new report groups must use exact count_provenance'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'public_input_report_groups cannot be deleted outside alpha reset'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.label IS DISTINCT FROM OLD.label
      OR NEW.display_order IS DISTINCT FROM OLD.display_order
      OR NEW.raw_share IS DISTINCT FROM OLD.raw_share
      OR NEW.participant_count IS DISTINCT FROM OLD.participant_count
      OR NEW.report_id IS DISTINCT FROM OLD.report_id
      OR NEW.synthetic IS DISTINCT FROM OLD.synthetic
      OR NEW.count_provenance IS DISTINCT FROM OLD.count_provenance
      OR NEW.data_provenance IS DISTINCT FROM OLD.data_provenance
    THEN
      RAISE EXCEPTION 'public_input_report_groups content columns are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.published_status IS DISTINCT FROM OLD.published_status
      OR NEW.published_share IS DISTINCT FROM OLD.published_share
    THEN
      IF parent_state IS DISTINCT FROM 'under_review' THEN
        RAISE EXCEPTION 'group published_* fields may change only while report is under_review (found %)',
          parent_state
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS public_input_report_groups_guard ON public_input_report_groups;
--> statement-breakpoint

CREATE TRIGGER public_input_report_groups_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public_input_report_groups
  FOR EACH ROW
  EXECUTE FUNCTION ostt_public_input_report_group_guard();
