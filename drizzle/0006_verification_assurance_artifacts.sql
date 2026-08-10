CREATE TABLE "verification_artifact_payloads" (
	"hold_id" text PRIMARY KEY NOT NULL,
	"payload" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD COLUMN "assertion_id" text;--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD COLUMN "retention_policy" text DEFAULT 'ttl-24h' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_artifact_payloads" ADD CONSTRAINT "verification_artifact_payloads_hold_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."verification_artifact_holds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD CONSTRAINT "verification_artifact_holds_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."verification_assertions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_artifact_holds" ADD CONSTRAINT "verification_artifact_holds_retention_nonempty" CHECK (length(btrim("verification_artifact_holds"."retention_policy")) > 0);
