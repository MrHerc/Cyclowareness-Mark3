"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { audit } from "../services/audit";
import { notifyUsers } from "../services/notify";
import { scopeDepartmentIds } from "../queries/admin";
import { pick } from "../../i18n/config";

export async function hideSetupAction(hidden: boolean): Promise<void> {
  const v = await actionViewer("settings.write");
  await db().update(t.tenants).set({ settings: { ...v.tenant.settings, setupHidden: hidden } }).where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.setup_guide", meta: { hidden } });
  refresh();
}

export async function skipSetupStepAction(step: string): Promise<void> {
  const v = await actionViewer("settings.write");
  if (!["twofa", "directory"].includes(step)) return;
  const skipped = new Set(v.tenant.settings.setupSkipped ?? []);
  skipped.add(step);
  await db().update(t.tenants).set({ settings: { ...v.tenant.settings, setupSkipped: [...skipped] } }).where(eq(t.tenants.id, v.tenant.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "settings.setup_guide", meta: { skipped: step } });
  refresh();
}

/** Reminds everyone who finished a module but hasn't confirmed it yet. */
export async function remindAwaitingAction(moduleId: string | null): Promise<{ count: number }> {
  const v = await actionViewer("assignments.read");
  const scope = await scopeDepartmentIds(v);
  const rows = await db()
    .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId, departmentId: t.users.departmentId, title: t.modules.title, slug: t.modules.slug, locale: t.users.locale })
    .from(t.moduleProgress)
    .innerJoin(t.users, eq(t.users.id, t.moduleProgress.userId))
    .innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId))
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.moduleProgress.status, "awaiting_attestation"), moduleId ? eq(t.moduleProgress.moduleId, moduleId) : undefined));
  const targets = rows.filter((r) => !scope || (r.departmentId && scope.has(r.departmentId)));
  let sent = 0;
  for (const r of targets) {
    sent += await notifyUsers(db(), v.tenant.id, [r.userId], "confirmation_reminder", { module: pick(r.title, r.locale), link: `/learn/${r.slug}?confirm=1` }, { title: pick(r.title, r.locale), body: "✓", href: `/learn/${r.slug}?confirm=1` });
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "attestation.reminder", meta: { count: sent, moduleId } });
  refresh();
  return { count: sent };
}
