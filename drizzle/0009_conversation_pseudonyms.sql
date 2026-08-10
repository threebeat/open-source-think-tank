CREATE TABLE "conversation_pseudonyms" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"account_id" text NOT NULL,
	"pseudonym" text NOT NULL,
	"purpose" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"superseded_by_id" text,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_pseudonyms_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pseudonyms_pseudonym_uidx" ON "conversation_pseudonyms" USING btree ("pseudonym");
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pseudonyms_active_pair_uidx" ON "conversation_pseudonyms" USING btree ("conversation_id","account_id") WHERE "deleted_at" IS NULL AND "rotated_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "conversation_pseudonyms_account_idx" ON "conversation_pseudonyms" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "conversation_pseudonyms_conversation_idx" ON "conversation_pseudonyms" USING btree ("conversation_id");
