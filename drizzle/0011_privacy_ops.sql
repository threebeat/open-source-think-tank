CREATE TYPE "public"."deletion_request_status" AS ENUM('pending', 'approved_pending_hold', 'closed', 'cancelled', 'blocked_by_hold');
--> statement-breakpoint
CREATE TYPE "public"."dual_control_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'executed');
--> statement-breakpoint
CREATE TABLE "retention_policy_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" jsonb NOT NULL,
	"provisional" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"status" "deletion_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"synthetic" boolean DEFAULT true NOT NULL,
	CONSTRAINT "account_deletion_requests_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "account_deletion_requests_reason_nonempty" CHECK (length(btrim("reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_one_open_uidx" ON "account_deletion_requests" USING btree ("account_id") WHERE "status" IN ('pending', 'approved_pending_hold', 'blocked_by_hold');
--> statement-breakpoint
CREATE TABLE "legal_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"reason" text NOT NULL,
	"placed_by_account_id" text NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_account_id" text,
	"synthetic" boolean DEFAULT true NOT NULL,
	CONSTRAINT "legal_holds_placed_by_fk" FOREIGN KEY ("placed_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "legal_holds_reason_nonempty" CHECK (length(btrim("reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_holds_active_subject_uidx" ON "legal_holds" USING btree ("subject_type","subject_id") WHERE "released_at" IS NULL;
--> statement-breakpoint
CREATE TABLE "dual_control_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "dual_control_status" DEFAULT 'pending' NOT NULL,
	"requested_by_account_id" text NOT NULL,
	"approved_by_account_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dual_control_requests_requester_fk" FOREIGN KEY ("requested_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "dual_control_requests_approver_fk" FOREIGN KEY ("approved_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "dual_control_requests_reason_nonempty" CHECK (length(btrim("reason")) > 0),
	CONSTRAINT "dual_control_requests_distinct_actors" CHECK (
		"approved_by_account_id" IS NULL OR "approved_by_account_id" <> "requested_by_account_id"
	)
);
--> statement-breakpoint
INSERT INTO "retention_policy_settings" ("key", "value_json", "provisional", "updated_by_label") VALUES
	('verification_artifact_ttl_ms', '604800000'::jsonb, true, 'ostt-synth-2.11-seed'),
	('pseudonym_expire_job_enabled', 'true'::jsonb, true, 'ostt-synth-2.11-seed'),
	('auth_challenge_ttl_ms', '3600000'::jsonb, true, 'ostt-synth-2.11-seed');
