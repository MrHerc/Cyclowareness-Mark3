import "server-only";
import { createConnection as tcpConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { createSocket } from "node:dgram";
import { hostname } from "node:os";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import type { TenantSettings } from "./db/schema";
import { campaignTick } from "./services/campaigns";
import { retryQueued, queueEmail, renderEmailHtml } from "./mail";
import { decryptSecret, hmac } from "./crypto";
import { env } from "./env";
import { DOMAIN_PROOF_GRACE_DAYS, domainProofFound, domainProofRecord } from "./auth/domain-proof";
import { audit } from "./services/audit";
import { resolveAssignments } from "./services/assignments";
import { notifyUsers } from "./services/notify";
import { recomputeRisk, snapshotTenant } from "./services/risk";
import { targetTraining } from "./services/secops";
import { dayKey } from "../lib/domain/gamification";
import { pick } from "../i18n/config";

/**
 * Background work, run every minute by the job runner (src/instrumentation.ts).
 * Every step is idempotent: running a tick twice sends nothing twice.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const APP_URL = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function runJobs(db: DB, now = new Date()): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      out[name] = await fn();
    } catch (error) {
      console.error(`[jobs] ${name} failed`, error);
      out[name] = -1;
    }
  };
  await step("campaigns", async () => (await campaignTick(db), 0));
  await step("mail", () => retryQueued(db));
  await step("events", () => deliverEvents(db, now));
  await step("domains", () => recheckDomains(db, now));
  const tenants = await db.select({ id: t.tenants.id, name: t.tenants.name, settings: t.tenants.settings, branding: t.tenants.branding }).from(t.tenants);
  for (const tenant of tenants) {
    await step(`snapshot:${tenant.id}`, () => dailySnapshot(db, tenant.id, now));
    await step(`reminders:${tenant.id}`, () => reminders(db, tenant, now));
    await step(`managers:${tenant.id}`, () => managerAlerts(db, tenant, now));
    await step(`refreshers:${tenant.id}`, () => refreshers(db, tenant, now));
    await step(`reports:${tenant.id}`, () => scheduledReports(db, tenant, now));
  }
  return out;
}

/* ───────── webhook + syslog delivery ───────── */

const MAX_ATTEMPTS = 6;

/** Signed JSON webhooks and CEF/JSON syslog, with exponential backoff (1, 4, 9, 16, 25 minutes). */
export async function deliverEvents(db: DB, now = new Date()): Promise<number> {
  // Back-off is part of the query so waiting rows do not occupy the batch and starve newer ones.
  const rows = await db
    .select()
    .from(t.webhookDeliveries)
    .where(
      and(
        eq(t.webhookDeliveries.status, "queued"),
        lt(t.webhookDeliveries.attempts, MAX_ATTEMPTS),
        or(eq(t.webhookDeliveries.attempts, 0), sql`${t.webhookDeliveries.createdAt} + (${t.webhookDeliveries.attempts} * ${t.webhookDeliveries.attempts}) * interval '1 minute' <= ${now.toISOString()}::timestamptz`),
      ),
    )
    .orderBy(asc(t.webhookDeliveries.createdAt))
    .limit(50);
  let done = 0;
  const settingsCache = new Map<string, TenantSettings>();
  for (const d of rows) {
    let settings = settingsCache.get(d.tenantId);
    if (!settings) {
      const [tenant] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, d.tenantId));
      if (!tenant) continue;
      settings = tenant.settings;
      settingsCache.set(d.tenantId, settings);
    }
    const i = settings.integrations;
    let ok = false;
    let code: number | null = null;
    let error: string | null = null;
    try {
      if (d.target === "webhook") {
        if (!i.webhookUrl) throw new Error("no webhook address");
        const secret = decryptSecret(i.webhookSecretEnc);
        if (!secret) throw new Error("no signing secret");
        const body = JSON.stringify({ id: d.id, ...d.payload });
        const ts = Math.floor(now.getTime() / 1000).toString();
        const res = await fetch(i.webhookUrl, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "content-type": "application/json",
            "user-agent": "Cyclowareness-Webhooks/1.0",
            "x-cyclowareness-event": d.event,
            "x-cyclowareness-delivery": d.id,
            "x-cyclowareness-timestamp": ts,
            "x-cyclowareness-signature": `sha256=${hmac(body, secret)}`,
            "x-cyclowareness-signature-timestamped": `sha256=${hmac(`${ts}.${body}`, secret)}`,
          },
          body,
        });
        code = res.status;
        ok = res.ok;
        if (!ok) error = `HTTP ${res.status}`;
      } else {
        if (!i.syslogHost) throw new Error("no syslog server");
        await sendSyslog(i.syslogHost, i.syslogPort ?? 6514, i.syslogTransport ?? "tls", formatSyslog(d.event, d.payload, i.syslogFormat ?? "cef", now));
        ok = true;
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : "failed";
    }
    const attempts = d.attempts + 1;
    await db
      .update(t.webhookDeliveries)
      .set(ok ? { status: "delivered", attempts, responseCode: code, error: null, deliveredAt: now } : { status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", attempts, responseCode: code, error })
      .where(eq(t.webhookDeliveries.id, d.id));
    if (ok) done++;
  }
  return done;
}

