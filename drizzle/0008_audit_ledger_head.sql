CREATE TABLE "audit_ledger_head" (
	"id" text PRIMARY KEY NOT NULL,
	"head_event_id" text,
	"head_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "audit_ledger_head" ("id", "head_event_id", "head_hash") VALUES ('default', NULL, NULL);
