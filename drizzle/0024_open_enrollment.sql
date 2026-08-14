-- Commonhall v2 Phase 2 — open enrollment credentials and assignment.
-- Adds local password credentials and an enrollment-kind marker. Does not add
-- email-vendor tables, identity proof, or elevated authority. Passwords are
-- stored as scrypt hashes only and must never appear in logs, URLs, or public
-- DTOs.
--
-- Rollback (manual, disposable databases only — never against ostt_dev):
--   DROP TABLE IF EXISTS account_credentials;
--   ALTER TABLE accounts DROP COLUMN IF EXISTS enrollment_kind;
--   DROP TYPE IF EXISTS account_enrollment_kind;

DO $$ BEGIN
  CREATE TYPE "public"."account_enrollment_kind" AS ENUM('invite', 'open');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "enrollment_kind" "account_enrollment_kind" DEFAULT 'invite' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "account_credentials" (
  "account_id" text PRIMARY KEY NOT NULL,
  "password_hash" text NOT NULL,
  "password_scheme" text NOT NULL,
  "rotated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "account_credentials" DROP CONSTRAINT IF EXISTS "account_credentials_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "account_credentials" ADD CONSTRAINT "account_credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "account_credentials" DROP CONSTRAINT IF EXISTS "account_credentials_scheme_scrypt";
--> statement-breakpoint
ALTER TABLE "account_credentials" ADD CONSTRAINT "account_credentials_scheme_scrypt" CHECK ("password_scheme" = 'scrypt_n32768');
--> statement-breakpoint

ALTER TABLE "account_credentials" DROP CONSTRAINT IF EXISTS "account_credentials_hash_nonblank";
--> statement-breakpoint
ALTER TABLE "account_credentials" ADD CONSTRAINT "account_credentials_hash_nonblank" CHECK (char_length(btrim("password_hash")) > 0);
