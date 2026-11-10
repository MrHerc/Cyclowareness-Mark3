import "server-only";
import { createConnection as tcpConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { createSocket } from "node:dgram";
import type { LookupAddress } from "node:dns";
import { hostname } from "node:os";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import type { TenantSettings } from "./db/schema";
import { logFailure } from "./db/errors";
import { campaignTick, sendQueuedSms } from "./services/campaigns";
import { advanceDrill } from "./services/drill";
import { retryQueued, queueEmail, renderEmailHtml } from "./mail";
import { decryptSecret, hmac } from "./crypto";
import { guardedRequest, pinnedLookup, vetDestination } from "./net-guard";
import { appUrl } from "./env";
import { DOMAIN_PROOF_GRACE_DAYS, domainProofFound, domainProofRecords } from "./auth/domain-proof";
import { audit } from "./services/audit";
import { RATE_LIMIT_MAX_WINDOW_MS } from "./rate-limit";
import { resolveAssignments } from "./services/assignments";
import { notifyUsers } from "./services/notify";
import { recomputeRisk, snapshotTenant } from "./services/risk";
import { targetTraining } from "./services/secops";
import { teachableTick } from "./services/teachable";
import { dayKey } from "../lib/domain/gamification";
import { MIN_AUDIT_MONTHS, featuresFor, withDefaults } from "../lib/tenant-defaults";
import { dayPlus, todayIn, zonedTime } from "../lib/time";
import { zonedParts } from "../lib/baku-clock";
import { LOCALES, isLocale, pick } from "../i18n/config";
import { messagesFor } from "../i18n/translator";

/**
 * Background work, run every minute by the job runner (src/server/jobs-runner.ts).
 * Every step is idempotent: running a tick twice sends nothing twice.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Time budget per tick for each delivery step (mail, SMS, webhooks/syslog), so one unreachable server cannot hold up the tick. */
const DELIVERY_BUDGET_MS = 20_000;
/** End of a YYYY-MM-DD due day in the organisation's time zone (daylight saving included). */
export const dueEnd = (due: string, timeZone: string) => zonedTime(due, "23:59:59", timeZone);

export async function runJobs(db: DB, now = new Date()): Promise<Record<string, number>> {
  const started = Date.now();
  const out: Record<string, number> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      out[name] = await fn();
    } catch (error) {
      logFailure(`[jobs] ${name} failed`, error);
      out[name] = -1;
    }
  };
  await step("campaigns", async () => (await campaignTick(db), 0));
  // A drill whose dashboard nobody has open still plays to its end (advanceDrill is lease-safe against open dashboards).
  await step("drills", async () => {
    const open = await db.select({ id: t.drillRuns.id, tenantId: t.drillRuns.tenantId }).from(t.drillRuns).where(isNull(t.drillRuns.finishedAt));
    for (const d of open) {
      // One drill that throws must not hold up the others on every tick.
      try {
        await advanceDrill(db, d.tenantId, d.id, now);
      } catch (error) {
        logFailure("[jobs] drill failed", error, { tenantId: d.tenantId, drillId: d.id });
      }
    }
    return open.length;
  });
  await step("mail", () => retryQueued(db, { budgetMs: DELIVERY_BUDGET_MS, now }));
  await step("sms", () => sendQueuedSms(db, { budgetMs: DELIVERY_BUDGET_MS, now }));
  await step("events", () => deliverEvents(db, now));
  await step("domains", () => recheckDomains(db, now));
  await step("cleanup", () => cleanup(db, now));
  const tenants = await db.select({ id: t.tenants.id, name: t.tenants.name, settings: t.tenants.settings, branding: t.tenants.branding }).from(t.tenants);
  const lastRuns = await db.select().from(t.jobRuns);
  const lastRun = new Map(lastRuns.map((r) => [`${r.job}:${r.tenantId}`, r.ranAt]));
  /**
   * At most once an hour per organisation, each resolving its whole assignment graph. The hour counts from the
   * tick's own start (`now`), so a tick that overruns does not push the next run back.
   */
  const hourly = async (job: string, tenantId: string, fn: () => Promise<number>) => {
    const elapsed = now.getTime() - (lastRun.get(`${job}:${tenantId}`)?.getTime() ?? -Infinity);
    if (elapsed >= 0 && elapsed < HOUR) return;
    // Recorded inside the step: a failed run is tried again on the next tick, and a failing write stops nothing else.
    await step(`${job}:${tenantId}`, async () => {
      const n = await fn();
      await db.insert(t.jobRuns).values({ job, tenantId, ranAt: now }).onConflictDoUpdate({ target: [t.jobRuns.job, t.jobRuns.tenantId], set: { ranAt: now } });
      return n;
    });
  };
  for (const row of tenants) {
    const tenant = { ...row, settings: withDefaults(row.settings) };
    await step(`snapshot:${tenant.id}`, () => dailySnapshot(db, tenant.id, tenant.settings.timeZone, now));
    const riskAsked = lastRun.get(`risk:${tenant.id}`);
    if (riskAsked) await step(`risk:${tenant.id}`, () => deferredRisk(db, tenant.id, riskAsked, now));
    await hourly("reminders", tenant.id, () => reminders(db, tenant, now));
    await hourly("managers", tenant.id, () => managerAlerts(db, tenant, now));
    await hourly("refreshers", tenant.id, () => refreshers(db, tenant, now));
    await hourly("teachable", tenant.id, () => teachableTick(db, tenant, now));
    await step(`reports:${tenant.id}`, () => scheduledReports(db, tenant, now));
  }
  await step("tick", async () => {
    const row = { ranAt: now, durationMs: Date.now() - started };
    await db.insert(t.jobTicks).values({ job: "tick", ...row }).onConflictDoUpdate({ target: t.jobTicks.job, set: row });
    return 1;
  });
  return out;
}

