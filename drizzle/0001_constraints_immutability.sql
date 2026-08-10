ALTER TABLE "accounts" DROP CONSTRAINT "accounts_active_requires_activation_timestamp";--> statement-breakpoint
ALTER TABLE "assent_records" DROP CONSTRAINT "assent_records_document_version_id_document_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "verification_assertions" DROP CONSTRAINT "verification_assertions_case_id_verification_cases_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_id_hash_uidx" ON "document_versions" USING btree ("id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_cases_id_kind_uidx" ON "verification_cases" USING btree ("id","kind");--> statement-breakpoint
ALTER TABLE "assent_records" ADD CONSTRAINT "assent_records_document_hash_fk" FOREIGN KEY ("document_version_id","content_hash") REFERENCES "public"."document_versions"("id","content_hash") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_assertions" ADD CONSTRAINT "verification_assertions_case_kind_fk" FOREIGN KEY ("case_id","kind") REFERENCES "public"."verification_cases"("id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_lifecycle_timestamps_consistent" CHECK ((
        ("accounts"."lifecycle_state" = 'invited' AND "accounts"."contact_verified_at" IS NULL AND "accounts"."activated_at" IS NULL AND "accounts"."suspended_at" IS NULL AND "accounts"."closed_at" IS NULL)
        OR ("accounts"."lifecycle_state" = 'pending_onboarding' AND "accounts"."contact_verified_at" IS NOT NULL AND "accounts"."activated_at" IS NULL AND "accounts"."suspended_at" IS NULL AND "accounts"."closed_at" IS NULL)
        OR ("accounts"."lifecycle_state" = 'active' AND "accounts"."contact_verified_at" IS NOT NULL AND "accounts"."activated_at" IS NOT NULL AND "accounts"."suspended_at" IS NULL AND "accounts"."closed_at" IS NULL)
        OR ("accounts"."lifecycle_state" = 'suspended' AND "accounts"."contact_verified_at" IS NOT NULL AND "accounts"."activated_at" IS NOT NULL AND "accounts"."suspended_at" IS NOT NULL AND "accounts"."closed_at" IS NULL)
        OR ("accounts"."lifecycle_state" = 'closed' AND "accounts"."closed_at" IS NOT NULL)
        OR ("accounts"."lifecycle_state" = 'anonymization-pending' AND "accounts"."closed_at" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_requires_account_and_timestamp" CHECK ((
        ("invitations"."status" <> 'accepted')
        OR (
          "invitations"."accepted_at" IS NOT NULL
          AND "invitations"."accepted_account_id" IS NOT NULL
        )
      ));--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_pending_has_no_acceptance" CHECK ((
        ("invitations"."status" <> 'pending')
        OR (
          "invitations"."accepted_at" IS NULL
          AND "invitations"."accepted_account_id" IS NULL
        )
      ));--> statement-breakpoint
-- Immutability + assent publication gates (tracked migration history; Work Package 2.3 feedback).
CREATE OR REPLACE FUNCTION ostt_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS assent_records_immutable ON assent_records;--> statement-breakpoint
CREATE TRIGGER assent_records_immutable
  BEFORE UPDATE OR DELETE ON assent_records
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION ostt_assent_requires_published_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc_state text;
BEGIN
  SELECT state INTO doc_state
  FROM document_versions
  WHERE id = NEW.document_version_id;

  IF doc_state IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'assent_records require a published document_versions row (found state %)',
      COALESCE(doc_state, 'missing')
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS assent_records_require_published ON assent_records;--> statement-breakpoint
CREATE TRIGGER assent_records_require_published
  BEFORE INSERT ON assent_records
  FOR EACH ROW
  EXECUTE FUNCTION ostt_assent_requires_published_document();
