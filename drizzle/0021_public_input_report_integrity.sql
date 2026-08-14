-- Phase 4.5A — Public Input report integrity remediation
-- (finding immutability after publish, exact participant counts, child-row locks).
--
-- Rollback (manual, if ever needed before release):
--   DROP TRIGGER IF EXISTS public_input_report_findings_guard ON public_input_report_findings;
--   DROP TRIGGER IF EXISTS public_input_report_groups_guard ON public_input_report_groups;
--   DROP FUNCTION IF EXISTS ostt_public_input_report_finding_guard();
--   DROP FUNCTION IF EXISTS ostt_public_input_report_group_guard();
--   ALTER TABLE public_input_report_groups DROP CONSTRAINT IF EXISTS public_input_report_groups_participant_count_nonnegative;
--   ALTER TABLE public_input_report_groups DROP COLUMN IF EXISTS participant_count;

ALTER TABLE "public_input_report_groups"
  ADD COLUMN IF NOT EXISTS "participant_count" integer;
--> statement-breakpoint

-- Alpha environments: derive exact counts from stored share × participation when
-- backfilling any rows created under 4.4 float-share imports. Use floor so a
-- sub-threshold cell cannot round upward across the privacy threshold.
UPDATE "public_input_report_groups" AS g
SET "participant_count" = FLOOR(g."raw_share" * i."participation_count")::integer
FROM "public_input_reports" AS r
JOIN "public_input_report_imports" AS i ON i."id" = r."import_id"
WHERE g."report_id" = r."id"
  AND g."participant_count" IS NULL;
--> statement-breakpoint

UPDATE "public_input_report_groups"
SET "participant_count" = 0
WHERE "participant_count" IS NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ALTER COLUMN "participant_count" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "public_input_report_groups"
  ADD CONSTRAINT "public_input_report_groups_participant_count_nonnegative"
  CHECK ("participant_count" >= 0);
--> statement-breakpoint

-- Findings/groups: statement text, kind, order, label, raw share, and participant
-- count are immutable after insert. publication_status / published_* may change
-- only while the parent report is under_review (pre-publication).
CREATE OR REPLACE FUNCTION ostt_public_input_report_finding_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_state text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.statement_text IS DISTINCT FROM OLD.statement_text
      OR NEW.kind IS DISTINCT FROM OLD.kind
      OR NEW.display_order IS DISTINCT FROM OLD.display_order
      OR NEW.report_id IS DISTINCT FROM OLD.report_id
      OR NEW.synthetic IS DISTINCT FROM OLD.synthetic
    THEN
      RAISE EXCEPTION 'public_input_report_findings content columns are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.publication_status IS DISTINCT FROM OLD.publication_status THEN
      SELECT workflow_state INTO parent_state
        FROM public_input_reports
        WHERE id = NEW.report_id;
      IF parent_state IS DISTINCT FROM 'under_review' THEN
        RAISE EXCEPTION 'finding publication_status may change only while report is under_review (found %)',
          COALESCE(parent_state, 'missing')
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
  BEFORE UPDATE ON public_input_report_findings
  FOR EACH ROW
  EXECUTE FUNCTION ostt_public_input_report_finding_guard();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ostt_public_input_report_group_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_state text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.label IS DISTINCT FROM OLD.label
      OR NEW.display_order IS DISTINCT FROM OLD.display_order
      OR NEW.raw_share IS DISTINCT FROM OLD.raw_share
      OR NEW.participant_count IS DISTINCT FROM OLD.participant_count
      OR NEW.report_id IS DISTINCT FROM OLD.report_id
      OR NEW.synthetic IS DISTINCT FROM OLD.synthetic
    THEN
      RAISE EXCEPTION 'public_input_report_groups content columns are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.published_status IS DISTINCT FROM OLD.published_status
      OR NEW.published_share IS DISTINCT FROM OLD.published_share
    THEN
      SELECT workflow_state INTO parent_state
        FROM public_input_reports
        WHERE id = NEW.report_id;
      IF parent_state IS DISTINCT FROM 'under_review' THEN
        RAISE EXCEPTION 'group published_* fields may change only while report is under_review (found %)',
          COALESCE(parent_state, 'missing')
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
  BEFORE UPDATE ON public_input_report_groups
  FOR EACH ROW
  EXECUTE FUNCTION ostt_public_input_report_group_guard();
