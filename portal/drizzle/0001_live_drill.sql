CREATE TABLE "drill_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"sim_minutes" integer NOT NULL,
	"events" jsonb NOT NULL,
	"applied_until" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"baseline" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drill_runs" ADD CONSTRAINT "drill_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_runs" ADD CONSTRAINT "drill_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drill_runs_tenant_idx" ON "drill_runs" USING btree ("tenant_id","created_at");