const SEVERITY_CEF: Record<string, number> = { low: 3, medium: 5, high: 8, critical: 10 };

function cefEscape(v: string, header = false): string {
  return header ? v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|") : v.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\r?\n/g, " ");
}

/** RFC 5424 message carrying CEF or JSON (facility local0, severity by event). */
export function formatSyslog(event: string, payload: Record<string, unknown>, format: "cef" | "json", now: Date): string {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const sev = SEVERITY_CEF[String(data.severity ?? "")] ?? (event.includes("malicious") || event.includes("risky") ? 7 : 4);
  const pri = 16 * 8 + (sev >= 8 ? 2 : sev >= 6 ? 4 : 6);
  const header = `<${pri}>1 ${now.toISOString()} ${hostname()} cyclowareness - ${event.replace(/[^\w.-]/g, "_")} -`;
  if (format === "json") return `${header} ${JSON.stringify(payload)}`;
  const ext = Object.entries({ rt: now.getTime(), cs1Label: "tenant", cs1: String(payload.tenantId ?? ""), ...flatten(data) })
    .map(([k, v]) => `${k}=${cefEscape(String(v))}`)
    .join(" ");
  return `${header} CEF:0|Cyclowareness|Portal|1.0|${cefEscape(event, true)}|${cefEscape(event, true)}|${sev}|${ext}`;
}

function flatten(o: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = k.replace(/[^A-Za-z0-9]/g, "");
    if (!key) continue;
    out[`cs_${key}`.slice(0, 30)] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

function sendSyslog(host: string, port: number, transport: "tls" | "tcp" | "udp", message: string): Promise<void> {
  // TCP framing: octet counting (RFC 6587 §3.4.1).
  const framed = `${Buffer.byteLength(message)} ${message}`;
  return new Promise((resolve, reject) => {
    if (transport === "udp") {
      const s = createSocket(host.includes(":") ? "udp6" : "udp4");
      s.send(Buffer.from(message), port, host, (err) => {
        s.close();
        if (err) reject(err);
        else resolve();
      });
      return;
    }
    const socket = transport === "tls" ? tlsConnect({ host, port, servername: host, timeout: 10_000 }) : tcpConnect({ host, port, timeout: 10_000 });
    socket.once(transport === "tls" ? "secureConnect" : "connect", () => socket.end(framed, () => resolve()));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("syslog timeout"));
    });
    socket.once("error", reject);
  });
}

/* ───────── domain proof re-check ───────── */

/**
 * Once a day the TXT record of every proven domain is resolved again. The domain stays either way;
 * the first missing day is remembered and after 7 days without the record the proof is removed.
 */
