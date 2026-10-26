"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { audit } from "../services/audit";
import { notifyUsers } from "../services/notify";
import { scopeDepartmentIds } from "../queries/admin";
import { LOCALES, isLocale, pick } from "../../i18n/config";
import { isUuid } from "../../lib/ids";

export async function hideSetupAction(hidden: boolean): Promise<void> {
  const v = await actionViewer("settings.write");
  // One key written in place: the rest of the settings may have been saved by someone else since this request began.
  await db()
    .update(t.tenants)
    .set({ settings: sql`jsonb_set(${t.tenants.settings}, '{setupHidden}', ${JSON.stringify(!!hidden)}::jsonb)` })
    .where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.setup_guide", meta: { hidden } });
  refresh();
}

export async function skipSetupStepAction(step: string): Promise<void> {
  const v = await actionViewer("settings.write");
  if (!["twofa", "directory"].includes(step)) return;
  const current = sql`coalesce(${t.tenants.settings} -> 'setupSkipped', '[]'::jsonb)`;
  await db()
    .update(t.tenants)
    .set({ settings: sql`jsonb_set(${t.tenants.settings}, '{setupSkipped}', case when ${current} @> to_jsonb(${step}::text) then ${current} else ${current} || to_jsonb(${step}::text) end)` })
    .where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.setup_guide", meta: { skipped: step } });
  refresh();
}

/** Reminds everyone who finished a module but hasn't confirmed it yet. */
export async function remindAwaitingAction(moduleId: string | null): Promise<{ count: number }> {
  const v = await actionViewer("assignments.read");
  if (moduleId !== null && !isUuid(moduleId)) return { count: 0 };
  const scope = await scopeDepartmentIds(v);
  const rows = await db()
    .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId, departmentId: t.users.departmentId, title: t.modules.title, slug: t.modules.slug, locale: t.users.locale })
    .from(t.moduleProgress)
    .innerJoin(t.users, eq(t.users.id, t.moduleProgress.userId))
    .innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId))
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.moduleProgress.status, "awaiting_attestation"), moduleId ? eq(t.moduleProgress.moduleId, moduleId) : undefined));
  const targets = rows.filter((r) => !scope || (r.departmentId && scope.has(r.departmentId)));
  // The in-app note in each person's language; its title is the email subject ("Confirmation needed: …").
  const bodies = new Map(await Promise.all(LOCALES.map(async (l) => [l, (await getTranslations({ locale: l, namespace: "admin.overview" }))("confirmReminderBody")] as const)));
  const body = (locale: string) => bodies.get(isLocale(locale) ? locale : "en") ?? "";
  let sent = 0;
  // Deferred: the job runner sends the emails, so the request does not wait for the mail server once per person.
  for (const r of targets) {
    sent += await notifyUsers(db(), v.tenant.id, [r.userId], "confirmation_reminder", { module: pick(r.title, r.locale), link: `/learn/${r.slug}?confirm=1` }, { body, href: `/learn/${r.slug}?confirm=1` }, { defer: true });
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "attestation.reminder", meta: { count: sent, moduleId } });
  refresh();
  return { count: sent };
}
