-- Topic geography classification (Tennessee release).
-- Geography is content taxonomy only — not eligibility, residency, or voting.
-- Existing rows are backfilled as Tennessee statewide, then invariants apply.
ALTER TABLE "topics" ADD COLUMN "jurisdiction_level" text;
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "state_code" text;
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "county_fips" text;
--> statement-breakpoint
UPDATE "topics"
SET
  "jurisdiction_level" = 'statewide',
  "state_code" = 'TN',
  "county_fips" = NULL
WHERE "jurisdiction_level" IS NULL;
--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "jurisdiction_level" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "jurisdiction_level" SET DEFAULT 'statewide';
--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "state_code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "state_code" SET DEFAULT 'TN';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."topic_jurisdiction_level" AS ENUM('statewide', 'county');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "topics"
  ALTER COLUMN "jurisdiction_level" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "topics"
  ALTER COLUMN "jurisdiction_level" TYPE "public"."topic_jurisdiction_level"
  USING ("jurisdiction_level"::"public"."topic_jurisdiction_level");
--> statement-breakpoint
ALTER TABLE "topics"
  ALTER COLUMN "jurisdiction_level" SET DEFAULT 'statewide'::"public"."topic_jurisdiction_level";
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_state_code_tn_only"
  CHECK ("state_code" = 'TN');
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_geography_county_requires_fips"
  CHECK (
    ("jurisdiction_level" = 'statewide' AND "county_fips" IS NULL)
    OR (
      "jurisdiction_level" = 'county'
      AND "county_fips" IS NOT NULL
      AND "county_fips" ~ '^47[0-9]{3}$'
    )
  );
--> statement-breakpoint
CREATE INDEX "topics_jurisdiction_idx" ON "topics" ("jurisdiction_level");
--> statement-breakpoint
CREATE INDEX "topics_county_fips_idx" ON "topics" ("county_fips");
