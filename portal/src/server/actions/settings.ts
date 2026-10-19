"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getFormatter } from "next-intl/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, type Viewer } from "../auth/viewer";
import { domainProofFound, domainProofRecord, normaliseHost } from "../auth/domain-proof";
import { audit, type AuditAction } from "../services/audit";
import { encryptSecret, sha256Hex } from "../crypto";
import { env } from "../env";
import { sendTestEmail } from "../mail";
import { clientIp } from "../request";
import { LOCALES } from "../../i18n/config";
import { isHexColor } from "../../lib/color";
import { WEBHOOK_EVENTS } from "../../lib/tenant-defaults";
import type { TenantSettings } from "../db/schema";
import { notificationsSchema } from "../schemas/notifications";

async function saveSettings(v: Viewer, patch: (s: TenantSettings) => TenantSettings, action: AuditAction, meta?: Record<string, unknown>) {
  const [row] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  await db().update(t.tenants).set({ settings: patch(structuredClone(row.settings)) }).where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action, ip: await clientIp(), meta });
  refresh();
}

const brandingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  primary: z.string().refine(isHexColor),
  accent: z.string().refine(isHexColor),
  senderName: z.string().trim().max(120).optional(),
  senderDomain: z
    .string()
    .trim()
    .max(253)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$|^$/i)
    .optional(),
});

export async function saveBrandingAction(input: z.infer<typeof brandingSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = brandingSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const [tenant] = await db().select({ branding: t.tenants.branding }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  await db()
    .update(t.tenants)
    .set({ name: p.data.name, branding: { ...tenant.branding, primary: p.data.primary.toLowerCase(), accent: p.data.accent.toLowerCase(), senderName: p.data.senderName || undefined, senderDomain: p.data.senderDomain || undefined } })
    .where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.branding", ip: await clientIp() });
  refresh();
  return { ok: true };
}

const LOGO = /^data:(image\/(png|jpeg|svg\+xml));base64,([A-Za-z0-9+/=]+)$/;

/** Logos are stored as assets and served from /api/assets/{id}; SVGs are sanitised. */
export async function setLogoAction(dataUrl: string | null): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const [tenant] = await db().select({ branding: t.tenants.branding }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  if (dataUrl === null) {
    await db().delete(t.assets).where(and(eq(t.assets.tenantId, v.tenant.id), eq(t.assets.kind, "logo")));
    await db().update(t.tenants).set({ branding: { ...tenant.branding, logoUrl: null } }).where(eq(t.tenants.id, v.tenant.id));
  } else {
    const m = LOGO.exec(dataUrl);
    if (!m) return { ok: false };
    const bytes = Buffer.from(m[3], "base64");
    if (bytes.length > 512 * 1024) return { ok: false };
    if (m[1] === "image/svg+xml") {
      const svg = bytes.toString("utf8");
      // No scripts, event handlers, external references or foreign objects in an SVG logo.
      if (/<script|on\w+\s*=|javascript:|<foreignObject|xlink:href\s*=\s*["']?(?!#)|href\s*=\s*["']?(?!#)/i.test(svg)) return { ok: false };
    }
    await db().delete(t.assets).where(and(eq(t.assets.tenantId, v.tenant.id), eq(t.assets.kind, "logo")));
    const [row] = await db().insert(t.assets).values({ tenantId: v.tenant.id, kind: "logo", mime: m[1], dataBase64: m[3], sha256: sha256Hex(m[3]) }).returning({ id: t.assets.id, sha: t.assets.sha256 });
    await db().update(t.tenants).set({ branding: { ...tenant.branding, logoUrl: `/api/assets/${row.id}?v=${row.sha.slice(0, 8)}` } }).where(eq(t.tenants.id, v.tenant.id));
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "branding.logo", meta: { logo: dataUrl ? "changed" : "removed" } });
  refresh();
  return { ok: true };
}

/** The TXT value this organisation publishes to prove its domain (Branding → Domain proof). */
export async function domainProofRecordAction(): Promise<{ record: string }> {
  const v = await actionViewer("settings.write");
  return { record: domainProofRecord(v.tenant.id, env.secret) };
}

/**
 * Resolves the TXT record on the domain and on _cyclowareness.<domain>. The domain is kept either way;
 * the proof is set when the record is there and removed when it is not.
 */
export async function verifyDomainAction(domain: string): Promise<{ ok: boolean; verified: boolean; found: boolean; verifiedOn?: string }> {
  const v = await actionViewer("settings.write");
  const host = normaliseHost(domain);
  if (!host) return { ok: false, verified: false, found: false };
  const found = await domainProofFound(host, domainProofRecord(v.tenant.id, env.secret));
  const now = new Date();
  const [row] = await db().select({ settings: t.tenants.settings, domainVerifiedAt: t.tenants.domainVerifiedAt }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  const settings = structuredClone(row.settings);
  delete settings.identity.domainCheckFailingSince;
  delete settings.identity.domainProofForced;
  if (found) settings.identity.domainCheckedAt = now.toISOString();
  else delete settings.identity.domainCheckedAt;
  await db()
    .update(t.tenants)
    .set({ domain: host, domainVerifiedAt: found ? now : null, settings })
    .where(eq(t.tenants.id, v.tenant.id));
  // Verified, removed (it was proven before and the record is gone) or checked again without luck.
  const action = found ? "domain.verified" : row.domainVerifiedAt ? "domain.removed" : "domain.rechecked";
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action, ip: await clientIp(), meta: { domain: host, found } });
  refresh();
  const format = await getFormatter();
  return { ok: true, verified: found, found, verifiedOn: found ? format.dateTime(now, { dateStyle: "medium" }) : undefined };
}

export async function saveLanguagesAction(defaultLocale: string, locales: string[]): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const valid = locales.filter((l) => (LOCALES as readonly string[]).includes(l));
  if (!(LOCALES as readonly string[]).includes(defaultLocale) || !valid.includes(defaultLocale)) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, defaultLocale, locales: valid }), "settings.languages");
  return { ok: true };
}

