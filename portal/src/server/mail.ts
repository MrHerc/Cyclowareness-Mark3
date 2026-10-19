import { and, asc, eq, lt } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import type { DB } from "./db/client";
import * as t from "./db/schema";
import { decryptSecret } from "./crypto";
import { normaliseHost } from "./auth/domain-proof";
import { parseEmailMarkup } from "../lib/email-markup";

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
 * The organisation's mail server and sender. Settings → Email wins; without a sender address
 * there, mail goes out as no-reply at the Branding sender domain once that domain is proven.
 * The display name falls back to Branding → Sender name, then the organisation's name.
 */
async function transportFor(db: DB, tenantId: string | null): Promise<Transport | null> {
  if (!tenantId) return null;
  const [tenant] = await db
    .select({ settings: t.tenants.settings, name: t.tenants.name, branding: t.tenants.branding, domain: t.tenants.domain, domainVerifiedAt: t.tenants.domainVerifiedAt })
    .from(t.tenants)
    .where(eq(t.tenants.id, tenantId));
  const e = tenant?.settings.email;
  if (!tenant || !e?.enabled || !e.host) return null;
  const proven = !!tenant.domainVerifiedAt && !!tenant.branding.senderDomain && normaliseHost(tenant.branding.senderDomain) === tenant.domain;
  const address = e.fromAddress || (proven ? `no-reply@${tenant.domain}` : undefined);
  if (!address) return null;
  const transporter = nodemailer.createTransport({
    host: e.host,
    port: e.port ?? 587,
    secure: !!e.secure,
    requireTLS: !e.secure,
    auth: e.user ? { user: e.user, pass: decryptSecret(e.passwordEnc) ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return { transporter, address, name: e.fromName || tenant.branding.senderName || tenant.name, replyTo: e.replyTo };
}

function fromHeader(transport: Transport, fromName?: string): string {
  return `"${(fromName ?? transport.name).replace(/"/g, "")}" <${transport.address}>`;
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

/** `transports` lets one tick reuse a connection per tenant; `fromName` is only known on the first attempt. */
export async function deliver(db: DB, id: string, opts: { fromName?: string; transports?: Map<string, Transport | null> } = {}): Promise<"sent" | "failed" | "logged" | "queued"> {
  const [m] = await db.select().from(t.outbox).where(eq(t.outbox.id, id));
  if (!m) return "failed";
  let transport = m.tenantId ? opts.transports?.get(m.tenantId) : null;
  if (transport === undefined) {
    transport = await transportFor(db, m.tenantId);
    if (m.tenantId) opts.transports?.set(m.tenantId, transport);
  }
  if (!transport) {
    await db.update(t.outbox).set({ status: "logged" }).where(eq(t.outbox.id, id));
    if (process.env.NODE_ENV !== "production") console.info(`[mail:logged] to=${m.to} subject="${m.subject}"`);
    return "logged";
  }
  try {
    await transport.transporter.sendMail({ from: fromHeader(transport, opts.fromName), replyTo: transport.replyTo, to: m.to, subject: m.subject, text: m.text, html: m.html });
    await db.update(t.outbox).set({ status: "sent", sentAt: new Date(), attempts: m.attempts + 1, error: null }).where(eq(t.outbox.id, id));
    return "sent";
  } catch (error) {
    const attempts = m.attempts + 1;
    await db
      .update(t.outbox)
      .set({ status: attempts >= 5 ? "failed" : "queued", attempts, error: String((error as Error).message).slice(0, 500) })
      .where(eq(t.outbox.id, id));
    return attempts >= 5 ? "failed" : "queued";
  }
}

/** Background delivery of queued messages (called by the job runner). Rows younger than a minute may still be in their first attempt. */
export async function retryQueued(db: DB, limit = 200): Promise<number> {
  const rows = await db
    .select({ id: t.outbox.id })
    .from(t.outbox)
    .where(and(eq(t.outbox.status, "queued"), lt(t.outbox.createdAt, new Date(Date.now() - 60_000))))
    .orderBy(asc(t.outbox.createdAt))
    .limit(limit);
  const transports = new Map<string, Transport | null>();
  for (const r of rows) await deliver(db, r.id, { transports });
  return rows.length;
}

/** Connection test from Settings → Email. */
export async function sendTestEmail(db: DB, tenantId: string, to: string, subject: string, text: string) {
  const transport = await transportFor(db, tenantId);
  if (!transport) return { ok: false as const, error: "not_configured" };
  try {
    await transport.transporter.verify();
    await transport.transporter.sendMail({ from: fromHeader(transport), to, subject, text, html: renderEmailHtml(text) });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: String((error as Error).message).slice(0, 300) };
  }
}
