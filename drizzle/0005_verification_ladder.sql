ALTER TYPE "public"."verification_case_status" ADD VALUE IF NOT EXISTS 'revoked';--> statement-breakpoint
ALTER TABLE "verification_cases" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_cases" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_cases" ADD COLUMN "synthetic" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE "verification_artifact_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD CONSTRAINT "verification_artifact_holds_case_id_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."verification_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_artifact_holds_case_idx" ON "verification_artifact_holds" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "verification_artifact_holds_expires_idx" ON "verification_artifact_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_cases_one_open_per_account_kind_uidx" ON "verification_cases" USING btree ("account_id","kind") WHERE "verification_cases"."status" IN ('pending', 'approved', 'appealed');--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_terminal_needs_reason" CHECK (("verification_cases"."status" IN ('pending', 'appealed')) OR (("verification_cases"."decision_reason" IS NOT NULL) AND (length(btrim("verification_cases"."decision_reason")) > 0)));--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_decided_needs_timestamp" CHECK (("verification_cases"."status" IN ('pending', 'appealed')) OR ("verification_cases"."decided_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD CONSTRAINT "verification_artifact_holds_purpose_nonempty" CHECK (length(btrim("verification_artifact_holds"."purpose")) > 0);
