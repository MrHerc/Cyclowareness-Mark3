"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { audit } from "../services/audit";
import { REPORT_KINDS } from "../db/schema";

const scheduleSchema = z
  .object({
    kind: z.enum(REPORT_KINDS),
    format: z.enum(["csv", "xlsx"]),
    frequency: z.enum(["weekly", "monthly"]),
    /** Weekly: weekday 1–7 (Monday first). Monthly: day of the month 1–28. */
    day: z.number().int().min(1).max(28),
    recipients: z.array(z.email().max(254)).min(1).max(20),
    departmentId: z.string().uuid().nullable(),
  })
  .refine((s) => s.frequency === "monthly" || s.day <= 7);

export async function saveScheduleAction(input: { kind: string; format: string; frequency: string; day: number; recipients: string; departmentId: string | null }): Promise<{ ok: boolean }> {
  const v = await actionViewer("reports.read");
  const p = scheduleSchema.safeParse({
    ...input,
    recipients: input.recipients
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  });
  if (!p.success) return { ok: false };
  const [row] = await db().insert(t.reportSchedules).values({ tenantId: v.tenant.id, ...p.data, createdBy: v.user.id }).returning({ id: t.reportSchedules.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.schedule_created", targetType: "report_schedule", targetId: row.id, meta: { kind: p.data.kind, frequency: p.data.frequency, day: p.data.day } });
  refresh();
  return { ok: true };
}

export async function removeScheduleAction(id: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("reports.read");
  await db().delete(t.reportSchedules).where(and(eq(t.reportSchedules.id, id), eq(t.reportSchedules.tenantId, v.tenant.id)));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.schedule_removed", targetType: "report_schedule", targetId: id });
  refresh();
  return { ok: true };
}
