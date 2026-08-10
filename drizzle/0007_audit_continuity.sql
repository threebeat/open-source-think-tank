ALTER TABLE "audit_events" ADD COLUMN "continuity_prev_hash" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "continuity_hash" text;--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_account_id");
