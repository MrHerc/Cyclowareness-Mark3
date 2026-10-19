import { describe, expect, it } from "vitest";
import { notificationsSchema } from "@/server/schemas/notifications";

const base = { firstReminderDays: 3, urgentReminderHours: 24, overdueNotice: true, managerAlerts: true, failedSimulations: 2, overdueDays: 7 };

describe("notificationsSchema", () => {
  it("accepts a tenant without any template (seeded state)", () => {
    expect(notificationsSchema.safeParse({ ...base, templates: {} }).success).toBe(true);
    expect(notificationsSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a single kind in a single language", () => {
    const r = notificationsSchema.safeParse({ ...base, templates: { assignment: { az: { subject: "Yeni təlim", body: "Salam {{name}}" } } } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.templates?.assignment?.az?.subject).toBe("Yeni təlim");
  });

  it("rejects an unknown kind, an unknown language and an over-long subject", () => {
    expect(notificationsSchema.safeParse({ ...base, templates: { newsletter: { en: { subject: "x", body: "y" } } } }).success).toBe(false);
    expect(notificationsSchema.safeParse({ ...base, templates: { assignment: { de: { subject: "x", body: "y" } } } }).success).toBe(false);
    expect(notificationsSchema.safeParse({ ...base, templates: { assignment: { en: { subject: "x".repeat(201), body: "y" } } } }).success).toBe(false);
  });
});
