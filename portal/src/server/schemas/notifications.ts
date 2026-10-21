import { z } from "zod";
import { TEMPLATE_KINDS } from "../db/schema";
import { LOCALES } from "../../i18n/config";

/** A saved template must keep the training (or invitation) link; without it the email is a dead end. */
const LINK_TOKEN = /\{\{\s*link\s*\}\}/;

const templateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((body) => LINK_TOKEN.test(body), { message: "missing {{link}}" }),
});

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
  templates: z.partialRecord(z.enum(TEMPLATE_KINDS), z.partialRecord(z.enum(LOCALES), templateSchema)).optional(),
});

export type NotificationsInput = z.infer<typeof notificationsSchema>;