/* ───────── webhook + syslog delivery ───────── */

const MAX_ATTEMPTS = 6;

/** Connection-level failures (DNS, refused, timeout): the receiver is down, not the message wrong. */
function isNetworkError(error: unknown): boolean {
  const e = error as { name?: string; code?: string; cause?: { code?: string } };
  const message = String((error as Error)?.message);
  // "unresolvable" comes from the destination check: a DNS outage, like ENOTFOUND. "request_failed": any failure to reach the webhook (guardedRequest).
  return e?.name === "TimeoutError" || e?.name === "AbortError" || /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|EAI_AGAIN)$/.test(e?.code ?? e?.cause?.code ?? "") || message === "syslog timeout" || message === "request_failed" || message === "unresolvable";
}

/** Rows looked at per tick at most (besides the time budget). */
const EVENTS_PER_TICK = 200;

type EventTenant = { settings: TenantSettings; integrations: boolean } | null;

/**
 * Signed JSON webhooks and CEF/JSON syslog, with exponential backoff (1, 4, 9, 16, 25 minutes).
 * Rows queued before the admin switched the integration (or the plan feature) off are not sent;
 * the Settings test event is the exception. Once a receiver is unreachable in a tick, its other
 * rows wait for the next tick without using up attempts, and further pages leave that receiver
 * out, so its backlog never crowds out other organisations' events. The step stops after its
 * time budget.
 */
export async function deliverEvents(db: DB, now = new Date(), budgetMs = DELIVERY_BUDGET_MS): Promise<number> {
  const deadline = Date.now() + budgetMs;
  const tenantCache = new Map<string, EventTenant>();
  const down: { tenantId: string; target: "webhook" | "syslog" }[] = [];
  // Rows looked at in this tick: a failed one can still be due, but gets one attempt per tick.
  const seen: string[] = [];
  let done = 0;
  while (seen.length < EVENTS_PER_TICK && Date.now() <= deadline) {
    // Back-off is part of the query so waiting rows do not occupy the page and starve newer ones.
    const rows = await db
      .select()
      .from(t.webhookDeliveries)
      .where(
        and(
          eq(t.webhookDeliveries.status, "queued"),
          lt(t.webhookDeliveries.attempts, MAX_ATTEMPTS),
          or(eq(t.webhookDeliveries.attempts, 0), sql`${t.webhookDeliveries.createdAt} + (${t.webhookDeliveries.attempts} * ${t.webhookDeliveries.attempts}) * interval '1 minute' <= ${now.toISOString()}::timestamptz`),
          seen.length ? notInArray(t.webhookDeliveries.id, seen) : undefined,
          ...down.map((x) => sql`not (${t.webhookDeliveries.tenantId} = ${x.tenantId} and ${t.webhookDeliveries.target} = ${x.target})`),
        ),
      )
      .orderBy(asc(t.webhookDeliveries.createdAt))
      .limit(Math.min(50, EVENTS_PER_TICK - seen.length));
    if (!rows.length) break;
    for (const d of rows) {
      if (Date.now() > deadline) break;
      if (down.some((x) => x.tenantId === d.tenantId && x.target === d.target)) continue;
      seen.push(d.id);
      const res = await deliverEvent(db, d, tenantCache);
      if (res === "delivered") done++;
      // The receiver is down: this attempt counted, the target's other rows wait for the next tick.
      else if (res === "unreachable") down.push({ tenantId: d.tenantId, target: d.target });
    }
  }
  return done;
}

