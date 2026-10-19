import { z } from "zod";
import { TEMPLATE_KINDS } from "../db/schema";
import { LOCALES } from "../../i18n/config";

/**
 * Settings → Notifications. Templates are partial on purpose: the tab sends only the kinds and
 * languages that exist, and a seeded tenant has none at all (zod 4's enum-keyed record would
 * require every key).
 */
export const notificationsSchema = z.object({
  firstReminderDays: z.number().int().min(1).max(60),
  urgentReminderHours: z.number().int().min(1).max(240),
  overdueNotice: z.boolean(),
  managerAlerts: z.boolean(),
  failedSimulations: z.number().int().min(1).max(20),
  overdueDays: z.number().int().min(1).max(90),
  templates: z.partialRecord(z.enum(TEMPLATE_KINDS), z.partialRecord(z.enum(LOCALES), z.object({ subject: z.string().max(200), body: z.string().max(5000) }))).optional(),
});

export type NotificationsInput = z.infer<typeof notificationsSchema>;
