-- Package 3.7: append-only content revision history for claims and evidence.
-- Exactly one subject per row; same-topic composite FKs; immutable after insert.

CREATE TABLE "content_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"claim_id" text,
	"evidence_submission_id" text,
	"revision_number" integer NOT NULL,
	"editor_account_id" text NOT NULL,
	"changed_fields" text[] NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_revisions_revision_number_positive" CHECK ("content_revisions"."revision_number" > 0),
	CONSTRAINT "content_revisions_changed_fields_nonempty" CHECK (cardinality("content_revisions"."changed_fields") > 0),
	CONSTRAINT "content_revisions_exactly_one_subject" CHECK ((
        ("content_revisions"."claim_id" IS NOT NULL AND "content_revisions"."evidence_submission_id" IS NULL)
        OR ("content_revisions"."claim_id" IS NULL AND "content_revisions"."evidence_submission_id" IS NOT NULL)
      )),
	CONSTRAINT "content_revisions_claim_snapshot_shape" CHECK ((
        "content_revisions"."claim_id" IS NULL
        OR (
          jsonb_typeof("content_revisions"."before_snapshot") = 'object'
          AND jsonb_typeof("content_revisions"."after_snapshot") = 'object'
          AND "content_revisions"."before_snapshot" ? 'title'
          AND "content_revisions"."before_snapshot" ? 'summary'
          AND "content_revisions"."before_snapshot" ? 'approachLabel'
          AND "content_revisions"."after_snapshot" ? 'title'
          AND "content_revisions"."after_snapshot" ? 'summary'
          AND "content_revisions"."after_snapshot" ? 'approachLabel'
          AND NOT ("content_revisions"."before_snapshot" ? 'sourceUrl')
          AND NOT ("content_revisions"."after_snapshot" ? 'sourceUrl')
        )
      )),
	CONSTRAINT "content_revisions_evidence_snapshot_shape" CHECK ((
        "content_revisions"."evidence_submission_id" IS NULL
        OR (
          jsonb_typeof("content_revisions"."before_snapshot") = 'object'
          AND jsonb_typeof("content_revisions"."after_snapshot") = 'object'
          AND "content_revisions"."before_snapshot" ? 'sourceUrl'
          AND "content_revisions"."before_snapshot" ? 'title'
          AND "content_revisions"."before_snapshot" ? 'organization'
          AND "content_revisions"."before_snapshot" ? 'authorType'
          AND "content_revisions"."before_snapshot" ? 'sourceType'
          AND "content_revisions"."before_snapshot" ? 'limitations'
          AND "content_revisions"."after_snapshot" ? 'sourceUrl'
          AND "content_revisions"."after_snapshot" ? 'title'
          AND "content_revisions"."after_snapshot" ? 'organization'
          AND "content_revisions"."after_snapshot" ? 'authorType'
          AND "content_revisions"."after_snapshot" ? 'sourceType'
          AND "content_revisions"."after_snapshot" ? 'limitations'
          AND NOT ("content_revisions"."before_snapshot" ? 'approachLabel')
          AND NOT ("content_revisions"."after_snapshot" ? 'approachLabel')
        )
      ))
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_editor_account_id_accounts_id_fk" FOREIGN KEY ("editor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_claim_topic_fk" FOREIGN KEY ("claim_id","topic_id") REFERENCES "public"."claims"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_evidence_topic_fk" FOREIGN KEY ("evidence_submission_id","topic_id") REFERENCES "public"."evidence_submissions"("id","topic_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_claim_revision_uidx" ON "content_revisions" USING btree ("claim_id","revision_number") WHERE "claim_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_evidence_revision_uidx" ON "content_revisions" USING btree ("evidence_submission_id","revision_number") WHERE "evidence_submission_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "content_revisions_claim_created_idx" ON "content_revisions" USING btree ("claim_id","created_at") WHERE "claim_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "content_revisions_evidence_created_idx" ON "content_revisions" USING btree ("evidence_submission_id","created_at") WHERE "evidence_submission_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "content_revisions_topic_created_idx" ON "content_revisions" USING btree ("topic_id","created_at");
--> statement-breakpoint
DROP TRIGGER IF EXISTS content_revisions_immutable ON content_revisions;
--> statement-breakpoint
CREATE TRIGGER content_revisions_immutable
  BEFORE UPDATE OR DELETE ON content_revisions
  FOR EACH ROW
  EXECUTE FUNCTION ostt_reject_mutation();
