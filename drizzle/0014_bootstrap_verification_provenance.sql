-- Phase 3.3: structurally distinguish operator_bootstrap verification decisions.

CREATE TYPE "public"."verification_decision_source" AS ENUM('account_reviewer', 'operator_bootstrap');
--> statement-breakpoint
ALTER TABLE "verification_cases" ADD COLUMN "decision_source" "verification_decision_source" DEFAULT 'account_reviewer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "verification_cases" ADD COLUMN "operator_label" text;
--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_operator_bootstrap_provenance" CHECK ((
        ("verification_cases"."decision_source" <> 'operator_bootstrap')
        OR (
          "verification_cases"."reviewer_account_id" IS NULL
          AND "verification_cases"."operator_label" IS NOT NULL
          AND char_length(btrim("verification_cases"."operator_label")) > 0
        )
      ));
