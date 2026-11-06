CREATE TABLE "job_ticks" (
	"job" text PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attestations" ADD COLUMN "evidence" text DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "evidence" text DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "reached" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "attestations_user_module_idx" ON "attestations" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_module_idx" ON "certificates" USING btree ("user_id","module_id") WHERE module_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_path_idx" ON "certificates" USING btree ("user_id","path_id") WHERE path_id is not null;