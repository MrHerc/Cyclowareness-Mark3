import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { TemplateKind } from "../db/schema";
import { queueEmail, renderEmailHtml } from "../mail";
import { DEFAULT_TEMPLATES, EMAIL_BUTTON_LABEL, FIXED_MESSAGES } from "../../lib/tenant-defaults";
import { stripEmailMarkup } from "../../lib/email-markup";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

const APP_URL = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type NotifyKind = TemplateKind | keyof typeof FIXED_MESSAGES;

function isTemplateKind(kind: NotifyKind): kind is TemplateKind {
  return kind in DEFAULT_TEMPLATES;
}

/**
 * Sends a templated message (in-app notification + email in each person's language).
 * Email uses the tenant's template for that language, falling back to the defaults; the fixed
 * kinds (policy signature, confirmation nudge) have no editable template.
 * Only active people are written to by default; `statuses` widens this (welcome mail to the invited).
 */
export async function notifyUsers(
  db: DB,
  tenantId: string,
  userIds: string[],
  kind: NotifyKind,
  vars: { module?: string; dueDate?: string; person?: string; reason?: string; link?: string },
  inApp?: { title: string; body?: string; href?: string },
  opts: { statuses?: ("active" | "invited")[]; defer?: boolean } = {},
): Promise<number> {
  if (!userIds.length) return 0;
  const [tenant] = await db.select().from(t.tenants).where(eq(t.tenants.id, tenantId));
  const users = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), inArray(t.users.id, userIds), inArray(t.users.status, opts.statuses ?? ["active"])));
  const messages = isTemplateKind(kind) ? DEFAULT_TEMPLATES[kind] : FIXED_MESSAGES[kind];
  for (const u of users) {
    const lang = u.locale in messages ? u.locale : "en";
    const tpl = (isTemplateKind(kind) ? tenant.settings.notifications.templates?.[kind]?.[lang] : undefined) ?? messages[lang];
    const link = vars.link ? `${APP_URL()}${vars.link}` : APP_URL();
    const values = { name: u.name.split(" ")[0], organisation: tenant.name, module: vars.module ?? "", dueDate: vars.dueDate ?? "—", person: vars.person ?? "", reason: vars.reason ?? "", link };
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
    if (inApp) await db.insert(t.notifications).values({ tenantId, userId: u.id, kind, title: inApp.title, body: inApp.body ?? null, href: inApp.href ?? vars.link ?? null });
  }
  return users.length;
}
