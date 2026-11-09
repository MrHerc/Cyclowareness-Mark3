"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { issueAccountLink } from "../auth/links";
import { stepUp } from "../auth/step-up";
import { domainProofFound, domainProofRecords, normaliseHost } from "../auth/domain-proof";
import { audit } from "../services/audit";
import { notifyTakeover } from "../services/notify";
import { isUniqueViolation } from "../db/errors";
import { TENANT_SLUG_RE, createTenantWithAdmin } from "../services/tenants";
import { ALL_FEATURES, withDefaults, type Feature } from "../../lib/tenant-defaults";
import { LOCALES } from "../../i18n/config";

/**
 * Platform operator console (/super). Only super admins; every change is written to the
 * audit log of the organisation it touches.
 */

type Result = { ok: boolean; error?: string };
const uuid = z.string().uuid();

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(TENANT_SLUG_RE),
  plan: z.enum(t.PLANS),
  locale: z.enum(LOCALES),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.email().max(254),
});

export async function createTenantAction(input: z.infer<typeof tenantSchema>): Promise<Result & { link?: string }> {
  const v = await actionViewer("platform.manage");
  const p = tenantSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  const email = d.adminEmail.toLowerCase();
  const [slugTaken] = await db().select({ id: t.tenants.id }).from(t.tenants).where(eq(t.tenants.slug, d.slug));
  const [emailTaken] = await db().select({ id: t.users.id }).from(t.users).where(eq(t.users.email, email));
  if (slugTaken || emailTaken) return { ok: false, error: "taken" };
  const { tenantId, adminId } = await createTenantWithAdmin(db(), { slug: d.slug, name: d.name, plan: d.plan, locale: d.locale, adminName: d.adminName, adminEmail: email });
  const link = await issueAccountLink(adminId, "invite");
  await audit(db(), { tenantId, actorId: v.user.id, action: "tenant.created", targetType: "tenant", targetId: tenantId, meta: { name: d.name, plan: d.plan, by: v.user.email } });
  refresh();
  return { ok: true, link };
}

export async function setTenantPlanAction(tenantId: string, plan: string): Promise<Result> {
  const v = await actionViewer("platform.manage");
  const p = z.enum(t.PLANS).safeParse(plan);
  if (!uuid.safeParse(tenantId).success || !p.success) return { ok: false };
  await db().update(t.tenants).set({ plan: p.data }).where(eq(t.tenants.id, tenantId));
  await audit(db(), { tenantId, actorId: v.user.id, action: "tenant.changed", targetType: "tenant", targetId: tenantId, meta: { plan: p.data, by: v.user.email } });
  refresh();
  return { ok: true };
}