/** Certificates are not secrets: trimmed, size-limited and checked for the PEM envelope only. */
const pem = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => s === "" || /^-----BEGIN [A-Z ]+-----[\s\S]+-----END [A-Z ]+-----$/.test(s))
    .optional();

const identitySchema = z.object({
  requireAdmin2fa: z.boolean(),
  maxDevices: z.number().int().min(1).max(10).nullable(),
  ssoEnabled: z.boolean(),
  sso: z.object({
    protocol: z.enum(["oidc", "saml"]),
    issuer: z.string().trim().max(500).optional(),
    clientId: z.string().trim().max(300).optional(),
    clientSecret: z.string().max(500).optional(),
    emailClaim: z.string().trim().max(60).optional(),
    autoCreate: z.boolean(),
    samlEntryPoint: z.url().startsWith("https://").max(500).or(z.literal("")).optional(),
    samlCertificate: pem(10_000),
  }),
  ldap: z.object({
    url: z.string().trim().max(300).optional(),
    bindDn: z.string().trim().max(500).optional(),
    password: z.string().max(500).optional(),
    caCertificate: pem(20_000),
    certificatePin: z
      .string()
      .trim()
      .max(128)
      .transform((s) => s.replace(/^sha256[:=]/i, "").replace(/:/g, "").toLowerCase())
      .refine((s) => s === "" || /^[0-9a-f]{64}$/.test(s))
      .optional(),
    searchBase: z.string().trim().max(500).optional(),
    filter: z.string().trim().max(500).optional(),
    departmentSource: z.enum(["attribute", "ou", "groups"]),
    departmentAttribute: z.string().trim().max(80).optional(),
    syncManagers: z.boolean(),
    syncLanguage: z.boolean(),
    schedule: z.enum(["off", "nightly", "6h", "12h", "24h"]),
    passwordSignIn: z.boolean(),
    matchByEmail: z.boolean(),
  }),
});

