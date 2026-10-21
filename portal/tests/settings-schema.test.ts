import { describe, expect, it } from "vitest";
import { notificationsSchema } from "@/server/schemas/notifications";

const base = { firstReminderDays: 3, urgentReminderHours: 24, overdueNotice: true, managerAlerts: true, failedSimulations: 2, overdueDays: 7 };

describe("notificationsSchema", () => {
  it("accepts a tenant without any template (seeded state)", () => {
    expect(notificationsSchema.safeParse({ ...base, templates: {} }).success).toBe(true);
    expect(notificationsSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a single kind in a single language", () => {
    const r = notificationsSchema.safeParse({ ...base, templates: { assignment: { az: { subject: "Yeni təlim", body: "Salam {{name}}\n\n{{link}}" } } } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.templates?.assignment?.az?.subject).toBe("Yeni təlim");
  });

  it("rejects an unknown kind, an unknown language and an over-long subject", () => {
    expect(notificationsSchema.safeParse({ ...base, templates: { newsletter: { en: { subject: "x", body: "y {{link}}" } } } }).success).toBe(false);
    expect(notificationsSchema.safeParse({ ...base, templates: { assignment: { de: { subject: "x", body: "y {{link}}" } } } }).success).toBe(false);
    expect(notificationsSchema.safeParse({ ...base, templates: { assignment: { en: { subject: "x".repeat(201), body: "y {{link}}" } } } }).success).toBe(false);
  });

  it("rejects a blank subject or message and a message without the {{link}}", () => {
    const tpl = (subject: string, body: string) => ({ ...base, templates: { reminder: { en: { subject, body } } } });
    expect(notificationsSchema.safeParse(tpl("", "Hi {{link}}")).success).toBe(false);
    expect(notificationsSchema.safeParse(tpl("   ", "Hi {{link}}")).success).toBe(false);
    expect(notificationsSchema.safeParse(tpl("Reminder", "")).success).toBe(false);
    expect(notificationsSchema.safeParse(tpl("Reminder", "  \n ")).success).toBe(false);
    const noLink = notificationsSchema.safeParse(tpl("Reminder", "Please finish the module."));
    expect(noLink.success).toBe(false);
    if (!noLink.success) expect(noLink.error.issues[0]?.path.join(".")).toBe("templates.reminder.en.body");
    expect(notificationsSchema.safeParse(tpl("Reminder", "Please finish it.\n\n{{ link }}")).success).toBe(true);
  });
});
