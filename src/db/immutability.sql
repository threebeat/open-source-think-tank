-- Prevent ordinary UPDATEs/DELETEs on immutable assent and audit rows.
-- Applied after Drizzle migrations in local/ephemeral setups (Work Package 2.3).

CREATE OR REPLACE FUNCTION ostt_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS assent_records_immutable ON assent_records;
CREATE TRIGGER assent_records_immutable
  BEFORE UPDATE OR DELETE ON assent_records
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
