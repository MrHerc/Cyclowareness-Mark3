import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { DEFAULT_BRANDING, defaultSettings, withDefaults } from "../../lib/tenant-defaults";

/** The organisation's time zone (Settings → Languages), for services that only get its id. */
export async function tenantTimeZone(db: DB, tenantId: string): Promise<string> {
  const [row] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  return withDefaults(row?.settings).timeZone;
}

/** Organisation slugs: lowercase letters, digits and inner hyphens, 3–40 characters. */
export const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/**
 * A new organisation with its first administrator (status "invited", no password yet). Used by the
 * operator console and by the first-start bootstrap of the platform operator. The caller checks
 * that the slug and the email are free and issues the invitation link.
 */
export async function createTenantWithAdmin(
  db: DB,
  d: { slug: string; name: string; plan: (typeof t.PLANS)[number]; locale: string; adminName: string; adminEmail: string; adminRole?: "tenant_admin" | "super_admin" },
): Promise<{ tenantId: string; adminId: string }> {
  const [tenant] = await db
    .insert(t.tenants)
    .values({ slug: d.slug, name: d.name, plan: d.plan, branding: { ...DEFAULT_BRANDING, senderName: d.name }, settings: defaultSettings(d.locale) })
    .returning({ id: t.tenants.id });
  const [admin] = await db
    .insert(t.users)
    .values({ tenantId: tenant.id, email: d.adminEmail.toLowerCase(), name: d.adminName, role: d.adminRole ?? "tenant_admin", status: "invited", locale: d.locale })
    .returning({ id: t.users.id });
  return { tenantId: tenant.id, adminId: admin.id };
}
