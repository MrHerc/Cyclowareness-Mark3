"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getFormatter, getTranslations } from "next-intl/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, hasFeature, type Viewer } from "../auth/viewer";
import { domainProofFound, domainProofRecord, normaliseHost } from "../auth/domain-proof";
import { audit, type AuditAction } from "../services/audit";
import { encryptSecret, sha256Hex } from "../crypto";
import { env } from "../env";
import { resendableMail, sendTestEmail } from "../mail";
import { destinationProblem } from "../net-guard";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";
import { LOCALES, isLocale } from "../../i18n/config";
import { isHexColor } from "../../lib/color";
import { WEBHOOK_EVENTS, isTimeZone, withDefaults } from "../../lib/tenant-defaults";
import { svgLogoProblem } from "../svg-safety";
import { isUuid } from "../../lib/ids";
import { endpointKey, storedSecretOutcome } from "../../lib/stored-secret";
import type { TenantSettings } from "../db/schema";
import { notificationsSchema } from "../schemas/notifications";

/**
 * `field` is the zod path of the first rejected value (e.g. "sso.issuer"); the form marks that input.
 * `error: "secretRequired"`: the server changed, so the stored password or secret must be entered again.
 */
export type SaveResult = { ok: boolean; field?: string; error?: "secretRequired" };
const invalid = (p: { error: { issues: { path: PropertyKey[] }[] } }): SaveResult => ({ ok: false, field: p.error.issues[0]?.path.map(String).join(".") || undefined });

/**
 * Read-modify-write of the settings JSON under a row lock, so two saves at the same time (two
 * admins, or a save next to the daily domain re-check) wait for each other instead of one
 * silently overwriting the other.
 */
async function saveSettings(v: Viewer, patch: (s: TenantSettings) => TenantSettings, action: AuditAction, meta?: Record<string, unknown>) {
  await db().transaction(async (tx) => {
    const [row] = await tx.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id)).for("update");
    await tx.update(t.tenants).set({ settings: patch(withDefaults(structuredClone(row.settings))) }).where(eq(t.tenants.id, v.tenant.id));
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action, ip: await clientIp(), meta });
  refresh();
}

/** The stored settings, read before a save to decide whether the form must be refused. */
async function currentSettings(v: Viewer): Promise<TenantSettings> {
  const [row] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  return withDefaults(row.settings);
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
    // Stored in the ASCII form tenants.domain holds, so mail.ts can match an internationalised proven domain.
    .refine((v) => v === "" || normaliseHost(v) !== null)
    .transform((v) => (v ? normaliseHost(v)! : v))
    .optional(),
});