/** "default" removes the override so the feature follows the plan again. */
export async function setTenantFeatureAction(tenantId: string, feature: string, state: "default" | "on" | "off"): Promise<Result> {
  const v = await actionViewer("platform.manage");
  if (!uuid.safeParse(tenantId).success || !ALL_FEATURES.includes(feature as Feature) || !["default", "on", "off"].includes(state)) return { ok: false };
  const [tenant] = await db().select({ features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  if (!tenant) return { ok: false };
  const features = { ...tenant.features };
  if (state === "default") delete features[feature];
  else features[feature] = state === "on";
  await db().update(t.tenants).set({ features }).where(eq(t.tenants.id, tenantId));
  await audit(db(), { tenantId, actorId: v.user.id, action: "tenant.changed", targetType: "tenant", targetId: tenantId, meta: { feature, state, by: v.user.email } });
  refresh();
  return { ok: true };
}

export async function renameTenantAction(tenantId: string, name: string): Promise<Result> {
  const v = await actionViewer("platform.manage");
  const p = z.string().trim().min(2).max(120).safeParse(name);
  if (!uuid.safeParse(tenantId).success || !p.success) return { ok: false, error: "invalid" };
  const [tenant] = await db().select({ name: t.tenants.name }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  if (!tenant) return { ok: false };
  await db().update(t.tenants).set({ name: p.data }).where(eq(t.tenants.id, tenantId));
  await audit(db(), { tenantId, actorId: v.user.id, action: "tenant.changed", targetType: "tenant", targetId: tenantId, meta: { name: p.data, from: tenant.name, by: v.user.email } });
  refresh();
  return { ok: true };
}

/**
 * Domain proof done by the operator, for organisations whose DNS team cannot publish the TXT
 * record (common for government domains). `force` records the proof although the record is
 * missing; the daily re-check then leaves that proof alone.
 */
export async function verifyTenantDomainAction(tenantId: string, domain: string, force = false): Promise<Result & { verified?: boolean; found?: boolean }> {
  const v = await actionViewer("platform.manage");
  const host = normaliseHost(domain);
  if (!uuid.safeParse(tenantId).success || !host) return { ok: false, error: "invalid" };
  const [tenant] = await db().select({ id: t.tenants.id }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  if (!tenant) return { ok: false };
  const found = await domainProofFound(host, domainProofRecords(tenantId));
  const verified = found || force;
  const now = new Date();
  // The DNS lookup is done; the row is read and written under a lock so a settings save made by the
  // organisation's admin meanwhile is not overwritten with the copy from before the lookup.
  const saved = await db().transaction(async (tx) => {
    const [row] = await tx.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId)).for("update");
    if (!row) return false;
    const settings = withDefaults(structuredClone(row.settings));
    delete settings.identity.domainCheckFailingSince;
    if (verified) settings.identity.domainCheckedAt = now.toISOString();
    else delete settings.identity.domainCheckedAt;
    if (!found && force) settings.identity.domainProofForced = true;
    else delete settings.identity.domainProofForced;
    await tx
      .update(t.tenants)
      .set({ domain: host, domainVerifiedAt: verified ? now : null, settings })
      .where(eq(t.tenants.id, tenantId));
    return true;
  }).catch((error: unknown) => {
    // Another organisation holds the proof for this domain (tenants_domain_verified_idx).
    if (isUniqueViolation(error, "tenants_domain_verified_idx")) return "taken" as const;
    throw error;
  });
  if (saved === "taken") {
    await audit(db(), { tenantId, actorId: v.user.id, action: "domain.rechecked", targetType: "tenant", targetId: tenantId, meta: { domain: host, found, byOperator: true, forced: !found && force, taken: true, by: v.user.email } });
    return { ok: false, error: "domainTaken", found };
  }
  if (!saved) return { ok: false };
  await audit(db(), {
    tenantId,
    actorId: v.user.id,
    action: verified ? "domain.verified" : "domain.rechecked",
    targetType: "tenant",
    targetId: tenantId,
    meta: { domain: host, found, byOperator: true, forced: !found && force, by: v.user.email },
  });
  refresh();
  return { ok: true, verified, found };
}

/**
 * One-time password link for an administrator of another organisation (support access): only with the
 * operator's own password and only while the organisation allows it (Settings → Security, 72 hours at a time).
 */
export async function adminLinkAction(tenantId: string, userId: string, password?: string): Promise<Result & { link?: string }> {
  const v = await actionViewer("platform.manage");
  const refused = await stepUp(v, password, "platform.admin_link", userId);
  if (refused) return { ok: false, error: refused };
  if (!uuid.safeParse(tenantId).success || !uuid.safeParse(userId).success) return { ok: false };
  const [tenant] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  const until = tenant ? withDefaults(tenant.settings).security.supportAccessUntil : null;
  if (!until || !(Date.parse(until) > Date.now())) return { ok: false, error: "supportAccess" };
  const [u] = await db()
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, role: t.users.role })
    .from(t.users)
    .where(and(eq(t.users.id, userId), eq(t.users.tenantId, tenantId), eq(t.users.role, "tenant_admin"), inArray(t.users.status, ["active", "invited"])));
  if (!u) return { ok: false };
  const link = await issueAccountLink(u.id, "reset");
  await audit(db(), { tenantId, actorId: v.user.id, action: "platform.admin_link", targetType: "user", targetId: u.id, meta: { email: u.email, by: v.user.email } });
  await notifyTakeover(db(), tenantId, v.user, u, "resetLinkIssued");
  return { ok: true, link };
}

/* ───────── demo requests ───────── */

export async function setDemoStatusAction(id: string, status: string): Promise<Result> {
  const v = await actionViewer("platform.manage");
  const p = z.enum(["new", "contacted", "won", "lost"]).safeParse(status);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false };
  await db().update(t.demoRequests).set({ status: p.data }).where(eq(t.demoRequests.id, id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "demo.status", targetType: "demo_request", targetId: id, meta: { status: p.data } });
  refresh();
  return { ok: true };
}

export async function deleteDemoAction(id: string): Promise<Result> {
  const v = await actionViewer("platform.manage");
  if (!uuid.safeParse(id).success) return { ok: false };
  await db().delete(t.demoRequests).where(eq(t.demoRequests.id, id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "demo.deleted", targetType: "demo_request", targetId: id });
  refresh();
  return { ok: true };
}
