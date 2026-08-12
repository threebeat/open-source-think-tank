-- Package 3.8: one current disclosure per subject + append-only moderation actions.
-- Disclosure uniqueness is forward-only; moderation history is immutable via trigger.

CREATE UNIQUE INDEX "conflict_disclosures_claim_uidx" ON "conflict_disclosures" USING btree ("claim_id") WHERE "claim_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "conflict_disclosures_evidence_uidx" ON "conflict_disclosures" USING btree ("evidence_submission_id") WHERE "evidence_submission_id" IS NOT NULL;
--> statement-breakpoint

CREATE TYPE "public"."moderation_action" AS ENUM('hold', 'hide', 'restore');
--> statement-breakpoint

CREATE TABLE "moderation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"claim_id" text,
	"evidence_submission_id" text,
	"actor_account_id" text NOT NULL,
	"action" "moderation_action" NOT NULL,
	"from_visibility" "moderation_visibility" NOT NULL,
	"to_visibility" "moderation_visibility" NOT NULL,
	"public_rationale" text NOT NULL,
	"private_notes" text,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_actions_public_rationale_nonblank" CHECK (char_length(btrim("moderation_actions"."public_rationale")) > 0),
	CONSTRAINT "moderation_actions_exactly_one_subject" CHECK ((
        ("moderation_actions"."claim_id" IS NOT NULL AND "moderation_actions"."evidence_submission_id" IS NULL)
        OR ("moderation_actions"."claim_id" IS NULL AND "moderation_actions"."evidence_submission_id" IS NOT NULL)
      )),
	CONSTRAINT "moderation_actions_hold_transition" CHECK (
        ("moderation_actions"."action" <> 'hold')
        OR (
          "moderation_actions"."from_visibility" = 'visible'
          AND "moderation_actions"."to_visibility" = 'held'
        )
      ),
	CONSTRAINT "moderation_actions_hide_transition" CHECK (
        ("moderation_actions"."action" <> 'hide')
        OR (
          "moderation_actions"."from_visibility" IN ('visible', 'held')
          AND "moderation_actions"."to_visibility" = 'hidden'
        )
      ),
	CONSTRAINT "moderation_actions_restore_transition" CHECK (
        ("moderation_actions"."action" <> 'restore')
        OR (
          "moderation_actions"."from_visibility" IN ('held', 'hidden')
          AND "moderation_actions"."to_visibility" = 'visible'
        )
      )
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_claim_topic_fk" FOREIGN KEY ("claim_id","topic_id") REFERENCES "public"."claims"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_evidence_topic_fk" FOREIGN KEY ("evidence_submission_id","topic_id") REFERENCES "public"."evidence_submissions"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "moderation_actions_claim_created_idx" ON "moderation_actions" USING btree ("claim_id","created_at") WHERE "claim_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "moderation_actions_evidence_created_idx" ON "moderation_actions" USING btree ("evidence_submission_id","created_at") WHERE "evidence_submission_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "moderation_actions_topic_created_idx" ON "moderation_actions" USING btree ("topic_id","created_at");
--> statement-breakpoint
DROP TRIGGER IF EXISTS moderation_actions_immutable ON moderation_actions;
--> statement-breakpoint
CREATE TRIGGER moderation_actions_immutable
  BEFORE UPDATE OR DELETE ON moderation_actions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