export async function saveIdentityAction(input: z.infer<typeof identitySchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = identitySchema.safeParse(input);
  if (!p.success) return { ok: false };
  const d = p.data;
  if (d.ssoEnabled && (!d.sso.issuer || !d.sso.clientId)) return { ok: false };
  await saveSettings(
    v,
    (s) => ({
      ...s,
      identity: {
        requireAdmin2fa: d.requireAdmin2fa,
        maxDevices: d.maxDevices,
        ssoEnabled: d.ssoEnabled,
        sso: {
          protocol: d.sso.protocol,
          issuer: d.sso.issuer,
          clientId: d.sso.clientId,
          clientSecretEnc: d.sso.clientSecret ? encryptSecret(d.sso.clientSecret) : s.identity.sso?.clientSecretEnc,
          emailClaim: d.sso.emailClaim,
          autoCreate: d.sso.autoCreate,
          samlEntryPoint: d.sso.samlEntryPoint || undefined,
          samlCertificate: d.sso.samlCertificate || undefined,
        },
        ldap: {
          url: d.ldap.url,
          bindDn: d.ldap.bindDn,
          passwordEnc: d.ldap.password ? encryptSecret(d.ldap.password) : s.identity.ldap?.passwordEnc,
          caCertificate: d.ldap.caCertificate || undefined,
          certificatePin: d.ldap.certificatePin || undefined,
          searchBase: d.ldap.searchBase,
          filter: d.ldap.filter,
          departmentSource: d.ldap.departmentSource,
          departmentAttribute: d.ldap.departmentAttribute,
          syncManagers: d.ldap.syncManagers,
          syncLanguage: d.ldap.syncLanguage,
          schedule: d.ldap.schedule,
          passwordSignIn: d.ldap.passwordSignIn,
          matchByEmail: d.ldap.matchByEmail,
        },
        domainCheckedAt: s.identity.domainCheckedAt,
        domainCheckFailingSince: s.identity.domainCheckFailingSince,
      },
    }),
    "settings.identity",
  );
  return { ok: true };
}

const emailSchema = z.object({
  host: z.string().trim().max(253).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean(),
  user: z.string().trim().max(254).optional(),
  password: z.string().max(500).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromAddress: z.email().max(254).or(z.literal("")).optional(),
  replyTo: z.email().max(254).or(z.literal("")).optional(),
  helpdesk: z.email().max(254).or(z.literal("")).optional(),
  enabled: z.boolean(),
});

export async function saveEmailAction(input: z.infer<typeof emailSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = emailSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const d = p.data;
  await saveSettings(
    v,
    (s) => {
      const changedServer = s.email.host !== d.host || s.email.port !== d.port || s.email.user !== d.user || !!d.password;
      return {
        ...s,
        email: {
          host: d.host,
          port: d.port,
          secure: d.secure,
          user: d.user,
          passwordEnc: d.password ? encryptSecret(d.password) : s.email.passwordEnc,
          fromName: d.fromName,
          fromAddress: d.fromAddress || undefined,
          replyTo: d.replyTo || undefined,
          helpdesk: d.helpdesk || undefined,
          // Sending stays off after server changes until a new test succeeds.
          testedAt: changedServer ? undefined : s.email.testedAt,
          enabled: d.enabled && !changedServer && !!s.email.testedAt,
        },
      };
    },
    "settings.email",
  );
  return { ok: true };
}

export async function testEmailAction(to: string): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer("settings.write");
  if (!z.email().safeParse(to).success) return { ok: false, error: "invalid address" };
  // Temporarily allow the transport for the test by marking it enabled in memory only.
  const [row] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  const draft = structuredClone(row.settings);
  draft.email.enabled = true;
  await db().update(t.tenants).set({ settings: draft }).where(eq(t.tenants.id, v.tenant.id));
  const res = await sendTestEmail(db(), v.tenant.id, to, `${v.tenant.name}: test`, "This is a test message from the security awareness portal.");
  draft.email.enabled = res.ok;
  draft.email.testedAt = res.ok ? new Date().toISOString() : undefined;
  await db().update(t.tenants).set({ settings: draft }).where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.email_tested", meta: { ok: res.ok } });
  refresh();
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function saveNotificationsAction(input: z.infer<typeof notificationsSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = notificationsSchema.safeParse(input);
  if (!p.success) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, notifications: { ...p.data, templates: p.data.templates ?? s.notifications.templates } }), "settings.notifications");
  return { ok: true };
}

export async function saveAttestationAction(locale: string, text: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  if (!(LOCALES as readonly string[]).includes(locale) || text.trim().length < 10 || text.length > 600) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, attestationText: { ...s.attestationText, [locale]: text.trim() } }), "settings.attestation", { locale });
  return { ok: true };
}