export async function saveBrandingAction(input: z.infer<typeof brandingSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = brandingSchema.safeParse(input);
  if (!p.success) return invalid(p);
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
export async function setLogoAction(dataUrl: string | null): Promise<{ ok: boolean; error?: "invalid" | "unsafeSvg" }> {
  const v = await actionViewer("settings.write");
  const [tenant] = await db().select({ branding: t.tenants.branding }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  if (dataUrl === null) {
    await db().delete(t.assets).where(and(eq(t.assets.tenantId, v.tenant.id), eq(t.assets.kind, "logo")));
    await db().update(t.tenants).set({ branding: { ...tenant.branding, logoUrl: null } }).where(eq(t.tenants.id, v.tenant.id));
  } else {
    const m = LOGO.exec(dataUrl);
    if (!m) return { ok: false, error: "invalid" };
    const bytes = Buffer.from(m[3], "base64");
    if (bytes.length > 512 * 1024) return { ok: false, error: "invalid" };
    // No scripts, event handlers, external references or foreign objects in an SVG logo; #id references are fine.
    if (m[1] === "image/svg+xml" && svgLogoProblem(bytes.toString("utf8"))) return { ok: false, error: "unsafeSvg" };
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
 * Resolves the TXT record on the domain and on _cyclowareness.<domain>. A found record proves the
 * domain (and replaces the previous one). A missing record never removes a proof by itself: a
 * different domain is simply not adopted, and the proven domain keeps its proof until the daily
 * re-check has failed for a week (or for good, when the operator forced the proof).
 * `kept` tells the form that the current proof is still in place.
 */
export async function verifyDomainAction(domain: string): Promise<{ ok: boolean; verified: boolean; found: boolean; kept: boolean; verifiedOn?: string; error?: "rateLimited" }> {
  const v = await actionViewer("settings.write");
  const host = normaliseHost(domain);
  if (!host) return { ok: false, verified: false, found: false, kept: false };
  // Two DNS lookups per check: a few an hour per organisation.
  if (!(await rateLimit(`domain-check:${v.tenant.id}`, 20, 60 * 60_000)).ok) return { ok: false, verified: false, found: false, kept: false, error: "rateLimited" };
  const found = await domainProofFound(host, domainProofRecord(v.tenant.id, env.secret));
  const now = new Date();
  // The DNS lookup is done; the row is read and written under a lock so a concurrent settings save is not lost.
  const { proven, adopted } = await db().transaction(async (tx) => {
    const [row] = await tx
      .select({ domain: t.tenants.domain, settings: t.tenants.settings, domainVerifiedAt: t.tenants.domainVerifiedAt })
      .from(t.tenants)
      .where(eq(t.tenants.id, v.tenant.id))
      .for("update");
    const proven = !!row.domainVerifiedAt;
    // Nothing to adopt: the stored domain and its proof stay as they are.
    if (!found && host !== row.domain) return { proven, adopted: false };
    const settings = withDefaults(structuredClone(row.settings));
    if (found) {
      delete settings.identity.domainCheckFailingSince;
      delete settings.identity.domainProofForced;
      settings.identity.domainCheckedAt = now.toISOString();
    } else if (proven && !settings.identity.domainProofForced) {
      // Same domain, record gone: start (or continue) the grace period the daily job applies.
      settings.identity.domainCheckFailingSince ??= now.toISOString();
    }
    await tx
      .update(t.tenants)
      .set(found ? { domain: host, domainVerifiedAt: now, settings } : { settings })
      .where(eq(t.tenants.id, v.tenant.id));
    return { proven, adopted: true };
  });
  if (!adopted) {
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "domain.rechecked", ip: await clientIp(), meta: { domain: host, found } });
    return { ok: true, verified: false, found: false, kept: proven };
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: found ? "domain.verified" : "domain.rechecked", ip: await clientIp(), meta: { domain: host, found } });
  refresh();
  const format = await getFormatter();
  return { ok: true, verified: found, found, kept: found || proven, verifiedOn: found ? format.dateTime(now, { dateStyle: "medium" }) : undefined };
}

export async function saveLanguagesAction(defaultLocale: string, locales: string[]): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  if (typeof defaultLocale !== "string" || !Array.isArray(locales) || !locales.every((l) => typeof l === "string")) return { ok: false, field: "locales" };
  // Each language once, known languages only (the selects would otherwise list a language twice).
  const valid = [...new Set(locales)].filter((l) => (LOCALES as readonly string[]).includes(l));
  if (!(LOCALES as readonly string[]).includes(defaultLocale) || !valid.includes(defaultLocale)) return { ok: false, field: "defaultLocale" };
  await saveSettings(v, (s) => ({ ...s, defaultLocale, locales: valid }), "settings.languages");
  return { ok: true };
}

/** The organisation's IANA time zone: its days, due dates, reminders, scheduled reports and the times every page shows. */
export async function saveTimeZoneAction(timeZone: string): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  if (!isTimeZone(timeZone)) return { ok: false, field: "timeZone" };
  const from = v.tenant.settings.timeZone;
  // The Languages tab saves both together: an unchanged zone writes no "Time zone changed" audit entry.
  if (timeZone === from) return { ok: true };
  await saveSettings(v, (s) => ({ ...s, timeZone }), "settings.timezone", { from, to: timeZone });
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

