CREATE TYPE "public"."conversation_pseudonym_purpose" AS ENUM('closed_test_consultation');
--> statement-breakpoint
CREATE TYPE "public"."closed_test_conversation_status" AS ENUM('open', 'closed', 'archived');
--> statement-breakpoint
CREATE TABLE "closed_test_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"purpose" "conversation_pseudonym_purpose" NOT NULL,
	"status" "closed_test_conversation_status" DEFAULT 'open' NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closed_test_conversations_synthetic_only" CHECK ("synthetic" = true)
);
--> statement-breakpoint
INSERT INTO "closed_test_conversations" ("id", "label", "purpose", "status", "synthetic") VALUES
	('ostt-synth-conversation-alpha', 'Synthetic closed conversation alpha', 'closed_test_consultation', 'open', true),
	('ostt-synth-conversation-beta', 'Synthetic closed conversation beta', 'closed_test_consultation', 'open', true),
	('ostt-synth-conversation-gamma', 'Synthetic closed conversation gamma', 'closed_test_consultation', 'open', true),
	('ostt-synth-conversation-delta', 'Synthetic closed conversation delta', 'closed_test_consultation', 'open', true),
	('ostt-synth-conversation-epsilon', 'Synthetic closed conversation epsilon', 'closed_test_consultation', 'open', true),
	('ostt-synth-conversation-zeta', 'Synthetic closed conversation zeta', 'closed_test_consultation', 'open', true);
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ALTER COLUMN "purpose" SET DATA TYPE "conversation_pseudonym_purpose" USING "purpose"::"conversation_pseudonym_purpose";
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ADD CONSTRAINT "conversation_pseudonyms_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."closed_test_conversations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ADD CONSTRAINT "conversation_pseudonyms_superseded_by_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."conversation_pseudonyms"("id") ON DELETE restrict ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ADD CONSTRAINT "conversation_pseudonyms_expires_after_issued" CHECK ("expires_at" > "issued_at");
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ADD CONSTRAINT "conversation_pseudonyms_rotation_pair" CHECK (
	("rotated_at" IS NULL AND "superseded_by_id" IS NULL)
	OR ("rotated_at" IS NOT NULL AND "superseded_by_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "conversation_pseudonyms" ADD CONSTRAINT "conversation_pseudonyms_not_rotated_and_deleted" CHECK (
	NOT ("rotated_at" IS NOT NULL AND "deleted_at" IS NOT NULL)
);
