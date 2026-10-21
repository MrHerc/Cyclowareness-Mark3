import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { TemplateKind } from "../db/schema";
import { queueEmail, renderEmailHtml } from "../mail";
import { appUrl } from "../env";
import { DEFAULT_TEMPLATES, EMAIL_BUTTON_LABEL, FIXED_MESSAGES, withDefaults } from "../../lib/tenant-defaults";
import { stripEmailMarkup } from "../../lib/email-markup";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
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

/**
 * Sends a templated message (in-app notification + email in each person's language).
 * Email uses the tenant's template for that language, falling back to the defaults (also when a
 * stored template is blank); the fixed kinds (policy signature, confirmation nudge) have no
 * editable template. Only active people are written to by default; `statuses` widens this
 * (welcome mail to the invited).
 */
export async function notifyUsers(
  db: DB,
  tenantId: string,
  userIds: string[],
  kind: NotifyKind,
  vars: { module?: Localized; dueDate?: string; person?: string; reason?: Localized; link?: string },
  inApp?: { title: Localized; body?: Localized; href?: string },
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
  const messages = isTemplateKind(kind) ? DEFAULT_TEMPLATES[kind] : FIXED_MESSAGES[kind];
  const base = appUrl();
  for (const u of users) {
    const lang = u.locale in messages ? u.locale : "en";
    const stored = isTemplateKind(kind) ? settings.notifications.templates?.[kind]?.[lang] : undefined;
    const fallback = messages[lang];
    const tpl = { subject: stored?.subject?.trim() ? stored.subject : fallback.subject, body: stored?.body?.trim() ? stored.body : fallback.body };
    const link = vars.link ? `${base}${vars.link}` : base;
    const values = {
      name: u.name.split(" ")[0],
      organisation: tenant.name,
      module: resolve(vars.module, lang) ?? "",
      dueDate: vars.dueDate ?? "—",
      person: vars.person ?? "",
      reason: resolve(vars.reason, lang) ?? "",
      link,
    };
    const subject = fill(tpl.subject, values);
    const body = fill(tpl.body, values);
    await queueEmail(
      db,
      tenantId,
      {
        to: u.email,
        kind,
        subject,
        text: stripEmailMarkup(body),
        html: renderEmailHtml(body, { brand: tenant.branding.primary, footer: tenant.name, buttonLabel: EMAIL_BUTTON_LABEL[lang] ?? EMAIL_BUTTON_LABEL.en, markup: true }),
      },
      { defer: opts.defer },
    );
    if (inApp) {
      await db.insert(t.notifications).values({ tenantId, userId: u.id, kind, title: resolve(inApp.title, lang) ?? "", body: resolve(inApp.body, lang) ?? null, href: inApp.href ?? vars.link ?? null });
    }
  }
  return users.length;
}
