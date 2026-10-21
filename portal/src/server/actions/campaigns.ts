"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { isUuid } from "../../lib/ids";
import { audit } from "../services/audit";
import { launchCampaign, recordSubmit, type LaunchBlock } from "../services/campaigns";
import { TEMPLATE_BY_KEY } from "../../lib/campaigns/templates";

const draftSchema = z.object({
  /** Set when editing a campaign that is still a draft or scheduled. */
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  templateKey: z.string().refine((k) => TEMPLATE_BY_KEY.has(k)),
  audience: z.enum(["all", "department"]),
  departmentId: z.string().uuid().nullable(),
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
});

export async function saveCampaignAction(input: z.infer<typeof draftSchema>): Promise<{ ok: boolean; id?: string; reason?: "past_date" }> {
  const v = await actionViewer("campaigns.write");
  const p = draftSchema.safeParse(input);
  if (!p.success) return { ok: false };
  if (p.data.audience === "department") {
    if (!p.data.departmentId) return { ok: false };
    const [d] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, p.data.departmentId), eq(t.departments.tenantId, v.tenant.id)));
    if (!d) return { ok: false };
  }
  const tpl = TEMPLATE_BY_KEY.get(p.data.templateKey)!;
  if ((tpl.channel === "sms" || tpl.channel === "voice") && !v.tenant.features.has("sms_voice")) return { ok: false };
  const scheduledAt = p.data.scheduledAt ? new Date(p.data.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) return { ok: false, reason: "past_date" };
  if (p.data.id) {
    const [c] = await db().select({ id: t.campaigns.id, status: t.campaigns.status }).from(t.campaigns).where(and(eq(t.campaigns.id, p.data.id), eq(t.campaigns.tenantId, v.tenant.id)));
    if (!c || (c.status !== "draft" && c.status !== "scheduled")) return { ok: false };
    await db()
      .update(t.campaigns)
      .set({
        name: p.data.name,
        channel: tpl.channel,
        templateKey: tpl.key,
        audience: p.data.audience,
        departmentId: p.data.audience === "department" ? p.data.departmentId : null,
        status: scheduledAt ? "scheduled" : "draft",
        scheduledAt,
      })
      .where(eq(t.campaigns.id, c.id));
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "campaign.changed", targetType: "campaign", targetId: c.id, meta: { name: p.data.name, template: tpl.key } });
    refresh();
    return { ok: true, id: c.id };
  }
  const [row] = await db()
    .insert(t.campaigns)
    .values({
      tenantId: v.tenant.id,
      name: p.data.name,
      channel: tpl.channel,
      templateKey: tpl.key,
      audience: p.data.audience,
      departmentId: p.data.audience === "department" ? p.data.departmentId : null,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
      createdBy: v.user.id,
    })
    .returning({ id: t.campaigns.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "campaign.created", targetType: "campaign", targetId: row.id, meta: { name: p.data.name, template: tpl.key } });
  return { ok: true, id: row.id };
}

export async function launchCampaignAction(id: string): Promise<{ ok: boolean; count?: number; reason?: LaunchBlock }> {
  const v = await actionViewer("campaigns.write");
  if (!isUuid(id)) return { ok: false };
  const [c] = await db().select().from(t.campaigns).where(and(eq(t.campaigns.id, id), eq(t.campaigns.tenantId, v.tenant.id)));
  if (!c) return { ok: false };
  const res = await launchCampaign(db(), c.id, v.user.id);
  refresh();
  return res.ok ? { ok: true, count: res.count } : { ok: false, reason: res.reason };
}

export async function setCampaignStatusAction(id: string, status: "cancelled" | "completed"): Promise<{ ok: boolean }> {
  const v = await actionViewer("campaigns.write");
  // Only these two end states can be set by hand; anything else would let a running campaign be relaunched.
  if (!isUuid(id) || (status !== "cancelled" && status !== "completed")) return { ok: false };
  const [c] = await db().select().from(t.campaigns).where(and(eq(t.campaigns.id, id), eq(t.campaigns.tenantId, v.tenant.id)));
  if (!c || c.status === "completed" || c.status === "cancelled") return { ok: false };
  await db()
    .update(t.campaigns)
    .set({ status, ...(status === "completed" ? { completedAt: new Date() } : {}) })
    .where(eq(t.campaigns.id, c.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: status === "cancelled" ? "campaign.cancelled" : "campaign.changed", targetType: "campaign", targetId: c.id, meta: { status } });
  refresh();
  return { ok: true };
}

/** Fake sign-in on the simulation page: only the fact is recorded, never what was typed. */
export async function simulationSubmitAction(token: string): Promise<void> {
  if (!/^[a-z2-7]{10,40}$/.test(token)) return;
  await recordSubmit(db(), token);
}
