CREATE TABLE "teachable_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_campaign_id" uuid NOT NULL,
	"source_recipient_id" uuid NOT NULL,
	"micro_module_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"resim_campaign_id" uuid,
	"resim_result" text,
	"status" text DEFAULT 'assigned' NOT NULL,
	CONSTRAINT "teachable_loops_source_recipient_id_unique" UNIQUE("source_recipient_id")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_source_campaign_id_campaigns_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_source_recipient_id_campaign_recipients_id_fk" FOREIGN KEY ("source_recipient_id") REFERENCES "public"."campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_micro_module_id_modules_id_fk" FOREIGN KEY ("micro_module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachable_loops" ADD CONSTRAINT "teachable_loops_resim_campaign_id_campaigns_id_fk" FOREIGN KEY ("resim_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teachable_loops_tenant_idx" ON "teachable_loops" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "teachable_loops_user_idx" ON "teachable_loops" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;