import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { featuresFor, withDefaults } from "../../lib/tenant-defaults";

/**
 * Integration events (Settings → Integrations): queued for the signed webhook and syslog
 * targets the tenant enabled. The job runner delivers them with retries.
 */
export async function emitEvent(db: DB, tenantId: string, event: string, data: Record<string, unknown>): Promise<void> {
  const [tenant] = await db.select({ settings: t.tenants.settings, plan: t.tenants.plan, features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  // Integrations are a plan feature: a plan change or operator override stops deliveries at once.
  if (!tenant || !featuresFor(tenant.plan, tenant.features).has("integrations")) return;
  const i = withDefaults(tenant.settings).integrations;
  const payload = { event, occurredAt: new Date().toISOString(), tenantId, data };
  const rows: (typeof t.webhookDeliveries.$inferInsert)[] = [];
  if (i.webhookEnabled && i.webhookUrl && i.webhookEvents.includes(event)) rows.push({ tenantId, event, target: "webhook", payload });
  if (i.syslogEnabled && i.syslogHost && i.webhookEvents.includes(event)) rows.push({ tenantId, event, target: "syslog", payload });
  if (rows.length) await db.insert(t.webhookDeliveries).values(rows);
}
