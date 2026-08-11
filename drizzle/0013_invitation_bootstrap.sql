-- Phase 3.3 invitation provenance + first-administrator bootstrap singleton.

CREATE TYPE "public"."invitation_kind" AS ENUM('participant', 'administrator_bootstrap');
--> statement-breakpoint
CREATE TYPE "public"."operator_bootstrap_status" AS ENUM('not_started', 'invitation_live', 'completed');
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "kind" "invitation_kind" DEFAULT 'participant' NOT NULL;
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "issued_by_account_id" text;
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "synthetic" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_issued_by_account_id_accounts_id_fk" FOREIGN KEY ("issued_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invitations_kind_status_idx" ON "invitations" USING btree ("kind","status");
--> statement-breakpoint
CREATE INDEX "invitations_issued_by_account_idx" ON "invitations" USING btree ("issued_by_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_one_live_bootstrap_uidx" ON "invitations" USING btree ("kind") WHERE "kind" = 'administrator_bootstrap' AND "status" = 'pending';
--> statement-breakpoint
CREATE TABLE "operator_bootstrap_state" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "operator_bootstrap_status" DEFAULT 'not_started' NOT NULL,
	"live_invitation_id" text,
	"completed_account_id" text,
	"completed_at" timestamp with time zone,
	"last_operator_label" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operator_bootstrap_state" ADD CONSTRAINT "operator_bootstrap_state_live_invitation_id_invitations_id_fk" FOREIGN KEY ("live_invitation_id") REFERENCES "public"."invitations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "operator_bootstrap_state" ADD CONSTRAINT "operator_bootstrap_state_completed_account_id_accounts_id_fk" FOREIGN KEY ("completed_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "operator_bootstrap_state" ("id", "status") VALUES ('default', 'not_started');