async function recheckDomains(db: DB, now: Date): Promise<number> {
  const tenants = await db
    .select({ id: t.tenants.id, domain: t.tenants.domain, settings: t.tenants.settings })
    .from(t.tenants)
    .where(and(isNotNull(t.tenants.domain), isNotNull(t.tenants.domainVerifiedAt)));
  let checked = 0;
  for (const tenant of tenants) {
    const identity = tenant.settings.identity;
    const last = identity.domainCheckedAt ? Date.parse(identity.domainCheckedAt) : 0;
    if (!tenant.domain || identity.domainProofForced || now.getTime() - last < DAY) continue;
    const found = await domainProofFound(tenant.domain, domainProofRecord(tenant.id, env.secret));
    const wasFailing = !!identity.domainCheckFailingSince;
    const failingSince = found ? null : (identity.domainCheckFailingSince ?? now.toISOString());
    const removed = !!failingSince && now.getTime() - Date.parse(failingSince) >= DOMAIN_PROOF_GRACE_DAYS * DAY;
    const settings = structuredClone(tenant.settings);
    if (removed) {
      delete settings.identity.domainCheckedAt;
      delete settings.identity.domainCheckFailingSince;
    } else {
      settings.identity.domainCheckedAt = now.toISOString();
      if (failingSince) settings.identity.domainCheckFailingSince = failingSince;
      else delete settings.identity.domainCheckFailingSince;
    }
    await db
      .update(t.tenants)
      .set({ settings, ...(removed ? { domainVerifiedAt: null } : {}) })
      .where(eq(t.tenants.id, tenant.id));
    // One entry when the record goes missing, one when it is back, one when the proof is removed.
    if (removed || found === wasFailing) {
      await audit(db, {
        tenantId: tenant.id,
        actorId: null,
        action: removed ? "domain.removed" : found ? "domain.rechecked" : "domain.at_risk",
        at: now,
        meta: { domain: tenant.domain, found, ...(failingSince && !removed ? { failingSince } : {}) },
      });
    }
    checked++;
  }
  return checked;
}

/* ───────── daily risk snapshot ───────── */

/** Recomputes every score once a day, then keeps one row per active person (the person page sparkline) and the organisation KPIs. */
async function dailySnapshot(db: DB, tenantId: string, now: Date): Promise<number> {
  const day = dayKey(now);
  const [today] = await db.select({ id: t.riskSnapshots.id }).from(t.riskSnapshots).where(and(eq(t.riskSnapshots.tenantId, tenantId), eq(t.riskSnapshots.day, day)));
  if (today) return 0;
  await recomputeRisk(db, tenantId, undefined, now);
  const people = await db
    .select({ id: t.users.id, score: t.users.riskScore })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), eq(t.users.status, "active")));
  if (people.length) {
    await db
      .insert(t.userRiskSnapshots)
      .values(people.map((p) => ({ tenantId, userId: p.id, day, score: p.score })))
      .onConflictDoNothing();
  }
  await snapshotTenant(db, tenantId, now);
  return 1;
}

/* ───────── training reminders ───────── */

type TenantLite = { id: string; name: string; settings: TenantSettings; branding: { primary: string } };