/** One row of deliverEvents. */
async function deliverEvent(db: DB, d: typeof t.webhookDeliveries.$inferSelect, tenantCache: Map<string, EventTenant>): Promise<"delivered" | "failed" | "unreachable" | "skipped"> {
  let tenant = tenantCache.get(d.tenantId);
  if (tenant === undefined) {
    const [row] = await db.select({ settings: t.tenants.settings, plan: t.tenants.plan, features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, d.tenantId));
    tenant = row ? { settings: withDefaults(row.settings), integrations: featuresFor(row.plan, row.features).has("integrations") } : null;
    tenantCache.set(d.tenantId, tenant);
  }
  if (!tenant) return "skipped";
  const i = tenant.settings.integrations;
  const isTest = (d.payload.data as { test?: unknown } | undefined)?.test === true;
  const switchedOff = !tenant.integrations || (d.target === "webhook" ? !i.webhookEnabled : !i.syslogEnabled);
  if (switchedOff && !isTest) {
    await db.update(t.webhookDeliveries).set({ status: "failed", error: "integration disabled" }).where(eq(t.webhookDeliveries.id, d.id));
    return "failed";
  }
  let ok = false;
  let unreachable = false;
  let code: number | null = null;
  let error: string | null = null;
  try {
    if (d.target === "webhook") {
      if (!i.webhookUrl) throw new Error("no webhook address");
      const secret = decryptSecret(i.webhookSecretEnc);
      if (!secret) throw new Error("no signing secret");
      const body = JSON.stringify({ id: d.id, ...d.payload });
      // Signed at the moment of sending: receivers reject timestamps older than five minutes.
      const ts = Math.floor(Date.now() / 1000).toString();
      // The destination is checked again and the connection pinned to the approved addresses; the answer's body is not read.
      const res = await guardedRequest(i.webhookUrl, {
        kind: "webhook",
        maxBytes: 0,
        method: "POST",
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
      ok = res.status >= 200 && res.status < 300;
      if (!ok) error = `HTTP ${res.status}`;
    } else {
      if (!i.syslogHost) throw new Error("no syslog server");
      const port = i.syslogPort ?? 6514;
      const vetted = await vetDestination(i.syslogHost, port, "syslog");
      if (vetted.problem !== null) throw new Error(vetted.problem);
      await sendSyslog(i.syslogHost, vetted.addresses, port, i.syslogTransport ?? "tls", formatSyslog(d.event, d.payload, i.syslogFormat ?? "cef", new Date()));
      ok = true;
    }
  } catch (e) {
    unreachable = isNetworkError(e);
    error = e instanceof Error ? e.message.slice(0, 300) : "failed";
  }
  const attempts = d.attempts + 1;
  await db
    .update(t.webhookDeliveries)
    .set(ok ? { status: "delivered", attempts, responseCode: code, error: null, deliveredAt: new Date() } : { status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", attempts, responseCode: code, error })
    .where(eq(t.webhookDeliveries.id, d.id));
  return ok ? "delivered" : unreachable ? "unreachable" : "failed";
}

const SEVERITY_CEF: Record<string, number> = { low: 3, medium: 5, high: 8, critical: 10 };

/**
 * CEF escaping. Header fields: backslash and pipe escaped, line breaks removed. Extension values:
 * backslash and equals escaped, every line break (CRLF, lone CR, LF) written as \n, so a value can
 * never split the record on a line-based receiver.
 */
export function cefEscape(v: string, header = false): string {
  return header ? v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ") : v.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * RFC 5424 message carrying CEF or JSON (facility local0, severity by event). The header timestamp
 * and CEF `rt` are the time the event happened (payload.occurredAt), not the delivery time, which
 * goes into cs2 (deliveredAt) so retries and runner downtime do not move events in the SIEM.
 */
export function formatSyslog(event: string, payload: Record<string, unknown>, format: "cef" | "json", deliveredAt: Date): string {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const occurred = new Date(String(payload.occurredAt ?? ""));
  const at = Number.isNaN(occurred.getTime()) ? deliveredAt : occurred;
  const sev = SEVERITY_CEF[String(data.severity ?? "")] ?? (event.includes("malicious") || event.includes("risky") ? 7 : 4);
  const pri = 16 * 8 + (sev >= 8 ? 2 : sev >= 6 ? 4 : 6);
  const header = `<${pri}>1 ${at.toISOString()} ${hostname()} cyclowareness - ${event.replace(/[^\w.-]/g, "_")} -`;
  if (format === "json") return `${header} ${JSON.stringify(payload)}`;
  const ext = Object.entries({ rt: at.getTime(), cs1Label: "tenant", cs1: String(payload.tenantId ?? ""), cs2Label: "deliveredAt", cs2: deliveredAt.toISOString(), ...flatten(data) })
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

/** `addresses`: what the destination check approved for `host`; the connection goes there, never to a second lookup. */
export function sendSyslog(host: string, addresses: LookupAddress[], port: number, transport: "tls" | "tcp" | "udp", message: string): Promise<void> {
  // TCP framing: octet counting (RFC 6587 §3.4.1).
  const framed = `${Buffer.byteLength(message)} ${message}`;
  return new Promise((resolve, reject) => {
    if (transport === "udp") {
      const [to] = addresses;
      const s = createSocket(to.family === 6 ? "udp6" : "udp4");
      s.send(Buffer.from(message), port, to.address, (err) => {
        s.close();
        if (err) reject(err);
        else resolve();
      });
      return;
    }
    const lookup = pinnedLookup(addresses);
    const socket = transport === "tls" ? tlsConnect({ host, port, servername: host, lookup, timeout: 10_000 }) : tcpConnect({ host, port, lookup, timeout: 10_000 });
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
 * Only the check's own identity keys are written, in one statement, so a settings save made during
 * the DNS lookup is kept. The statement only applies when the row is still as it was read: a domain
 * changed, force-proven or verified again (both verify actions write domainCheckedAt or
 * domainCheckFailingSince) in the meantime is left alone until the next tick.
 */
async function recheckDomains(db: DB, now: Date): Promise<number> {
  const tenants = await db
    .select({ id: t.tenants.id, domain: t.tenants.domain, settings: t.tenants.settings })
    .from(t.tenants)
    .where(and(isNotNull(t.tenants.domain), isNotNull(t.tenants.domainVerifiedAt)));
  let checked = 0;
  for (const tenant of tenants) {
    const identity = withDefaults(tenant.settings).identity;
    const last = identity.domainCheckedAt ? Date.parse(identity.domainCheckedAt) : 0;
    if (!tenant.domain || identity.domainProofForced || now.getTime() - last < DAY) continue;
    const found = await domainProofFound(tenant.domain, domainProofRecords(tenant.id));
    const wasFailing = !!identity.domainCheckFailingSince;
    const failingSince = found ? null : (identity.domainCheckFailingSince ?? now.toISOString());
    const removed = !!failingSince && now.getTime() - Date.parse(failingSince) >= DOMAIN_PROOF_GRACE_DAYS * DAY;
    const current = sql`coalesce(${t.tenants.settings} -> 'identity', '{}'::jsonb)`;
    const patched = removed
      ? sql`jsonb_set(${t.tenants.settings}, '{identity}', ${current} - 'domainCheckedAt' - 'domainCheckFailingSince')`
      : sql`jsonb_set(${t.tenants.settings}, '{identity}', (${current} - 'domainCheckFailingSince') || ${JSON.stringify({ domainCheckedAt: now.toISOString(), ...(failingSince ? { domainCheckFailingSince: failingSince } : {}) })}::jsonb)`;
    const updated = await db
      .update(t.tenants)
      .set({ settings: patched, ...(removed ? { domainVerifiedAt: null } : {}) })
      .where(
        and(
          eq(t.tenants.id, tenant.id),
          eq(t.tenants.domain, tenant.domain),
          isNotNull(t.tenants.domainVerifiedAt),
          sql`coalesce((${t.tenants.settings} -> 'identity' ->> 'domainProofForced')::boolean, false) = false`,
          // The values the decision was made from (compared as stored strings).
          sql`${t.tenants.settings} -> 'identity' ->> 'domainCheckFailingSince' is not distinct from ${identity.domainCheckFailingSince ?? null}::text`,
          sql`${t.tenants.settings} -> 'identity' ->> 'domainCheckedAt' is not distinct from ${identity.domainCheckedAt ?? null}::text`,
        ),
      )
      .returning({ id: t.tenants.id });
    if (!updated.length) continue;
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

/* ───────── retention ───────── */

const CLEANUP_BATCH = 5_000;

declare global {
  var __jobsCleanupDay: string | undefined;
}

/** Deletes up to CLEANUP_BATCH rows per call (bounded statements), repeating while full batches come back and time is left. */
async function deleteInBatches(db: DB, table: PgTable, key: PgColumn, where: ReturnType<typeof and>, deadline: number): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = db.select({ id: key }).from(table).where(where).limit(CLEANUP_BATCH);
    const gone = await db.delete(table).where(inArray(key, ids)).returning({ id: key });
    total += gone.length;
    if (gone.length < CLEANUP_BATCH || Date.now() > deadline) return total;
  }
}

/** The same day of the month `months` earlier (UTC), clamped to the last day when that month is shorter. */
export function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(now.getUTCDate(), last));
  return d;
}

/**
 * Once a day per process: sign-in attempts past every lockout window, ended rate-limit windows,
 * expired sessions and sign-in links, watermark codes of ended sessions after 90 days, delivered or
 * finished mail and integration deliveries after 90 days, read notifications after 400 days
 * (the reminder history needs a year), cached tutor answers after a year, and demo requests after
 * 24 months (the privacy policy's promise); then what each organisation set under Settings → Protection.
 */
async function cleanup(db: DB, now: Date): Promise<number> {
  const day = dayKey(now);
  if (globalThis.__jobsCleanupDay === day) return 0;
  const deadline = Date.now() + 30_000;
  const ago = (ms: number) => new Date(now.getTime() - ms);
  let total = 0;
  total += await deleteInBatches(db, t.loginAttempts, t.loginAttempts.id, and(lt(t.loginAttempts.at, ago(2 * DAY))), deadline);
  // Rate-limit windows that have ended (none is longer than RATE_LIMIT_MAX_WINDOW_MS). Batched by
  // window start: every row with an old window start is old, so the batch never reaches a live window.
  total += await deleteInBatches(db, t.rateLimitBuckets, t.rateLimitBuckets.windowStart, and(lt(t.rateLimitBuckets.windowStart, ago(RATE_LIMIT_MAX_WINDOW_MS))), deadline);
  total += await deleteInBatches(db, t.sessions, t.sessions.id, and(lt(t.sessions.expiresAt, now)), deadline);
  total += await deleteInBatches(db, t.authTokens, t.authTokens.id, and(lt(t.authTokens.expiresAt, ago(DAY))), deadline);
  total += await deleteInBatches(
    db,
    t.watermarkCodes,
    t.watermarkCodes.code,
    and(lt(t.watermarkCodes.createdAt, ago(90 * DAY)), or(isNull(t.watermarkCodes.sessionId), notInArray(t.watermarkCodes.sessionId, db.select({ id: t.sessions.id }).from(t.sessions)))),
    deadline,
  );
  total += await deleteInBatches(db, t.outbox, t.outbox.id, and(inArray(t.outbox.status, ["sent", "logged", "failed"]), lt(t.outbox.createdAt, ago(90 * DAY))), deadline);
  total += await deleteInBatches(db, t.webhookDeliveries, t.webhookDeliveries.id, and(inArray(t.webhookDeliveries.status, ["delivered", "failed"]), lt(t.webhookDeliveries.createdAt, ago(90 * DAY))), deadline);
  total += await deleteInBatches(db, t.notifications, t.notifications.id, and(isNotNull(t.notifications.readAt), lt(t.notifications.createdAt, ago(400 * DAY))), deadline);
  total += await deleteInBatches(db, t.tutorCache, t.tutorCache.id, and(lt(t.tutorCache.createdAt, ago(365 * DAY))), deadline);
  total += await deleteInBatches(db, t.demoRequests, t.demoRequests.id, and(lt(t.demoRequests.createdAt, ago(730 * DAY))), deadline);
  // Each organisation's own retention, 0 = keep forever. Lesson progress, XP, attestations and
  // certificates are compliance evidence and are never deleted; open risks are still being remediated.
  const monthsAgo = (months: number) => monthsBefore(now, months);
  for (const org of await db.select({ id: t.tenants.id, settings: t.tenants.settings }).from(t.tenants)) {
    if (Date.now() > deadline) break;
    const { auditMonths: stored, learningMonths } = withDefaults(org.settings).retention;
    // The same floor as the settings form: a value of 1 to 11 stored before the floor existed cannot purge recent history.
    const auditMonths = stored > 0 ? Math.max(stored, MIN_AUDIT_MONTHS) : 0;
    const purged = { auditEntries: 0, answers: 0, risks: 0, recipients: 0, loops: 0, riskSnapshots: 0, threatReports: 0, sandboxAnalyses: 0, labAttempts: 0 };
    // The entries that explain the gaps (the retention setting and earlier purges) are never purged themselves.
    if (auditMonths > 0)
      purged.auditEntries = await deleteInBatches(
        db,
        t.auditLog,
        t.auditLog.id,
        and(eq(t.auditLog.tenantId, org.id), lt(t.auditLog.at, monthsAgo(auditMonths)), notInArray(t.auditLog.action, ["settings.retention", "retention.purged"])),
        deadline,
      );
    if (learningMonths > 0) {
      const cut = monthsAgo(learningMonths);
      purged.answers = await deleteInBatches(db, t.answers, t.answers.id, and(eq(t.answers.tenantId, org.id), lt(t.answers.at, cut)), deadline);
      purged.risks = await deleteInBatches(db, t.behaviorRisks, t.behaviorRisks.id, and(eq(t.behaviorRisks.tenantId, org.id), lt(t.behaviorRisks.closedAt, cut)), deadline);
      purged.loops = await deleteInBatches(db, t.teachableLoops, t.teachableLoops.id, and(eq(t.teachableLoops.tenantId, org.id), eq(t.teachableLoops.status, "closed"), lt(t.teachableLoops.assignedAt, cut)), deadline);
      // Who opened, clicked or submitted in a campaign that ended before the cut (a cancelled one has no end, so its creation);
      // recipients carry no tenant id, so they are found through the campaign. Their teachable loops go with them (cascade).
      const ended = db
        .select({ id: t.campaigns.id })
        .from(t.campaigns)
        .where(and(eq(t.campaigns.tenantId, org.id), inArray(t.campaigns.status, ["completed", "cancelled"]), lt(sql`coalesce(${t.campaigns.completedAt}, ${t.campaigns.createdAt})`, cut)));
      purged.recipients = await deleteInBatches(db, t.campaignRecipients, t.campaignRecipients.id, and(inArray(t.campaignRecipients.campaignId, ended), or(isNull(t.campaignRecipients.sentAt), lt(t.campaignRecipients.sentAt, cut))), deadline);
      purged.riskSnapshots = await deleteInBatches(db, t.userRiskSnapshots, t.userRiskSnapshots.id, and(eq(t.userRiskSnapshots.tenantId, org.id), lt(t.userRiskSnapshots.day, cut.toISOString().slice(0, 10))), deadline);
      // Reported mail can quote third parties; reports still being handled stay.
      purged.threatReports = await deleteInBatches(db, t.threatReports, t.threatReports.id, and(eq(t.threatReports.tenantId, org.id), inArray(t.threatReports.status, ["converted", "dismissed"]), lt(t.threatReports.createdAt, cut)), deadline);
      purged.sandboxAnalyses = await deleteInBatches(db, t.sandboxAnalyses, t.sandboxAnalyses.id, and(eq(t.sandboxAnalyses.tenantId, org.id), lt(t.sandboxAnalyses.createdAt, cut)), deadline);
      // The XP a lab earned is an xp_events row, which stays.
      purged.labAttempts = await deleteInBatches(db, t.labAttempts, t.labAttempts.id, and(eq(t.labAttempts.tenantId, org.id), lt(t.labAttempts.at, cut)), deadline);
    }
    const count = Object.values(purged).reduce((a, b) => a + b, 0);
    total += count;
    // A purge leaves its own entry, so a gap in the organisation's history is explained rather than suspect.
    if (count > 0) {
      await audit(db, {
        tenantId: org.id,
        actorId: null,
        action: "retention.purged",
        at: now,
        meta: { ...purged, ...(auditMonths > 0 ? { auditBefore: monthsAgo(auditMonths).toISOString() } : {}), ...(learningMonths > 0 ? { learningBefore: monthsAgo(learningMonths).toISOString() } : {}) },
      });
    }
  }
  // Done for today only when everything fit in the time budget; otherwise the next tick continues.
  if (Date.now() <= deadline) globalThis.__jobsCleanupDay = day;
  return total;
}

/* ───────── daily risk snapshot ───────── */

/** Recomputes every score once a day, then keeps one row per active person (the person page sparkline) and the organisation KPIs. */
async function dailySnapshot(db: DB, tenantId: string, timeZone: string, now: Date): Promise<number> {
  const day = dayKey(now, timeZone);
  const [today] = await db.select({ id: t.riskSnapshots.id }).from(t.riskSnapshots).where(and(eq(t.riskSnapshots.tenantId, tenantId), eq(t.riskSnapshots.day, day)));
  if (today) return 0;
  await recomputeRisk(db, tenantId, undefined, now);
  // INSERT … SELECT: a row of values per person binds 4 parameters each, past PostgreSQL's 65,535 per statement at 16,384 people.
  await db.execute(
    sql`insert into ${t.userRiskSnapshots} (tenant_id, user_id, day, score) select tenant_id, id, ${day}::date, risk_score from ${t.users} where tenant_id = ${tenantId} and status = 'active' on conflict do nothing`,
  );
  await snapshotTenant(db, tenantId, now);
  return 1;
}

/** The whole-organisation rescoring an assignment change left to the tick (recomputeChanged); one asked for meanwhile stays. */
async function deferredRisk(db: DB, tenantId: string, askedAt: Date, now: Date): Promise<number> {
  await recomputeRisk(db, tenantId, undefined, now);
  await db.delete(t.jobRuns).where(and(eq(t.jobRuns.job, "risk"), eq(t.jobRuns.tenantId, tenantId), lte(t.jobRuns.ranAt, askedAt)));
  return 1;
}

/* ───────── training reminders ───────── */

type TenantLite = { id: string; name: string; settings: TenantSettings; branding: { primary: string } };

/**
 * First reminder N days after the person was assigned (the assignment's date, or the day they
 * joined when that is later), urgent reminder N hours before the due date, overdue notice.
 */
async function reminders(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const n = tenant.settings.notifications;
  const assigned = await resolveAssignments(db, tenant.id);
  type Pending = { userId: string; moduleId: string; since: Date; due: string | null };
  const byKey = new Map<string, Pending>();
  for (const [userId, mods] of assigned) for (const m of mods.values()) byKey.set(`${userId}:${m.moduleId}`, { userId, moduleId: m.moduleId, since: m.assignedAt, due: m.due });
  // Targeted training (incident, approved material, refresher) lives in behaviour risks, not assignments;
  // a person with both for the same module is listed once, with the earlier due date.
  const risks = await db
    .select({ userId: t.behaviorRisks.userId, moduleId: t.behaviorRisks.moduleId, dueDate: t.behaviorRisks.dueDate, createdAt: t.behaviorRisks.createdAt })
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.tenantId, tenant.id), eq(t.behaviorRisks.status, "open"), isNotNull(t.behaviorRisks.moduleId)));
  for (const r of risks) {
    if (!r.moduleId) continue;
    const key = `${r.userId}:${r.moduleId}`;
    const prev = byKey.get(key);
    if (!prev || (r.dueDate && (!prev.due || r.dueDate < prev.due))) byKey.set(key, { userId: r.userId, moduleId: r.moduleId, since: r.createdAt, due: r.dueDate });
  }
  if (!byKey.size) return 0;
  const userIds = [...new Set([...byKey.values()].map((p) => p.userId))];
  const moduleIds = [...new Set([...byKey.values()].map((p) => p.moduleId))];
  const [done, mods] = await Promise.all([
    db
      .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
      .from(t.moduleProgress)
      .where(and(inArray(t.moduleProgress.userId, userIds), inArray(t.moduleProgress.moduleId, moduleIds), eq(t.moduleProgress.status, "completed"))),
    db.select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules).where(inArray(t.modules.id, moduleIds)),
  ]);
  const doneSet = new Set(done.map((d) => `${d.userId}:${d.moduleId}`));
  const modById = new Map(mods.map((m) => [m.id, m]));
  const pending = [...byKey.values()].filter((p) => !doneSet.has(`${p.userId}:${p.moduleId}`) && modById.has(p.moduleId));
  if (!pending.length) return 0;
  // History of the notices that can still matter: since the earliest assignment or urgent window
  // among the open items (at most 400 days), for these people and modules only.
  let earliest = now.getTime();
  for (const p of pending) {
    earliest = Math.min(earliest, p.since.getTime());
    if (p.due) earliest = Math.min(earliest, dueEnd(p.due, tenant.settings.timeZone).getTime() - n.urgentReminderHours * HOUR);
  }
  const hrefs = [...new Set(pending.map((p) => `/learn/${modById.get(p.moduleId)!.slug}`))];
  const pendingUsers = [...new Set(pending.map((p) => p.userId))];
  const sent = await db
    .select({ userId: t.notifications.userId, kind: t.notifications.kind, href: t.notifications.href, createdAt: t.notifications.createdAt })
    .from(t.notifications)
    .where(
      and(
        eq(t.notifications.tenantId, tenant.id),
        inArray(t.notifications.kind, ["reminder", "overdue", "assignment"]),
        inArray(t.notifications.href, hrefs),
        // Very large audiences skip the per-person filter (bind parameter limits); the time window still applies.
        pendingUsers.length <= 5_000 ? inArray(t.notifications.userId, pendingUsers) : undefined,
        gte(t.notifications.createdAt, new Date(Math.max(earliest, now.getTime() - 400 * DAY))),
      ),
    );
  const sentBy = new Map<string, { kind: string; at: Date }[]>();
  for (const s of sent) {
    const key = `${s.userId}:${s.href}`;
    sentBy.set(key, [...(sentBy.get(key) ?? []), { kind: s.kind, at: s.createdAt }]);
  }
  const groups = new Map<string, string[]>(); // `${kind}|${moduleId}|${due}` → users
  for (const p of pending) {
    const mod = modById.get(p.moduleId)!;
    const history = sentBy.get(`${p.userId}:/learn/${mod.slug}`) ?? [];
    const since = (at: Date) => history.filter((h) => h.at >= at);
    const dueAt = p.due ? dueEnd(p.due, tenant.settings.timeZone) : null;
    let kind: "reminder" | "overdue" | null = null;
    if (dueAt && now > dueAt) {
      if (n.overdueNotice && !since(dueAt).some((h) => h.kind === "overdue")) kind = "overdue";
    } else if (dueAt && dueAt.getTime() - now.getTime() <= n.urgentReminderHours * HOUR) {
      if (!since(new Date(dueAt.getTime() - n.urgentReminderHours * HOUR)).some((h) => h.kind === "reminder")) kind = "reminder";
    } else if (now.getTime() - p.since.getTime() >= n.firstReminderDays * DAY) {
      if (!since(p.since).some((h) => h.kind === "reminder")) kind = "reminder";
    }
    if (!kind) continue;
    const key = `${kind}|${p.moduleId}|${p.due ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p.userId]);
  }
  let count = 0;
  for (const [key, users] of groups) {
    const [kind, moduleId, due] = key.split("|");
    const mod = modById.get(moduleId)!;
    // The module title in each recipient's language.
    const title = (locale: string) => pick(mod.title, locale);
    // Deferred like all mail created inside the tick: retryQueued sends it with its time budget and per-server back-off.
    count += await notifyUsers(db, tenant.id, users, kind as "reminder", { module: title, dueDate: due || undefined, link: `/learn/${mod.slug}` }, { href: `/learn/${mod.slug}` }, { defer: true });
  }
  return count;
}

/* ───────── manager alerts ───────── */

/** Translators of the manager-alert reasons (admin.managerAlert, ICU plurals) for every interface language. */
async function managerReasons() {
  const byLocale = new Map(await Promise.all(LOCALES.map(async (l) => [l, createTranslator({ ...(await messagesFor(l)), namespace: "admin.managerAlert" })] as const)));
  return (locale: string) => byLocale.get(isLocale(locale) ? locale : "en")!;
}

/**
 * Tells department heads when someone in their team keeps failing simulations, or is more than
 * Settings → Notifications "overdue for N days" late with assigned training. At most weekly per
 * person and reason; the reason is written in the head's language.
 */
async function managerAlerts(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const n = tenant.settings.notifications;
  if (!n.managerAlerts) return 0;
  const since = new Date(now.getTime() - 30 * DAY);
  const [failed, people, departments, recent] = await Promise.all([
    db
      .select({ userId: t.campaignRecipients.userId, n: sql<number>`count(*)` })
      .from(t.campaignRecipients)
      .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
      .where(and(eq(t.campaigns.tenantId, tenant.id), gte(t.campaignRecipients.sentAt, since), or(isNotNull(t.campaignRecipients.clickedAt), isNotNull(t.campaignRecipients.submittedAt))))
      .groupBy(t.campaignRecipients.userId),
    db.select({ id: t.users.id, name: t.users.name, departmentId: t.users.departmentId }).from(t.users).where(and(eq(t.users.tenantId, tenant.id), eq(t.users.status, "active"), isNotNull(t.users.departmentId))),
    db.select({ id: t.departments.id, headUserId: t.departments.headUserId }).from(t.departments).where(eq(t.departments.tenantId, tenant.id)),
    db
      .select({ href: t.notifications.href })
      .from(t.notifications)
      .where(and(eq(t.notifications.tenantId, tenant.id), eq(t.notifications.kind, "manager"), gte(t.notifications.createdAt, new Date(now.getTime() - 7 * DAY)))),
  ]);
  const alerted = new Set(recent.map((r) => r.href));
  const headOf = new Map(departments.map((d) => [d.id, d.headUserId]));
  const failedBy = new Map(failed.filter((f) => Number(f.n) >= n.failedSimulations).map((f) => [f.userId, Number(f.n)]));

  // Assigned training whose due date passed more than overdueDays ago and is still not completed.
  const overdueBy = new Map<string, number>();
  const assigned = await resolveAssignments(db, tenant.id);
  const overdue: { userId: string; moduleId: string }[] = [];
  for (const [userId, mods] of assigned) {
    for (const m of mods.values()) if (m.due && now.getTime() - dueEnd(m.due, tenant.settings.timeZone).getTime() > n.overdueDays * DAY) overdue.push({ userId, moduleId: m.moduleId });
  }
  if (overdue.length) {
    const done = await db
      .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
      .from(t.moduleProgress)
      .where(and(inArray(t.moduleProgress.userId, [...new Set(overdue.map((o) => o.userId))]), eq(t.moduleProgress.status, "completed")));
    const doneSet = new Set(done.map((d) => `${d.userId}:${d.moduleId}`));
    for (const o of overdue) if (!doneSet.has(`${o.userId}:${o.moduleId}`)) overdueBy.set(o.userId, (overdueBy.get(o.userId) ?? 0) + 1);
  }

  const reasons = await managerReasons();
  let count = 0;
  for (const p of people) {
    const head = p.departmentId ? headOf.get(p.departmentId) : null;
    if (!head || head === p.id) continue;
    const times = failedBy.get(p.id);
    const failHref = `/admin/users/${p.id}`;
    if (times && !alerted.has(failHref)) {
      const reason = (locale: string) => reasons(locale)("failedSimulations", { count: times });
      count += await notifyUsers(db, tenant.id, [head], "manager", { person: p.name, reason, link: failHref }, { title: p.name, body: reason, href: failHref }, { defer: true });
    }
    const late = overdueBy.get(p.id);
    const lateHref = `/admin/users/${p.id}#training`;
    if (late && !alerted.has(lateHref)) {
      const reason = (locale: string) => reasons(locale)("overdueTrainings", { count: late, days: n.overdueDays });
      count += await notifyUsers(db, tenant.id, [head], "manager", { person: p.name, reason, link: lateHref }, { title: p.name, body: reason, href: lateHref }, { defer: true });
    }
  }
  return count;
}

/* ───────── automatic refresher ───────── */

/** The refresher task's title (admin.jobs.refresherTitle) in every interface language. */
async function refresherTitles() {
  const byLocale = new Map(await Promise.all(LOCALES.map(async (l) => [l, createTranslator({ ...(await messagesFor(l)), namespace: "admin.jobs" })("refresherTitle")] as const)));
  return (locale: string) => byLocale.get(isLocale(locale) ? locale : "en")!;
}

/**
 * People at or above the risk threshold get one follow-up training task a month (no penalty, no XP loss):
 * their next open assigned module, else the phishing module, never one they already completed.
 * Whoever already got this month's refresher (open or finished) is left alone until next month.
 */
async function refreshers(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  const l = tenant.settings.learning;
  if (!l.refresher) return 0;
  const month = todayIn(tenant.settings.timeZone, now).slice(0, 7);
  const ref = `REFRESH-${month}`;
  const risky = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"), gte(t.users.riskScore, l.riskThreshold)));
  if (!risky.length) return 0;
  const already = await db
    .select({ userId: t.behaviorRisks.userId })
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.tenantId, tenant.id), eq(t.behaviorRisks.sourceRef, ref)));
  const hadOne = new Set(already.map((a) => a.userId));
  const candidates = risky.filter((r) => !hadOne.has(r.id));
  if (!candidates.length) return 0;
  const assigned = await resolveAssignments(db, tenant.id, candidates.map((r) => r.id));
  const completed = await db
    .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
    .from(t.moduleProgress)
    .where(and(inArray(t.moduleProgress.userId, candidates.map((r) => r.id)), eq(t.moduleProgress.status, "completed")));
  const doneSet = new Set(completed.map((c) => `${c.userId}:${c.moduleId}`));
  // The organisation's own copy of the phishing module wins over the library one.
  const fallbacks = await db
    .select({ id: t.modules.id, tenantId: t.modules.tenantId })
    .from(t.modules)
    .where(and(eq(t.modules.slug, "phishing-email"), eq(t.modules.status, "published"), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, tenant.id))));
  const fallback = fallbacks.find((m) => m.tenantId === tenant.id) ?? fallbacks[0];
  const byModule = new Map<string, string[]>();
  for (const r of candidates) {
    const open = [...(assigned.get(r.id)?.values() ?? [])].filter((m) => !doneSet.has(`${r.id}:${m.moduleId}`)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    const moduleId = open[0]?.moduleId ?? (fallback && !doneSet.has(`${r.id}:${fallback.id}`) ? fallback.id : undefined);
    if (!moduleId) continue;
    byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), r.id]);
  }
  let count = 0;
  const title = await refresherTitles();
  for (const [moduleId, userIds] of byModule) {
    const got = await targetTraining(db, {
      tenantId: tenant.id,
      userIds,
      moduleId,
      severity: "medium",
      kind: "path",
      title,
      sourceRef: ref,
      dueDate: dayPlus(14, tenant.settings.timeZone, now),
    });
    count += got.length;
  }
  return count;
}