export async function saveIdentityAction(input: z.infer<typeof identitySchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = identitySchema.safeParse(input);
  if (!p.success) return invalid(p);
  const d = p.data;
  if (d.ssoEnabled && (!d.sso.issuer || !d.sso.clientId)) return { ok: false, field: d.sso.issuer ? "sso.clientId" : "sso.issuer" };
  // A stored secret is never kept for a different server (lib/stored-secret.ts).
  const ssoSecret = (s: TenantSettings) =>
    storedSecretOutcome({ stored: !!s.identity.sso?.clientSecretEnc && !d.sso.clientSecret, before: endpointKey(s.identity.sso?.issuer), after: endpointKey(d.sso.issuer), needed: !!d.sso.issuer && d.sso.protocol === "oidc" });
  const ldapSecret = (s: TenantSettings) =>
    storedSecretOutcome({ stored: !!s.identity.ldap?.passwordEnc && !d.ldap.password, before: endpointKey(s.identity.ldap?.url), after: endpointKey(d.ldap.url), needed: !!d.ldap.url && !!d.ldap.bindDn });
  const current = await currentSettings(v);
  if (ssoSecret(current) === "required") return { ok: false, field: "sso.clientSecret", error: "secretRequired" };
  if (ldapSecret(current) === "required") return { ok: false, field: "ldap.password", error: "secretRequired" };
  await saveSettings(
    v,
    (s) => ({
      ...s,
      // Spread first: the operator's forced domain proof and the job's check timestamps have no form field.
      identity: {
        ...s.identity,
        requireAdmin2fa: d.requireAdmin2fa,
        maxDevices: d.maxDevices,
        ssoEnabled: d.ssoEnabled,
        sso: {
          protocol: d.sso.protocol,
          issuer: d.sso.issuer,
          clientId: d.sso.clientId,
          // Under the lock the server may have changed since the check above: then the secret is dropped, never kept.
          clientSecretEnc: d.sso.clientSecret ? encryptSecret(d.sso.clientSecret) : ssoSecret(s) === "keep" ? s.identity.sso?.clientSecretEnc : undefined,
          emailClaim: d.sso.emailClaim,
          autoCreate: d.sso.autoCreate,
          samlEntryPoint: d.sso.samlEntryPoint || undefined,
          samlCertificate: d.sso.samlCertificate || undefined,
        },
        ldap: {
          url: d.ldap.url,
          bindDn: d.ldap.bindDn,
          passwordEnc: d.ldap.password ? encryptSecret(d.ldap.password) : ldapSecret(s) === "keep" ? s.identity.ldap?.passwordEnc : undefined,
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

export async function saveEmailAction(input: z.infer<typeof emailSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = emailSchema.safeParse(input);
  if (!p.success) return invalid(p);
  const d = p.data;
  // Only public mail servers on mail ports: the platform must not reach into a customer's own network.
  if (d.host) {
    const problem = await destinationProblem(d.host, d.port ?? 587, "smtp");
    if (problem) return { ok: false, field: problem === "port_not_allowed" ? "port" : "host" };
  }
  // The stored password is only kept for the same host and port (lib/stored-secret.ts); 587 is the transport's default port.
  const smtpSecret = (s: TenantSettings) =>
    storedSecretOutcome({ stored: !!s.email.passwordEnc && !d.password, before: endpointKey(s.email.host, s.email.port ?? 587), after: endpointKey(d.host, d.port ?? 587), needed: !!d.host && !!d.user });
  if (smtpSecret(await currentSettings(v)) === "required") return { ok: false, field: "password", error: "secretRequired" };
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
          passwordEnc: d.password ? encryptSecret(d.password) : smtpSecret(s) === "keep" ? s.email.passwordEnc : undefined,
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
  if (!z.email().safeParse(to).success) return { ok: false, error: "invalid_address" };
  // Each test is a message to any address through the organisation's mail server: a few an hour per organisation.
  if (!(await rateLimit(`test-email:${v.tenant.id}`, 20, 60 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  // The test uses the stored server as if sending were enabled; nothing is written until it succeeds.
  const [row] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
  // In the language of the admin who sends it (they usually send it to themselves).
  const lang = isLocale(v.user.locale) ? v.user.locale : v.tenant.settings.defaultLocale;
  const tr = await getTranslations({ locale: lang, namespace: "settings.email" });
  const res = await sendTestEmail(db(), v.tenant.id, to, tr("testSubject", { organisation: v.tenant.name }), tr("testText"), { ...withDefaults(row.settings).email, enabled: true }, lang);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.email_tested", meta: { ok: res.ok } });
  if (!res.ok) return { ok: false, error: res.error };
  const testedAt = new Date().toISOString();
  await saveSettings(v, (s) => ({ ...s, email: { ...s.email, enabled: true, testedAt } }), "settings.email");
  return { ok: true };
}

/**
 * Settings → Email journal: puts failed messages back in the queue with fresh attempts (after an
 * SMTP outage or a password change). One message by id, or every failed message of the organisation.
 */
export async function resendFailedMailAction(id?: string): Promise<{ ok: boolean; count: number }> {
  const v = await actionViewer("settings.write");
  if (id !== undefined && !isUuid(id)) return { ok: false, count: 0 };
  // createdAt restarts the retry schedule (mail.ts RETRY_DUE_MINUTES); one message or all, of the last week only.
  const rows = await db()
    .update(t.outbox)
    .set({ status: "queued", attempts: 0, error: null, createdAt: new Date() })
    .where(and(resendableMail(v.tenant.id, new Date()), id ? eq(t.outbox.id, id) : undefined))
    .returning({ id: t.outbox.id });
  if (rows.length) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.email", ip: await clientIp(), meta: { resent: rows.length } });
  refresh();
  return { ok: true, count: rows.length };
}

export async function saveNotificationsAction(input: z.infer<typeof notificationsSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = notificationsSchema.safeParse(input);
  if (!p.success) return invalid(p);
  await saveSettings(v, (s) => ({ ...s, notifications: { ...p.data, templates: p.data.templates ?? s.notifications.templates } }), "settings.notifications");
  return { ok: true };
}

export async function saveAttestationAction(locale: string, text: string): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  if (!(LOCALES as readonly string[]).includes(locale) || text.trim().length < 10 || text.length > 600) return { ok: false, field: "text" };
  await saveSettings(v, (s) => ({ ...s, attestationText: { ...s.attestationText, [locale]: text.trim() } }), "settings.attestation", { locale });
  return { ok: true };
}

/** The certificate's own title and text are per language, like the attestation text: each learner's certificate is in their language. */
const certSchema = z.object({
  title: z.partialRecord(z.enum(LOCALES), z.string().trim().max(60)),
  text: z.partialRecord(z.enum(LOCALES), z.string().trim().max(400)),
  signerName: z.string().trim().max(120),
  signerTitle: z.string().trim().max(120),
  publicLink: z.boolean(),
});

/** The languages with a text of their own; none means the default wording everywhere. */
function ownTexts(map: Partial<Record<string, string>>): Record<string, string> | undefined {
  const entries = Object.entries(map).filter((e): e is [string, string] => !!e[1]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function saveCertificateAction(input: z.infer<typeof certSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = certSchema.safeParse(input);
  // The field of the form ("text"), not the language inside it ("text.ru").
  if (!p.success) return { ok: false, field: p.error.issues[0]?.path.length ? String(p.error.issues[0].path[0]) : undefined };
  await saveSettings(
    v,
    (s) => ({ ...s, certificate: { title: ownTexts(p.data.title), text: ownTexts(p.data.text), signerName: p.data.signerName || undefined, signerTitle: p.data.signerTitle || undefined, publicLink: p.data.publicLink } }),
    "settings.certificate",
  );
  return { ok: true };
}

const learningSchema = z.object({ timeLimits: z.boolean(), refresher: z.boolean(), riskThreshold: z.number().int().min(50).max(90), dailyGoalXp: z.number().int().min(10).max(500) });

export async function saveLearningAction(input: z.infer<typeof learningSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = learningSchema.safeParse(input);
  if (!p.success) return invalid(p);
  await saveSettings(v, (s) => ({ ...s, learning: p.data }), "settings.learning");
  return { ok: true };
}

const months = z.number().int().min(0).max(120);
const retentionSchema = z.object({ auditMonths: months, learningMonths: months });

export async function saveRetentionAction(input: z.infer<typeof retentionSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  const p = retentionSchema.safeParse(input);
  if (!p.success) return invalid(p);
  await saveSettings(v, (s) => ({ ...s, retention: p.data }), "settings.retention", p.data);
  return { ok: true };
}

const protectionSchema = z.tuple([z.boolean(), z.boolean(), z.boolean().default(false)]);

export async function saveProtectionAction(contentProtection: boolean, watermark: boolean, androidScreenBlock = false): Promise<{ ok: boolean }> {
  const v = await actionViewer("settings.write");
  // Server actions take whatever the request carries: only real booleans are stored.
  const p = protectionSchema.safeParse([contentProtection, watermark, androidScreenBlock]);
  if (!p.success) return { ok: false };
  const [cp, wm, android] = p.data;
  await saveSettings(v, (s) => ({ ...s, protection: { contentProtection: cp, watermark: wm, androidScreenBlock: android } }), "settings.protection");
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

export async function saveIntegrationsAction(input: z.infer<typeof integrationsSchema>): Promise<SaveResult> {
  const v = await actionViewer("settings.write");
  if (!hasFeature(v, "integrations")) return { ok: false };
  const p = integrationsSchema.safeParse(input);
  if (!p.success) return invalid(p);
  // Public receivers only (see net-guard.ts); the job runner checks again before every delivery.
  if (p.data.webhookUrl) {
    const u = new URL(p.data.webhookUrl);
    if (await destinationProblem(u.hostname, Number(u.port || 443), "webhook")) return { ok: false, field: "webhookUrl" };
  }
  if (p.data.syslogHost) {
    const problem = await destinationProblem(p.data.syslogHost, p.data.syslogPort ?? 6514, "syslog");
    if (problem) return { ok: false, field: problem === "port_not_allowed" ? "syslogPort" : "syslogHost" };
  }
  // Built from the form alone (plus the stored signing secret, which has no field): an emptied
  // address or server is removed instead of the previous value surviving through a spread.
  await saveSettings(
    v,
    (s) => ({
      ...s,
      integrations: { webhookSecretEnc: s.integrations.webhookSecretEnc, ...p.data, webhookUrl: p.data.webhookUrl || undefined, syslogHost: p.data.syslogHost || undefined },
    }),
    "settings.integrations",
  );
  return { ok: true };
}

export async function rotateWebhookSecretAction(): Promise<{ ok: boolean; secret?: string }> {
  const v = await actionViewer("settings.write");
  if (!hasFeature(v, "integrations")) return { ok: false };
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  await saveSettings(v, (s) => ({ ...s, integrations: { ...s.integrations, webhookSecretEnc: encryptSecret(secret) } }), "settings.webhook_secret");
  return { ok: true, secret };
}

/** Queues one test delivery per saved target; `no_target` when neither a webhook URL nor a syslog host is saved. */
export async function sendTestEventAction(): Promise<{ ok: boolean; error?: "no_target" }> {
  const v = await actionViewer("settings.write");
  if (!hasFeature(v, "integrations")) return { ok: false };
  const i = v.tenant.settings.integrations;
  if (!i.webhookUrl && !i.syslogHost) return { ok: false, error: "no_target" };
  const payload = { event: "admin.audit", occurredAt: new Date().toISOString(), tenantId: v.tenant.id, data: { test: true, by: v.user.email } };
  const rows: (typeof t.webhookDeliveries.$inferInsert)[] = [];
  if (i.webhookUrl) rows.push({ tenantId: v.tenant.id, event: "admin.audit", target: "webhook", payload });
  if (i.syslogHost) rows.push({ tenantId: v.tenant.id, event: "admin.audit", target: "syslog", payload });
  await db().insert(t.webhookDeliveries).values(rows);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.integration_test" });
  refresh();
  return { ok: true };
}
