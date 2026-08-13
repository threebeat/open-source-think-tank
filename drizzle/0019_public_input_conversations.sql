-- Package 4.3: Public Input conversation lifecycle domain (schema only).
--
-- Rollback (manual, if ever needed before this migration is released):
--   DROP TABLE IF EXISTS "public_input_conversation_transitions";
--   DROP TABLE IF EXISTS "public_input_conversations";
--   DROP TYPE IF EXISTS "public"."public_input_conversation_designation";
--   DROP TYPE IF EXISTS "public"."public_input_provider_kind";
--   DROP TYPE IF EXISTS "public"."public_input_provider_availability";
--   DROP TYPE IF EXISTS "public"."public_input_workflow_state";
--
-- Live Pol.is stays fail-closed: provider_kind is DB-constrained to
-- ('none','fixture') only. polis_hosted / polis_self_hosted enum labels exist
-- for forward compatibility but are rejected by a CHECK constraint below and
-- by the service layer (src/lib/public-input/lifecycle/service.ts). No
-- provider network calls, credentials, or env vars are introduced here.

CREATE TYPE "public"."public_input_workflow_state" AS ENUM('draft', 'ready', 'open', 'commenting_closed', 'voting_closed', 'closed', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."public_input_provider_availability" AS ENUM('not_configured', 'available', 'degraded', 'unavailable');
--> statement-breakpoint
CREATE TYPE "public"."public_input_provider_kind" AS ENUM('none', 'fixture', 'polis_hosted', 'polis_self_hosted');
--> statement-breakpoint
CREATE TYPE "public"."public_input_conversation_designation" AS ENUM('current', 'historical');
--> statement-breakpoint
CREATE TABLE "public_input_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"provider_kind" "public_input_provider_kind" DEFAULT 'none' NOT NULL,
	"provider_conversation_ref" text,
	"workflow_state" "public_input_workflow_state" DEFAULT 'draft' NOT NULL,
	"provider_availability" "public_input_provider_availability" DEFAULT 'not_configured' NOT NULL,
	"public_title" text NOT NULL,
	"public_prompt" text NOT NULL,
	"configuration_version" integer DEFAULT 1 NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_account_id" text NOT NULL,
	"last_transition_by_account_id" text,
	"designation" "public_input_conversation_designation" DEFAULT 'current' NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_conversations_public_title_nonblank" CHECK (char_length(btrim("public_input_conversations"."public_title")) > 0),
	CONSTRAINT "public_input_conversations_public_prompt_nonblank" CHECK (char_length(btrim("public_input_conversations"."public_prompt")) > 0),
	CONSTRAINT "public_input_conversations_configuration_version_positive" CHECK ("public_input_conversations"."configuration_version" > 0),
	CONSTRAINT "public_input_conversations_version_positive" CHECK ("public_input_conversations"."version" > 0),
	CONSTRAINT "public_input_conversations_closes_after_opens" CHECK ((
        "public_input_conversations"."opens_at" IS NULL
        OR "public_input_conversations"."closes_at" IS NULL
        OR "public_input_conversations"."closes_at" > "public_input_conversations"."opens_at"
      )),
	CONSTRAINT "public_input_conversations_kind_operational_only" CHECK ("public_input_conversations"."provider_kind" IN ('none', 'fixture')),
	CONSTRAINT "public_input_conversations_none_kind_has_no_ref" CHECK (("public_input_conversations"."provider_kind" <> 'none') OR ("public_input_conversations"."provider_conversation_ref" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "public_input_conversations" ADD CONSTRAINT "public_input_conversations_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_conversations" ADD CONSTRAINT "public_input_conversations_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_conversations" ADD CONSTRAINT "public_input_conversations_last_transition_by_account_id_accounts_id_fk" FOREIGN KEY ("last_transition_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "public_input_conversations_topic_idx" ON "public_input_conversations" USING btree ("topic_id");
--> statement-breakpoint
CREATE INDEX "public_input_conversations_workflow_idx" ON "public_input_conversations" USING btree ("workflow_state");
--> statement-breakpoint
CREATE INDEX "public_input_conversations_availability_idx" ON "public_input_conversations" USING btree ("provider_availability");
--> statement-breakpoint
CREATE UNIQUE INDEX "public_input_conversations_one_current_per_topic_uidx" ON "public_input_conversations" USING btree ("topic_id") WHERE "designation" = 'current';
--> statement-breakpoint
CREATE TABLE "public_input_conversation_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"from_state" "public_input_workflow_state",
	"to_state" "public_input_workflow_state" NOT NULL,
	"reason" text,
	"actor_account_id" text NOT NULL,
	"is_recovery" boolean DEFAULT false NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_input_conversation_transitions_recovery_requires_reason" CHECK ((NOT "public_input_conversation_transitions"."is_recovery") OR (char_length(btrim("public_input_conversation_transitions"."reason")) > 0)),
	CONSTRAINT "public_input_conversation_transitions_from_to_distinct" CHECK ("public_input_conversation_transitions"."from_state" IS NULL OR "public_input_conversation_transitions"."from_state" <> "public_input_conversation_transitions"."to_state")
);
--> statement-breakpoint
ALTER TABLE "public_input_conversation_transitions" ADD CONSTRAINT "public_input_conversation_transitions_conversation_id_public_input_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."public_input_conversations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_input_conversation_transitions" ADD CONSTRAINT "public_input_conversation_transitions_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "public_input_conversation_transitions_conversation_idx" ON "public_input_conversation_transitions" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX "public_input_conversation_transitions_actor_idx" ON "public_input_conversation_transitions" USING btree ("actor_account_id");
--> statement-breakpoint
DROP TRIGGER IF EXISTS public_input_conversation_transitions_immutable ON public_input_conversation_transitions;
--> statement-breakpoint
CREATE TRIGGER public_input_conversation_transitions_immutable
  BEFORE UPDATE OR DELETE ON public_input_conversation_transitions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