/* ───────── scheduled reports ───────── */

/** Notice with a sign-in link to the period's report, on the schedule's weekday (weekly) or day of the month (monthly) at 08:00 in the organisation's time zone. */
export async function scheduledReports(db: DB, tenant: TenantLite, now: Date): Promise<number> {
  // Without email delivery nothing would leave the server; the first send happens on the next due day after it is enabled.
  if (!tenant.settings.email.enabled) return 0;
  const tz = tenant.settings.timeZone;
  const schedules = await db.select().from(t.reportSchedules).where(eq(t.reportSchedules.tenantId, tenant.id));
  // The organisation's wall clock, whatever the server's own zone.
  const local = zonedParts(now, tz);
  const weekday = ((new Date(`${local.date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
  let count = 0;
  for (const s of schedules) {
    const dueToday = s.frequency === "weekly" ? weekday === s.day : Number(local.date.slice(8)) === s.day;
    const minGap = s.frequency === "weekly" ? 6 * DAY : 27 * DAY;
    if (!dueToday || local.time < "08:00" || (s.lastSentAt && now.getTime() - s.lastSentAt.getTime() < minGap)) continue;
    const from = dayPlus(-(s.frequency === "weekly" ? 7 : 30), tz, now);
    const to = todayIn(tz, now);
    // Opened while signed out, the link leads through sign-in (in the reader's language) to the download.
    const link = `${appUrl()}/api/admin/reports/${s.kind}?format=${s.format}&from=${from}&to=${to}${s.departmentId ? `&d=${s.departmentId}` : ""}`;
    // Each recipient in their own language: a person of the organisation in their profile language, an
    // outside address in that of whoever scheduled the report, else the organisation's default.
    const known = s.recipients.length
      ? await db
          .select({ email: t.users.email, locale: t.users.locale })
          .from(t.users)
          .where(and(eq(t.users.tenantId, tenant.id), inArray(t.users.email, s.recipients.map((r) => r.toLowerCase()))))
      : [];
    const localeOf = new Map(known.map((u) => [u.email, u.locale]));
    const [creator] = s.createdBy ? await db.select({ locale: t.users.locale }).from(t.users).where(eq(t.users.id, s.createdBy)) : [];
    for (const recipient of s.recipients) {
      const lang = [localeOf.get(recipient.toLowerCase()), creator?.locale, tenant.settings.defaultLocale].find(isLocale) ?? "en";
      const tr = createTranslator({ ...(await messagesFor(lang, tz)), namespace: "admin.reports" });
      const report = tr(`kinds.${s.kind}.title`);
      const text = tr("mail.body", { report, link });
      await queueEmail(
        db,
        tenant.id,
        { to: recipient, subject: tr("mail.subject", { report }), text, html: renderEmailHtml(text, { brand: tenant.branding.primary, footer: tenant.name, buttonLabel: tr("mail.button"), lang }), kind: "report", lang },
        { defer: true },
      );
      count++;
    }
    await db.update(t.reportSchedules).set({ lastSentAt: now }).where(eq(t.reportSchedules.id, s.id));
  }
  return count;
}
