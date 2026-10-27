import { and, eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { TemplateKind } from "../db/schema";
import { queueEmail, renderEmailHtml } from "../mail";
import { appUrl } from "../env";
import { DEFAULT_TEMPLATES, DEFAULT_TEMPLATES_NO_DUE, FIXED_MESSAGES, emailButtonLabel, withDefaults } from "../../lib/tenant-defaults";
import { escapeEmailMarkup, stripEmailMarkup } from "../../lib/email-markup";
import { formatAzDate } from "../../lib/az-format";
import { messagesFor } from "../../i18n/translator";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** A due day ("2026-10-30") written for the recipient: "30 oktyabr 2026", "October 30, 2026", "30 октября 2026 г.". */
function formatDay(day: string | undefined, lang: string): string {
  if (!day) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const d = new Date(`${day}T12:00:00Z`);
  return lang === "az" ? formatAzDate(d, { dateStyle: "long" }, "UTC") : new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(d);
}

export type NotifyKind = TemplateKind | keyof typeof FIXED_MESSAGES;

/**
 * A value that depends on the recipient's language (module titles, reasons): resolved per person
 * with the same language as the email template, so one message never mixes two languages.
 */
export type Localized = string | ((locale: string) => string);

const resolve = (value: Localized | undefined, locale: string): string | undefined => (typeof value === "function" ? value(locale) : value);

function isTemplateKind(kind: NotifyKind): kind is TemplateKind {
  return kind in DEFAULT_TEMPLATES;
}

const DATED = /\{\{\s*dueDate\s*\}\}/;

/**
 * Sends a templated message (in-app notification + email in each person's language).
 * Email uses the tenant's template for that language, falling back to the defaults (also when a
 * stored template is blank); the fixed kinds (policy signature, confirmation nudge) have no
 * editable template. Without a due date, an assignment or reminder uses the undated default
 * wording (also instead of a custom template that mentions {{dueDate}}), never "by —".
 * The in-app notification (`inApp`) is titled with the default subject in the person's language
 * ("Reminder: …", "Overdue: …") unless a title is given, and says the due date when there is one.
 * Only active people are written to by default; `statuses` widens this (welcome mail to the invited).
 */
export async function notifyUsers(
  db: DB,
  tenantId: string,
  userIds: string[],
  kind: NotifyKind,
  vars: { module?: Localized; dueDate?: string; person?: string; reason?: Localized; link?: string },
  inApp?: { title?: Localized; body?: Localized; href?: string },
  opts: { statuses?: ("active" | "invited")[]; defer?: boolean } = {},
): Promise<number> {
  if (!userIds.length) return 0;
  const [tenant] = await db.select().from(t.tenants).where(eq(t.tenants.id, tenantId));
  if (!tenant) return 0;
  const settings = withDefaults(tenant.settings);
  const users = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), inArray(t.users.id, userIds), inArray(t.users.status, opts.statuses ?? ["active"])));
  const undated = !vars.dueDate && (kind === "assignment" || kind === "reminder") ? DEFAULT_TEMPLATES_NO_DUE[kind] : null;
  const messages = undated ?? (isTemplateKind(kind) ? DEFAULT_TEMPLATES[kind] : FIXED_MESSAGES[kind]);
  const base = appUrl();
  const dueText = new Map<string, string>();
  for (const u of users) {
    const lang = u.locale in messages ? u.locale : "en";
    const stored = isTemplateKind(kind) ? settings.notifications.templates?.[kind]?.[lang] : undefined;
    const fallback = messages[lang];
    const usable = (s: string | undefined): s is string => !!s?.trim() && !(undated && DATED.test(s));
    const tpl = { subject: usable(stored?.subject) ? stored.subject : fallback.subject, body: usable(stored?.body) ? stored.body : fallback.body };
    const link = vars.link ? `${base}${vars.link}` : base;
    const values = {
      name: u.name.split(" ")[0],
      organisation: tenant.name,
      module: resolve(vars.module, lang) ?? "",
      dueDate: formatDay(vars.dueDate, lang),
      person: vars.person ?? "",
      reason: resolve(vars.reason, lang) ?? "",
      link,
    };
    const subject = fill(tpl.subject, values);
    // The template's own markup counts; a name or title filled into it stays text, so "[x](https://…)" in it is no link.
    const body = fill(tpl.body, { ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeEmailMarkup(v)])), link });
    await queueEmail(
      db,
      tenantId,
      {
        to: u.email,
        kind,
        subject,
        text: stripEmailMarkup(body),
        html: renderEmailHtml(body, { brand: tenant.branding.primary, footer: tenant.name, buttonLabel: emailButtonLabel(kind, lang), markup: true, lang }),
        lang,
      },
      { defer: opts.defer },
    );
    if (inApp) {
      let due: string | null = null;
      if (vars.dueDate && !inApp.body) {
        if (!dueText.has(lang)) {
          const tc = createTranslator({ ...(await messagesFor(lang)), namespace: "common.time" });
          dueText.set(lang, tc("due", { date: values.dueDate }));
        }
        due = dueText.get(lang) ?? null;
      }
      await db.insert(t.notifications).values({
        tenantId,
        userId: u.id,
        kind,
        title: inApp.title ? (resolve(inApp.title, lang) ?? "") : fill(fallback.subject, values),
        body: inApp.body ? (resolve(inApp.body, lang) ?? null) : due,
        href: inApp.href ?? vars.link ?? null,
      });
    }
  }
  return users.length;
}