/** First reminder N days after assignment, urgent reminder N hours before the due date, overdue notice. */
async function reminders(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const n = tenant.settings.notifications;
  const assigned = await resolveAssignments(db, tenant.id);
  type Pending = { userId: string; moduleId: string; assignmentId: string; due: string | null };
  const byKey = new Map<string, Pending>();
  for (const [userId, mods] of assigned) for (const m of mods.values()) byKey.set(`${userId}:${m.moduleId}`, { userId, moduleId: m.moduleId, assignmentId: m.assignmentId, due: m.due });
  // Targeted training (incident, approved material, refresher) lives in behaviour risks, not assignments;
  // a person with both for the same module is listed once, with the earlier due date.
  const risks = await db
    .select({ id: t.behaviorRisks.id, userId: t.behaviorRisks.userId, moduleId: t.behaviorRisks.moduleId, dueDate: t.behaviorRisks.dueDate, createdAt: t.behaviorRisks.createdAt })
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.tenantId, tenant.id), eq(t.behaviorRisks.status, "open"), isNotNull(t.behaviorRisks.moduleId)));
  const riskCreated = new Map<string, Date>();
  for (const r of risks) {
    if (!r.moduleId) continue;
    riskCreated.set(r.id, r.createdAt);
    const key = `${r.userId}:${r.moduleId}`;
    const prev = byKey.get(key);
    if (!prev || (r.dueDate && (!prev.due || r.dueDate < prev.due))) byKey.set(key, { userId: r.userId, moduleId: r.moduleId, assignmentId: r.id, due: r.dueDate });
  }
  const pending = [...byKey.values()];
  if (!pending.length) return 0;
  const userIds = [...new Set(pending.map((p) => p.userId))];
  const [done, mods, assignments, sent] = await Promise.all([
    db.select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId }).from(t.moduleProgress).where(and(inArray(t.moduleProgress.userId, userIds), eq(t.moduleProgress.status, "completed"))),
    db.select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules),
    db.select({ id: t.assignments.id, createdAt: t.assignments.createdAt }).from(t.assignments).where(eq(t.assignments.tenantId, tenant.id)),
    db
      .select({ userId: t.notifications.userId, kind: t.notifications.kind, href: t.notifications.href, createdAt: t.notifications.createdAt })
      .from(t.notifications)
      .where(and(eq(t.notifications.tenantId, tenant.id), inArray(t.notifications.kind, ["reminder", "overdue", "assignment"]), gte(t.notifications.createdAt, new Date(now.getTime() - 400 * DAY)))),
  ]);
  const doneSet = new Set(done.map((d) => `${d.userId}:${d.moduleId}`));
  const modById = new Map(mods.map((m) => [m.id, m]));
  const assignedAt = new Map<string, Date>([...assignments.map((a) => [a.id, a.createdAt] as const), ...riskCreated]);
  const sentBy = new Map<string, { kind: string; at: Date }[]>();
  for (const s of sent) {
    const key = `${s.userId}:${s.href}`;
    sentBy.set(key, [...(sentBy.get(key) ?? []), { kind: s.kind, at: s.createdAt }]);
  }
  const groups = new Map<string, string[]>(); // `${kind}|${moduleId}|${due}` → users
  for (const p of pending) {
    if (doneSet.has(`${p.userId}:${p.moduleId}`)) continue;
    const mod = modById.get(p.moduleId);
    if (!mod) continue;
    const href = `/learn/${mod.slug}`;
    const history = sentBy.get(`${p.userId}:${href}`) ?? [];
    const since = (at: Date) => history.filter((h) => h.at >= at);
    const created = assignedAt.get(p.assignmentId) ?? now;
    const dueAt = p.due ? new Date(`${p.due}T23:59:59+04:00`) : null;
    let kind: "reminder" | "overdue" | null = null;
    if (dueAt && now > dueAt) {
      if (n.overdueNotice && !since(dueAt).some((h) => h.kind === "overdue")) kind = "overdue";
    } else if (dueAt && dueAt.getTime() - now.getTime() <= n.urgentReminderHours * HOUR) {
      if (!since(new Date(dueAt.getTime() - n.urgentReminderHours * HOUR)).some((h) => h.kind === "reminder")) kind = "reminder";
    } else if (now.getTime() - created.getTime() >= n.firstReminderDays * DAY) {
      if (!since(created).some((h) => h.kind === "reminder")) kind = "reminder";
    }
    if (!kind) continue;
    const key = `${kind}|${p.moduleId}|${p.due ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p.userId]);
  }
  let count = 0;
  for (const [key, users] of groups) {
    const [kind, moduleId, due] = key.split("|");
    const mod = modById.get(moduleId)!;
    const title = pick(mod.title, tenant.settings.defaultLocale);
    count += await notifyUsers(db, tenant.id, users, kind as "reminder", { module: title, dueDate: due || undefined, link: `/learn/${mod.slug}` }, { title, href: `/learn/${mod.slug}` });
  }
  return count;
}

/* ───────── manager alerts ───────── */

const MANAGER_REASON: Record<string, (n: number) => string> = {
  az: (n) => `Son 30 gündə ${n} simulyasiyada riskli addım`,
  en: (n) => `${n} risky simulation actions in the last 30 days`,
  ru: (n) => `${n} рискованных действия в симуляциях за 30 дней`,
};

/** Tells department heads when someone in their team keeps failing simulations. At most weekly per person. */
async function managerAlerts(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const n = tenant.settings.notifications;
  if (!n.managerAlerts) return 0;
  const since = new Date(now.getTime() - 30 * DAY);
  const failed = await db
    .select({ userId: t.campaignRecipients.userId, n: sql<number>`count(*)` })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .where(and(eq(t.campaigns.tenantId, tenant.id), gte(t.campaignRecipients.sentAt, since), or(isNotNull(t.campaignRecipients.clickedAt), isNotNull(t.campaignRecipients.submittedAt))))
    .groupBy(t.campaignRecipients.userId);
  const flagged = failed.filter((f) => Number(f.n) >= n.failedSimulations);
  if (!flagged.length) return 0;
  const [people, departments, recent] = await Promise.all([
    db.select({ id: t.users.id, name: t.users.name, departmentId: t.users.departmentId }).from(t.users).where(and(eq(t.users.tenantId, tenant.id), inArray(t.users.id, flagged.map((f) => f.userId)), eq(t.users.status, "active"))),
    db.select({ id: t.departments.id, headUserId: t.departments.headUserId }).from(t.departments).where(eq(t.departments.tenantId, tenant.id)),
    db
      .select({ href: t.notifications.href })
      .from(t.notifications)
      .where(and(eq(t.notifications.tenantId, tenant.id), eq(t.notifications.kind, "manager"), gte(t.notifications.createdAt, new Date(now.getTime() - 7 * DAY)))),
  ]);
  const alerted = new Set(recent.map((r) => r.href));
  const headOf = new Map(departments.map((d) => [d.id, d.headUserId]));
  let count = 0;
  for (const p of people) {
    const head = p.departmentId ? headOf.get(p.departmentId) : null;
    const href = `/admin/users/${p.id}`;
    if (!head || head === p.id || alerted.has(href)) continue;
    const times = Number(flagged.find((f) => f.userId === p.id)?.n ?? 0);
    const reason = (MANAGER_REASON[tenant.settings.defaultLocale] ?? MANAGER_REASON.en)(times);
    count += await notifyUsers(db, tenant.id, [head], "manager", { person: p.name, reason, link: href }, { title: p.name, body: reason, href });
  }
  return count;
}

/* ───────── automatic refresher ───────── */

const REFRESHER_TITLE: Record<string, string> = { az: "Qısa təkrar dərs", en: "Short refresher", ru: "Короткое повторение" };

/** People at or above the risk threshold get one short refresher a month (no penalty, no XP loss). */
async function refreshers(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const l = tenant.settings.learning;
  if (!l.refresher) return 0;
  const month = now.toISOString().slice(0, 7);
  const ref = `REFRESH-${month}`;
  const risky = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"), gte(t.users.riskScore, l.riskThreshold)));
  if (!risky.length) return 0;
  const assigned = await resolveAssignments(db, tenant.id, risky.map((r) => r.id));
  const completed = await db
    .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
    .from(t.moduleProgress)
    .where(and(inArray(t.moduleProgress.userId, risky.map((r) => r.id)), eq(t.moduleProgress.status, "completed")));
  const doneSet = new Set(completed.map((c) => `${c.userId}:${c.moduleId}`));
  // The organisation's own copy of the phishing module wins over the library one.
  const fallbacks = await db
    .select({ id: t.modules.id, tenantId: t.modules.tenantId })
    .from(t.modules)
    .where(and(eq(t.modules.slug, "phishing-email"), eq(t.modules.status, "published"), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, tenant.id))));
  const fallback = fallbacks.find((m) => m.tenantId === tenant.id) ?? fallbacks[0];
  const byModule = new Map<string, string[]>();
  for (const r of risky) {
    const open = [...(assigned.get(r.id)?.values() ?? [])].filter((m) => !doneSet.has(`${r.id}:${m.moduleId}`)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    const moduleId = open[0]?.moduleId ?? fallback?.id;
    if (!moduleId) continue;
    byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), r.id]);
  }
  let count = 0;
  for (const [moduleId, userIds] of byModule) {
    const got = await targetTraining(db, {
      tenantId: tenant.id,
      userIds,
      moduleId,
      severity: "medium",
      kind: "path",
      title: REFRESHER_TITLE[tenant.settings.defaultLocale] ?? REFRESHER_TITLE.en,
      sourceRef: ref,
      dueDate: new Date(now.getTime() + 14 * DAY).toISOString().slice(0, 10),
    });
    count += got.length;
  }
  return count;
}

/* ───────── scheduled reports ───────── */

const REPORT_MAIL: Record<string, { subject: (k: string) => string; body: (k: string, link: string) => string }> = {
  az: { subject: (k) => `Hesabat hazırdır: ${k}`, body: (k, link) => `«${k}» hesabatı hazırdır.\n\nTəhlükəsizlik üçün fayl məktuba əlavə edilmir: konsola daxil olub yükləyin.\n\n${link}` },
  en: { subject: (k) => `Your report is ready: ${k}`, body: (k, link) => `The "${k}" report is ready.\n\nFor security the file is not attached: sign in to the console to download it.\n\n${link}` },
  ru: { subject: (k) => `Отчёт готов: ${k}`, body: (k, link) => `Отчёт «${k}» готов.\n\nВ целях безопасности файл не прикладывается: войдите в консоль, чтобы скачать его.\n\n${link}` },
};
const REPORT_NAMES: Record<string, Record<string, string>> = {
  az: { completion: "Tamamlanma", risk: "Risk", people: "Əməkdaşlar", modules: "Modullar", feedback: "Rəylər", confirmations: "Təsdiqlər", simulations: "Simulyasiyalar", secops: "Təhlükəsizlik əməliyyatları" },
  en: { completion: "Completion", risk: "Risk", people: "People", modules: "Modules", feedback: "Feedback", confirmations: "Confirmations", simulations: "Simulations", secops: "Security operations" },
  ru: { completion: "Завершение", risk: "Риск", people: "Сотрудники", modules: "Модули", feedback: "Отзывы", confirmations: "Подтверждения", simulations: "Симуляции", secops: "Операции безопасности" },
};

/** Notice with a sign-in link to the period's report, on the schedule's weekday (weekly) or day of the month (monthly) at 08:00 Baku time. */
async function scheduledReports(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  // Without email delivery nothing would leave the server; the first send happens on the next due day after it is enabled.
  if (!tenant.settings.email.enabled) return 0;
  const schedules = await db.select().from(t.reportSchedules).where(eq(t.reportSchedules.tenantId, tenant.id));
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Baku" }));
  const weekday = ((local.getDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
  let count = 0;
  for (const s of schedules) {
    const dueToday = s.frequency === "weekly" ? weekday === s.day : local.getDate() === s.day;
    const minGap = s.frequency === "weekly" ? 6 * DAY : 27 * DAY;
    if (!dueToday || local.getHours() < 8 || (s.lastSentAt && now.getTime() - s.lastSentAt.getTime() < minGap)) continue;
    const from = new Date(now.getTime() - (s.frequency === "weekly" ? 7 : 30) * DAY).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    const lang = tenant.settings.defaultLocale in REPORT_MAIL ? tenant.settings.defaultLocale : "en";
    const name = REPORT_NAMES[lang][s.kind] ?? s.kind;
    const link = `${APP_URL()}/api/admin/reports/${s.kind}?format=${s.format}&from=${from}&to=${to}${s.departmentId ? `&d=${s.departmentId}` : ""}`;
    for (const recipient of s.recipients) {
      const text = REPORT_MAIL[lang].body(name, link);
      await queueEmail(db, tenant.id, { to: recipient, subject: REPORT_MAIL[lang].subject(name), text, html: renderEmailHtml(text, { brand: tenant.branding.primary, footer: tenant.name }), kind: "report" });
      count++;
    }
    await db.update(t.reportSchedules).set({ lastSentAt: now }).where(eq(t.reportSchedules.id, s.id));
  }
  return count;
}
