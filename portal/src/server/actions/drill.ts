"use server";

import { and, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { isUuid } from "../../lib/ids";
import { rateLimit } from "../rate-limit";
import { skipDrill, startDrill } from "../services/drill";
import { TEMPLATE_BY_KEY, templateText } from "../../lib/campaigns/templates";

const startSchema = z.object({
  templateKey: z.string().max(40),
  audience: z.enum(["all", "department"]),
  departmentId: z.string().uuid().nullable(),
  speed: z.enum(["quick", "standard"]),
});

export type StartDrillState = { ok: true; id: string } | { ok: false; reason: "invalid" | "template" | "empty" | "feature" | "rateLimited" };

/** Starts a live drill (campaign managers and administrators of an organisation with the live_drill feature). */
export async function startDrillAction(input: z.infer<typeof startSchema>): Promise<StartDrillState> {
  const v = await actionViewer("campaigns.write");
  if (!v.tenant.features.has("live_drill")) return { ok: false, reason: "feature" };
  const p = startSchema.safeParse(input);
  if (!p.success || (p.data.audience === "department" && !p.data.departmentId)) return { ok: false, reason: "invalid" };
  if (p.data.audience === "department") {
    const [d] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, p.data.departmentId!), eq(t.departments.tenantId, v.tenant.id)));
    if (!d) return { ok: false, reason: "invalid" };
  }
  if (!(await rateLimit(`drill:${v.tenant.id}`, 20, 60 * 60_000)).ok) return { ok: false, reason: "rateLimited" };
  const locale = await getLocale();
  const tpl = TEMPLATE_BY_KEY.get(p.data.templateKey);
  const tr = await getTranslations("admin.drill");
  const res = await startDrill(db(), {
    tenantId: v.tenant.id,
    actorId: v.user.id,
    templateKey: p.data.templateKey,
    audience: p.data.audience,
    departmentId: p.data.departmentId,
    speed: p.data.speed,
    campaignName: tr("campaignName", { name: tpl ? templateText(tpl.name, locale) : p.data.templateKey }),
  });
  return res.ok ? { ok: true, id: res.id } : { ok: false, reason: res.reason };
}

/** Plays the rest of a running drill at once. */
export async function skipDrillAction(id: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("campaigns.write");
  if (!v.tenant.features.has("live_drill") || !isUuid(id)) return { ok: false };
  const run = await skipDrill(db(), v.tenant.id, id);
  return { ok: !!run };
}