const certSchema = z.object({ title: z.string().trim().max(60), text: z.string().trim().max(400), signerName: z.string().trim().max(120), signerTitle: z.string().trim().max(120), publicLink: z.boolean() });

export async function saveCertificateAction(input: z.infer<typeof certSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = certSchema.safeParse(input);
  if (!p.success) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, certificate: { title: p.data.title || undefined, text: p.data.text || undefined, signerName: p.data.signerName || undefined, signerTitle: p.data.signerTitle || undefined, publicLink: p.data.publicLink } }), "settings.certificate");
  return { ok: true };
}

const learningSchema = z.object({ timeLimits: z.boolean(), refresher: z.boolean(), riskThreshold: z.number().int().min(50).max(90), dailyGoalXp: z.number().int().min(10).max(500) });

export async function saveLearningAction(input: z.infer<typeof learningSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = learningSchema.safeParse(input);
  if (!p.success) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, learning: p.data }), "settings.learning");
  return { ok: true };
}

export async function saveProtectionAction(contentProtection: boolean, watermark: boolean, androidScreenBlock = false): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  await saveSettings(v, (s) => ({ ...s, protection: { contentProtection, watermark, androidScreenBlock: !!androidScreenBlock } }), "settings.protection");
  return { ok: true };
}

export async function lookupWatermarkAction(code: string): Promise<{ ok: boolean; name?: string; email?: string; at?: string }> {
  const v = await actionViewer("settings.write");
  const normal = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normal.length !== 8) return { ok: false };
  const formatted = `${normal.slice(0, 4)}-${normal.slice(4)}`;
  const [row] = await db()
    .select({ name: t.users.name, email: t.users.email, at: t.watermarkCodes.createdAt })
    .from(t.watermarkCodes)
    .innerJoin(t.users, eq(t.users.id, t.watermarkCodes.userId))
    .where(and(eq(t.watermarkCodes.code, formatted), eq(t.watermarkCodes.tenantId, v.tenant.id)));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "watermark.lookup", meta: { found: !!row } });
  return row ? { ok: true, name: row.name, email: row.email, at: row.at.toISOString() } : { ok: false };
}

const integrationsSchema = z.object({
  webhookEnabled: z.boolean(),
  webhookUrl: z.url().startsWith("https://").or(z.literal("")).optional(),
  webhookEvents: z.array(z.enum(WEBHOOK_EVENTS)),
  syslogEnabled: z.boolean(),
  syslogHost: z.string().trim().max(253).optional(),
  syslogPort: z.number().int().min(1).max(65535).optional(),
  syslogTransport: z.enum(["tls", "tcp", "udp"]),
  syslogFormat: z.enum(["cef", "json"]),
});

export async function saveIntegrationsAction(input: z.infer<typeof integrationsSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const p = integrationsSchema.safeParse(input);
  if (!p.success) return { ok: false };
  await saveSettings(v, (s) => ({ ...s, integrations: { ...s.integrations, ...p.data, webhookUrl: p.data.webhookUrl || undefined } }), "settings.integrations");
  return { ok: true };
}

export async function rotateWebhookSecretAction(): Promise<{ ok: boolean; secret?: string }> {
  const v = await actionViewer("settings.write");
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  await saveSettings(v, (s) => ({ ...s, integrations: { ...s.integrations, webhookSecretEnc: encryptSecret(secret) } }), "settings.webhook_secret");
  return { ok: true, secret };
}

export async function sendTestEventAction(): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  const i = v.tenant.settings.integrations;
  const payload = { event: "admin.audit", occurredAt: new Date().toISOString(), tenantId: v.tenant.id, data: { test: true, by: v.user.email } };
  const rows: (typeof t.webhookDeliveries.$inferInsert)[] = [];
  if (i.webhookUrl) rows.push({ tenantId: v.tenant.id, event: "admin.audit", target: "webhook", payload });
  if (i.syslogHost) rows.push({ tenantId: v.tenant.id, event: "admin.audit", target: "syslog", payload });
  if (rows.length) await db().insert(t.webhookDeliveries).values(rows);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.integration_test" });
  refresh();
  return { ok: rows.length > 0 };
}
