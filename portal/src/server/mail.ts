import { and, asc, eq, gte, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import type { TenantSettings } from "./db/schema";
import { decryptSecret } from "./crypto";
import { normaliseHost } from "./auth/domain-proof";
import { destinationProblem } from "./net-guard";
import { env } from "./env";
import { parseEmailMarkup } from "../lib/email-markup";
import { withDefaults } from "../lib/tenant-defaults";
import { TEMPLATE_BY_KEY, templateText } from "../lib/campaigns/templates";

/**
 * Outgoing email. Everything goes through the outbox table first (delivery log + retries).
 * Without a mail server the message is kept with status "logged" so admins can see it.
 * `fromName` replaces the organisation's display name for this one message (phishing
 * simulations show the template's sender); the address is always the organisation's own.
 */
export type Mail = { to: string; subject: string; text: string; html?: string; kind: string; fromName?: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Simple branded HTML from plain text; URLs on their own line become buttons. With `markup`
 * (notification templates), **bold**, _italic_ and [text](https://…) links are rendered too.
 */
export function renderEmailHtml(text: string, opts: { brand?: string; footer?: string; buttonLabel?: string; markup?: boolean } = {}): string {
  const brand = opts.brand ?? "#4f46e5";
  const inline = (s: string) =>
    opts.markup
      ? parseEmailMarkup(s)
          .map((tok) => {
            const x = escapeHtml(tok.text);
            if (tok.kind === "bold") return `<b>${x}</b>`;
            if (tok.kind === "italic") return `<i>${x}</i>`;
            if (tok.kind === "link") return `<a href="${escapeHtml(tok.href)}" style="color:${brand}">${x}</a>`;
            return x;
          })
          .join("")
      : escapeHtml(s);
  const body = text
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trim();
      if (/^https?:\/\/\S+$/.test(trimmed)) {
        return `<p style="margin:24px 0"><a href="${escapeHtml(trimmed)}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${escapeHtml(opts.buttonLabel ?? "Open")}</a></p>`;
      }
      return `<p style="margin:0 0 14px;line-height:1.55">${inline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f7f6fb;font-family:Segoe UI,Arial,sans-serif;color:#16123a"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e7e5f0;border-radius:20px;padding:28px">${body}</div>${opts.footer ? `<p style="font-size:12px;color:#6b6788;margin:16px 8px">${escapeHtml(opts.footer)}</p>` : ""}</div></body></html>`;
}

type Transport = { transporter: Transporter; address: string; name: string; replyTo?: string };

/**
 * Why an organisation's mail cannot go out: "not_configured" keeps the message as logged (no mail
 * server set up); "unresolvable" is a DNS failure on the saved host and is retried like an
 * unreachable server; "blocked_destination" means the saved host may not be used (private
 * address, port not allowed), so the message fails visibly and can be resent once it is fixed.
 */
type TransportProblem = "not_configured" | "unresolvable" | "blocked_destination";

/**
 * SMTP timeouts. socketTimeout bounds a server that accepts the connection and then stalls
 * (nodemailer's default is ten minutes, which would hold up the whole job tick).
 */
const SMTP_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000, dnsTimeout: 10_000 } as const;

/**
 * Platform mail that belongs to no organisation (demo requests to SALES_EMAIL) goes through the
 * operator's own server from the environment (PLATFORM_SMTP_*); without one it is only logged.
 */
function platformTransport(): Transport | null {
  if (!env.PLATFORM_SMTP_HOST || !env.PLATFORM_MAIL_FROM) return null;
  const secure = env.PLATFORM_SMTP_SECURE === "1";
  const transporter = nodemailer.createTransport({
    host: env.PLATFORM_SMTP_HOST,
    port: env.PLATFORM_SMTP_PORT,
    secure,
    requireTLS: !secure,
    auth: env.PLATFORM_SMTP_USER ? { user: env.PLATFORM_SMTP_USER, pass: env.PLATFORM_SMTP_PASSWORD ?? "" } : undefined,
    ...SMTP_TIMEOUTS,
  });
  return { transporter, address: env.PLATFORM_MAIL_FROM, name: "Cyclowareness" };
}

/**
 * The organisation's mail server and sender. Settings → Email wins; without a sender address
 * there, mail goes out as no-reply at the Branding sender domain once that domain is proven.
 * The display name falls back to Branding → Sender name, then the organisation's name.
 */
async function transportFor(db: DB, tenantId: string | null, emailOverride?: TenantSettings["email"]): Promise<Transport | TransportProblem> {
  if (!tenantId) return platformTransport() ?? "not_configured";
  const [tenant] = await db
    .select({ settings: t.tenants.settings, name: t.tenants.name, branding: t.tenants.branding, domain: t.tenants.domain, domainVerifiedAt: t.tenants.domainVerifiedAt })
    .from(t.tenants)
    .where(eq(t.tenants.id, tenantId));
  const e = emailOverride ?? (tenant ? withDefaults(tenant.settings).email : undefined);
  if (!tenant || !e?.enabled || !e.host) return "not_configured";
  // Re-checked at send time: a saved name may have been re-pointed at an internal address since.
  // A failed lookup is a DNS outage, not a configuration problem: the message waits for a retry.
  const problem = await destinationProblem(e.host, e.port ?? 587, "smtp");
  if (problem) return problem === "unresolvable" ? "unresolvable" : "blocked_destination";
  const proven = !!tenant.domainVerifiedAt && !!tenant.branding.senderDomain && normaliseHost(tenant.branding.senderDomain) === tenant.domain;
  const address = e.fromAddress || (proven ? `no-reply@${tenant.domain}` : undefined);
  if (!address) return "not_configured";
  const transporter = nodemailer.createTransport({
    host: e.host,
    port: e.port ?? 587,
    secure: !!e.secure,
    requireTLS: !e.secure,
    auth: e.user ? { user: e.user, pass: decryptSecret(e.passwordEnc) ?? "" } : undefined,
    ...SMTP_TIMEOUTS,
  });
  return { transporter, address, name: e.fromName || tenant.branding.senderName || tenant.name, replyTo: e.replyTo };
}

function fromHeader(transport: Transport, fromName?: string): string {
  return `"${(fromName ?? transport.name).replace(/"/g, "")}" <${transport.address}>`;
}

/** Error stored on a simulation that was not sent because its campaign was cancelled meanwhile. */
export const CAMPAIGN_CANCELLED_ERROR = "campaign_cancelled";

/**
 * Display name of a phishing simulation message (the template's sender in the recipient's
 * language) and whether its campaign was cancelled meanwhile, found through the tracking token in
 * the message. Deferred simulations are sent by the job runner, which only has the stored row.
 */
async function simulationInfo(db: DB, m: { kind: string; text: string }): Promise<{ senderName?: string; cancelled: boolean }> {
  if (m.kind !== "simulation") return { cancelled: false };
  const token = [...m.text.matchAll(/\/t\/([a-z0-9]{16,64})\b/g)].at(-1)?.[1];
  if (!token) return { cancelled: false };
  const [row] = await db
    .select({ templateKey: t.campaigns.templateKey, status: t.campaigns.status, locale: t.users.locale })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(eq(t.campaignRecipients.token, token));
  const tpl = row ? TEMPLATE_BY_KEY.get(row.templateKey) : undefined;
  return { senderName: tpl ? templateText(tpl.sender.name, row.locale) : undefined, cancelled: row?.status === "cancelled" };
}

/**
 * Stores the message and sends it right away. With `defer` it only joins the outbox and the
 * job runner sends it (bulk sends such as campaigns and invitations stay out of the request).
 */
export async function queueEmail(db: DB, tenantId: string | null, mail: Mail, opts: { defer?: boolean } = {}): Promise<{ id: string; status: "sent" | "failed" | "logged" | "queued" }> {
  const html = mail.html ?? renderEmailHtml(mail.text);
  const [row] = await db
    .insert(t.outbox)
    .values({ tenantId, to: mail.to, subject: mail.subject, text: mail.text, html, kind: mail.kind, status: "queued" })
    .returning({ id: t.outbox.id });
  if (opts.defer) return { id: row.id, status: "queued" };
  const status = await deliver(db, row.id, { fromName: mail.fromName });
  return { id: row.id, status };
}

/**
 * Retry schedule: attempt n+1 is due this many minutes after the message was queued (attempts
 * 1…8 over a day). After the last one the message is "failed" and can be resent from Settings → Email.
 */
export const RETRY_DUE_MINUTES = [1, 2, 5, 15, 60, 240, 720, 1440] as const;
export const MAX_MAIL_ATTEMPTS = RETRY_DUE_MINUTES.length;

/** Errors where the server itself was not reachable (as opposed to a refused message). */
function isConnectionError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? "";
  return /^(ECONNECTION|ETIMEDOUT|ESOCKET|EDNS|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EAI_AGAIN)$/.test(code) || /E(CONNREFUSED|NOTFOUND|TIMEDOUT|HOSTUNREACH|AI_AGAIN)|Greeting never received|Connection (timeout|closed)/i.test(String((error as Error)?.message ?? ""));
}

/**
 * Failures that concern the server rather than this one message: unreachable, a rejected sign-in
 * (a rotated password; repeating it for every queued message could lock the account) or a
 * temporary refusal of the whole service (421, 454). The organisation's other messages wait.
 */
function stopsServer(error: unknown): boolean {
  const e = error as { code?: string; responseCode?: number } | undefined;
  return isConnectionError(error) || e?.code === "EAUTH" || e?.responseCode === 421 || e?.responseCode === 454;
}

/** `stop`: leave the organisation's (or the platform's) other messages for the next tick. */
type Delivery = { status: "sent" | "failed" | "logged" | "queued"; stop: boolean };
type OutboxRow = typeof t.outbox.$inferSelect;
type TransportCache = Map<string, Transport | TransportProblem>;

/** One attempt used up: the message stays queued for the retry schedule, or fails after the last attempt. */
async function recordFailure(db: DB, m: OutboxRow, error: string, stop: boolean): Promise<Delivery> {
  const attempts = m.attempts + 1;
  const status = attempts >= MAX_MAIL_ATTEMPTS ? "failed" : "queued";
  await db.update(t.outbox).set({ status, attempts, error: error.slice(0, 500) }).where(eq(t.outbox.id, m.id));
  return { status, stop };
}

async function deliverRow(db: DB, id: string, opts: { fromName?: string; transports?: TransportCache }): Promise<Delivery> {
  const [m] = await db.select().from(t.outbox).where(eq(t.outbox.id, id));
  if (!m) return { status: "failed", stop: false };
  const sim = await simulationInfo(db, m);
  if (sim.cancelled) {
    // Retries run for a day and Resend reaches back a week: a cancelled campaign must not reach anyone.
    await db.update(t.outbox).set({ status: "failed", error: CAMPAIGN_CANCELLED_ERROR }).where(eq(t.outbox.id, id));
    return { status: "failed", stop: false };
  }
  const key = m.tenantId ?? "platform";
  let transport = opts.transports?.get(key);
  if (transport === undefined) {
    transport = await transportFor(db, m.tenantId);
    opts.transports?.set(key, transport);
  }
  if (transport === "not_configured") {
    await db.update(t.outbox).set({ status: "logged" }).where(eq(t.outbox.id, id));
    if (!env.isProd) console.info(`[mail:logged] to=${m.to} subject="${m.subject}"`);
    return { status: "logged", stop: false };
  }
  if (transport === "blocked_destination") {
    await db.update(t.outbox).set({ status: "failed", attempts: m.attempts + 1, error: transport }).where(eq(t.outbox.id, id));
    return { status: "failed", stop: false };
  }
  if (transport === "unresolvable") return recordFailure(db, m, transport, true);
  try {
    const fromName = opts.fromName ?? sim.senderName;
    await transport.transporter.sendMail({ from: fromHeader(transport, fromName), replyTo: transport.replyTo, to: m.to, subject: m.subject, text: m.text, html: m.html });
    await db.update(t.outbox).set({ status: "sent", sentAt: new Date(), attempts: m.attempts + 1, error: null }).where(eq(t.outbox.id, id));
    return { status: "sent", stop: false };
  } catch (error) {
    return recordFailure(db, m, String((error as Error)?.message ?? error), stopsServer(error));
  }
}

/** `transports` lets one tick reuse a connection per tenant. */
export async function deliver(db: DB, id: string, opts: { fromName?: string; transports?: TransportCache } = {}): Promise<"sent" | "failed" | "logged" | "queued"> {
  return (await deliverRow(db, id, opts)).status;
}

/**
 * Background delivery of queued messages (called by the job runner), following the retry
 * schedule. Once an organisation's server is unreachable (or refuses the sign-in) in a tick, its
 * other messages wait for the next tick without using up attempts, and further pages of due
 * messages leave that organisation out, so its backlog never crowds out other organisations' mail.
 * The step stops after `limit` attempts or `budgetMs`, so one slow server cannot hold up the tick.
 */
export async function retryQueued(db: DB, opts: { limit?: number; budgetMs?: number; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 200;
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const due = sql`(${sql.raw(`ARRAY[${RETRY_DUE_MINUTES.join(",")}]`)})[least(${t.outbox.attempts}, ${MAX_MAIL_ATTEMPTS - 1}) + 1]`;
  const transports: TransportCache = new Map();
  const down = new Set<string>();
  let platformDown = false;
  // Tried in this tick: a message that failed can still be due (queued long ago), but gets one attempt per tick.
  const tried: string[] = [];
  let handled = 0;
  while (handled < limit && Date.now() <= deadline) {
    const rows = await db
      .select({ id: t.outbox.id, tenantId: t.outbox.tenantId })
      .from(t.outbox)
      .where(
        and(
          eq(t.outbox.status, "queued"),
          lt(t.outbox.attempts, MAX_MAIL_ATTEMPTS),
          sql`${t.outbox.createdAt} + ${due} * interval '1 minute' <= ${now.toISOString()}::timestamptz`,
          tried.length ? notInArray(t.outbox.id, tried) : undefined,
          // NOT IN alone would also leave out platform mail (tenant_id null).
          down.size ? or(isNull(t.outbox.tenantId), notInArray(t.outbox.tenantId, [...down])) : undefined,
          platformDown ? isNotNull(t.outbox.tenantId) : undefined,
        ),
      )
      .orderBy(asc(t.outbox.createdAt))
      .limit(Math.min(100, limit - handled));
    if (!rows.length) break;
    for (const r of rows) {
      if (handled >= limit || Date.now() > deadline) break;
      if (r.tenantId ? down.has(r.tenantId) : platformDown) continue;
      tried.push(r.id);
      const res = await deliverRow(db, r.id, { transports });
      handled++;
      if (res.stop) {
        if (r.tenantId) down.add(r.tenantId);
        else platformDown = true;
      }
    }
  }
  return handled;
}

/** Resending from Settings → Email: failed messages of the last week (older ones are stale). */
export const RESEND_WINDOW_MS = 7 * 86_400_000;

/**
 * Failed messages of an organisation that Settings → Email may queue again: from the last week,
 * and never a simulation whose campaign was cancelled.
 */
export function resendableMail(tenantId: string, now: Date) {
  return and(
    eq(t.outbox.tenantId, tenantId),
    eq(t.outbox.status, "failed"),
    gte(t.outbox.createdAt, new Date(now.getTime() - RESEND_WINDOW_MS)),
    sql`${t.outbox.error} is distinct from ${CAMPAIGN_CANCELLED_ERROR}`,
  )!;
}

/** Connection test from Settings → Email. */
export type MailTestError = "not_configured" | "blocked_destination" | "connection_failed" | "auth_failed" | "tls_error" | "send_failed";

/** Coarse categories for the admin: the raw SMTP error would describe whatever host was probed. */
function classifySmtpError(error: unknown): MailTestError {
  const m = String((error as Error)?.message ?? "");
  if (/E(CONNREFUSED|NOTFOUND|TIMEDOUT|HOSTUNREACH|AI_AGAIN)|Greeting never received|Connection (timeout|closed)/i.test(m)) return "connection_failed";
  if (/\b(535|534|530)\b|auth|credentials|password/i.test(m)) return "auth_failed";
  if (/tls|ssl|certificate|handshake/i.test(m)) return "tls_error";
  return "send_failed";
}

/** `emailOverride` lets Settings test a server before sending is switched on. */
export async function sendTestEmail(db: DB, tenantId: string, to: string, subject: string, text: string, emailOverride?: TenantSettings["email"]): Promise<{ ok: true } | { ok: false; error: MailTestError }> {
  const e = emailOverride;
  if (e?.host && (await destinationProblem(e.host, e.port ?? 587, "smtp"))) return { ok: false, error: "blocked_destination" };
  const transport = await transportFor(db, tenantId, emailOverride);
  if (transport === "unresolvable") return { ok: false, error: "connection_failed" };
  if (typeof transport === "string") return { ok: false, error: transport };
  try {
    await transport.transporter.verify();
    await transport.transporter.sendMail({ from: fromHeader(transport), to, subject, text, html: renderEmailHtml(text) });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: classifySmtpError(error) };
  }
}
