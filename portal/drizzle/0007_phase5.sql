-- Reporting-API tokens get a lifetime (ADR-064 3a). Existing tokens keep working for a year from their creation.
ALTER TABLE "api_tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "api_tokens" SET "expires_at" = "created_at" + interval '365 days' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "recipients_clicked_idx" ON "campaign_recipients" USING btree ("clicked_at") WHERE clicked_at is not null;--> statement-breakpoint
CREATE INDEX "campaigns_user_idx" ON "campaigns" USING btree ("user_id") WHERE user_id is not null;--> statement-breakpoint
CREATE INDEX "drill_runs_campaign_idx" ON "drill_runs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "teachable_loops_source_campaign_idx" ON "teachable_loops" USING btree ("source_campaign_id");--> statement-breakpoint
CREATE INDEX "teachable_loops_resim_campaign_idx" ON "teachable_loops" USING btree ("resim_campaign_id");