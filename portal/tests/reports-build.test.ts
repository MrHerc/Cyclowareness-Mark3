import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, assignEveryone, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (o: { locale: string; namespace: string }) => createTranslator({ ...(await messagesFor(o.locale)), namespace: o.namespace as never }),
}));

const { buildReport, parseReportFilters, scopedPeople } = await import("../src/server/reports/build");

beforeAll(ready, DB_SETUP_TIMEOUT);

const as = (tenantId: string, user: { id: string; role: t.Role; departmentId?: string | null }) => ({ user: { departmentId: null, ...user }, tenant: { id: tenantId } }) as unknown as Viewer;

describe("parseReportFilters", () => {
  it("applies valid days and a department id", () => {
    expect(parseReportFilters({ from: "2026-10-01", to: "2026-10-31", d: "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60" })).toEqual({
      filters: { from: "2026-10-01", to: "2026-10-31", departmentId: "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60" },
      rejected: false,
    });
    expect(parseReportFilters({})).toEqual({ filters: { from: undefined, to: undefined, departmentId: undefined }, rejected: false });
  });

  it("rejects days that do not exist, a reversed range and a malformed department", () => {
    expect(parseReportFilters({ from: "2026-02-31" }).rejected).toBe(true);
    expect(parseReportFilters({ from: "2026-10-31", to: "2026-10-01" })).toMatchObject({ filters: { from: undefined, to: undefined }, rejected: true });
    expect(parseReportFilters({ d: "finance" })).toMatchObject({ filters: { departmentId: undefined }, rejected: true });
  });
});

async function org() {
  const tenant = await addTenant(db);
  const finance = await addDepartment(db, tenant.id, "Finance");
  const payroll = await addDepartment(db, tenant.id, "Payroll", finance.id);
  const it_ = await addDepartment(db, tenant.id, "IT");
  const head = await addUser(db, tenant.id, { name: "Hana Head", role: "department_head", departmentId: finance.id });
  await db.update(t.departments).set({ headUserId: head.id }).where(eq(t.departments.id, finance.id));
  const anna = await addUser(db, tenant.id, { name: "Anna", departmentId: finance.id, riskScore: 20, xp: 300 });
  const bob = await addUser(db, tenant.id, { name: "Bob", departmentId: payroll.id, riskScore: 70 });
  const carl = await addUser(db, tenant.id, { name: "Carl", departmentId: it_.id, riskScore: 40 });
  const nobody = await addUser(db, tenant.id, { name: "Dora", riskScore: 10 });
  await addUser(db, tenant.id, { name: "Operator", role: "super_admin" });
  await addUser(db, tenant.id, { name: "Gone", status: "deleted" });
  const admin = await addUser(db, tenant.id, { name: "Zed Admin", role: "tenant_admin", departmentId: it_.id, riskScore: 30 });
  return { tenant, finance, payroll, it_, head, anna, bob, carl, nobody, admin };
}

describe("scopedPeople", () => {
  it("covers the whole organisation for administrators, without the operator or deleted people, by name", async () => {
    const o = await org();
    const { users } = await scopedPeople(as(o.tenant.id, o.admin), {});
    expect(users.map((u) => u.name)).toEqual(["Anna", "Bob", "Carl", "Dora", "Hana Head", "Zed Admin"]);
  });

  it("narrows to a department with its sub-departments, and a department head to their own", async () => {
    const o = await org();
    expect((await scopedPeople(as(o.tenant.id, o.admin), { departmentId: o.finance.id })).users.map((u) => u.name)).toEqual(["Anna", "Bob", "Hana Head"]);
    const head = as(o.tenant.id, o.head);
    expect((await scopedPeople(head, {})).users.map((u) => u.name)).toEqual(["Anna", "Bob", "Hana Head"]);
    expect((await scopedPeople(head, { departmentId: o.payroll.id })).users.map((u) => u.name)).toEqual(["Bob"]);
  });

  it("never widens to the organisation for a department outside the scope or one that no longer exists", async () => {
    const o = await org();
    expect((await scopedPeople(as(o.tenant.id, o.head), { departmentId: o.it_.id })).users).toEqual([]);
    expect((await scopedPeople(as(o.tenant.id, o.admin), { departmentId: "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60" })).users).toEqual([]);
  });
});

describe("buildReport", () => {
  it("lists people with translated roles, statuses and their level", async () => {
    const o = await org();
    const r = await buildReport(as(o.tenant.id, o.admin), "people", {}, "en");
    expect(r.title).toBe("People");
    expect(r.headers).toEqual(["Person", "Email", "Department", "Job title", "Role", "Status", "Risk score", "XP", "Level", "Last active", "Joined"]);
    expect(r.rows[0].slice(0, 9)).toEqual(["Anna", o.anna.email, "Finance", null, "Learner", "Active", 20, 300, 3]);
    const ru = await buildReport(as(o.tenant.id, o.admin), "people", {}, "ru");
    expect(ru.headers[0]).not.toBe("Person");
  });

  it("gives each assignment its status, and leaves out completions outside the period", async () => {
    const o = await org();
    const mod = await addModule(db, { title: { en: "Passwords" } });
    await assignEveryone(db, o.tenant.id, mod.id, { dueKind: "fixed", dueDate: "2026-01-01" });
    const later = await addModule(db, { title: { en: "Later" } });
    await assignEveryone(db, o.tenant.id, later.id, { dueKind: "fixed", dueDate: "2099-01-01" });
    await db.insert(t.moduleProgress).values([
      { userId: o.anna.id, moduleId: mod.id, status: "completed", percent: 100, completedAt: new Date("2026-03-10T08:00:00Z") },
      { userId: o.bob.id, moduleId: later.id, status: "awaiting_attestation", percent: 100 },
      { userId: o.carl.id, moduleId: later.id, status: "in_progress", percent: 50 },
    ]);
    const r = await buildReport(as(o.tenant.id, o.admin), "completion", {}, "en");
    const status = (name: string, module: string) => r.rows.find((x) => x[0] === name && x[3] === module)?.[5];
    expect(status("Anna", "Passwords")).toBe("Completed");
    expect(status("Bob", "Passwords")).toBe("Overdue");
    expect(status("Bob", "Later")).toBe("Awaiting confirmation");
    expect(status("Carl", "Later")).toBe("In progress");
    expect(status("Dora", "Later")).toBe("Not started");
    expect(r.rows.find((x) => x[0] === "Anna" && x[3] === "Passwords")?.[4]).toBe("2026-01-01");
    const april = await buildReport(as(o.tenant.id, o.admin), "completion", { from: "2026-04-01" }, "en");
    expect(april.rows.some((x) => x[0] === "Anna" && x[3] === "Passwords")).toBe(false);
    expect(april.rows.some((x) => x[0] === "Bob" && x[3] === "Passwords")).toBe(true);
  });

  it("adds one average row per department to the risk report", async () => {
    const o = await org();
    await db.insert(t.behaviorRisks).values([
      { tenantId: o.tenant.id, userId: o.bob.id, kind: "phishing_click", severity: "high", title: "x" },
      { tenantId: o.tenant.id, userId: o.bob.id, kind: "policy", severity: "low", title: "y" },
      { tenantId: o.tenant.id, userId: o.bob.id, kind: "policy", severity: "low", title: "z", status: "closed" },
    ]);
    const r = await buildReport(as(o.tenant.id, o.admin), "risk", { departmentId: o.finance.id }, "en");
    expect(r.rows).toEqual([
      ["Anna", o.anna.email, "Finance", 20, "Low risk", 0],
      ["Bob", o.bob.email, "Payroll", 70, "High risk", 2],
      ["Hana Head", o.head.email, "Finance", 50, "Medium risk", 0],
      ["Department average: Finance", "", "Finance", 35, "", ""],
      ["Department average: Payroll", "", "Payroll", 70, "", ""],
    ]);
  });

  it("measures module completion among the people it is assigned to", async () => {
    const o = await org();
    const mod = await addModule(db, { title: { en: "Phishing" } });
    // Assigned to Anna and Bob only; Carl and Dora took it on their own.
    await db.insert(t.assignments).values([
      { tenantId: o.tenant.id, moduleId: mod.id, scope: "user", userId: o.anna.id },
      { tenantId: o.tenant.id, moduleId: mod.id, scope: "user", userId: o.bob.id },
    ]);
    const done = (userId: string) => ({ userId, moduleId: mod.id, status: "completed" as const, percent: 100, completedAt: new Date() });
    await db.insert(t.moduleProgress).values([done(o.anna.id), done(o.carl.id), done(o.nobody.id)]);
    await db.insert(t.feedback).values([
      { tenantId: o.tenant.id, moduleId: mod.id, rating: 4, topic: "module" },
      { tenantId: o.tenant.id, moduleId: mod.id, rating: 5, topic: "module" },
    ]);
    await db.insert(t.answers).values([
      { tenantId: o.tenant.id, userId: o.anna.id, lessonId: mod.lessons[0].id, sceneId: "q", correct: true, firstTry: true },
      { tenantId: o.tenant.id, userId: o.anna.id, lessonId: mod.lessons[1].id, sceneId: "q", correct: false, firstTry: true },
    ]);
    const r = await buildReport(as(o.tenant.id, o.admin), "modules", {}, "en");
    expect(r.headers).toEqual(["Module", "Category", "Difficulty", "Assigned", "Completed", "Completion %", "First-try score %", "Average rating"]);
    const row = r.rows.find((x) => x[0] === "Phishing")!;
    expect(row.slice(3)).toEqual([2, 3, 50, 50, 4.5]);
  });

  it("lists confirmations with their text and language, then the ones still awaited", async () => {
    const o = await org();
    const mod = await addModule(db, { title: { en: "Policy basics" } });
    await db.insert(t.attestations).values({ tenantId: o.tenant.id, userId: o.anna.id, moduleId: mod.id, text: "Mən təsdiq edirəm.", locale: "az" });
    await db.insert(t.moduleProgress).values({ userId: o.bob.id, moduleId: mod.id, status: "awaiting_attestation", percent: 100 });
    const r = await buildReport(as(o.tenant.id, o.admin), "confirmations", {}, "en");
    expect(r.rows.map((x) => [x[0], x[3], x[4], x[6], x[7]])).toEqual([
      ["Anna", "Policy basics", "Completed", "Azərbaycanca", "Mən təsdiq edirəm."],
      ["Bob", "Policy basics", "Awaiting confirmation", "", ""],
    ]);
  });

  it("lists simulation results per person, showing QR campaigns as email, within the period", async () => {
    const o = await org();
    const [qr] = await db.insert(t.campaigns).values({ tenantId: o.tenant.id, name: "MFA QR", channel: "qr", templateKey: "mfa-qr", audience: "all", status: "running" }).returning();
    const [sms] = await db.insert(t.campaigns).values({ tenantId: o.tenant.id, name: "Parcel", channel: "sms", templateKey: "parcel-sms", audience: "all", status: "running" }).returning();
    await db.insert(t.campaignRecipients).values([
      { campaignId: qr.id, userId: o.anna.id, token: "qrtoken000000001", sentAt: new Date("2026-10-10T08:00:00Z"), clickedAt: new Date("2026-10-10T09:00:00Z") },
      { campaignId: sms.id, userId: o.bob.id, token: "smstoken00000001", sentAt: new Date("2026-08-10T08:00:00Z") },
    ]);
    const r = await buildReport(as(o.tenant.id, o.admin), "simulations", { from: "2026-10-01" }, "en");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].slice(0, 5)).toEqual(["MFA QR", "Email", expect.any(String), "Anna", "Finance"]);
    expect(r.rows[0][7]).toEqual(new Date("2026-10-10T09:00:00Z"));
  });

  it("summarises threat reports, incidents, sandbox analyses and loops, leaving out reported simulations", async () => {
    const o = await org();
    const tid = o.tenant.id;
    await db.insert(t.threatReports).values([
      { tenantId: tid, number: 100, channel: "email", subject: "Real one", severity: "high", status: "triaged" },
      { tenantId: tid, number: 101, channel: "email", subject: "A simulation", campaignRecipientId: "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60" },
    ]);
    await db.insert(t.incidents).values({ tenantId: tid, number: 20, title: "Invoice fraud", severity: "critical", source: "analyst", iocs: [], mitre: [], targetUserIds: [] });
    await db.insert(t.sandboxAnalyses).values({ tenantId: tid, number: 1, kind: "url", objectName: "https://evil.example", verdict: "malicious", score: 95, findings: [], iocs: [], mitre: [] });
    await db.insert(t.loops).values({ tenantId: tid, title: "Loop", stage: "training", verdict: "malicious", sourceType: "report" });
    const r = await buildReport(as(tid, o.admin), "secops", {}, "en");
    expect(r.rows.map((x) => [x[0], x[1], x[2]])).toEqual([
      ["Threat report", "TR-100", "Real one"],
      ["Incident", "IR-20", "Invoice fraud"],
      ["Sandbox analysis", "SB-1", "https://evil.example"],
      ["Closed loop", expect.any(String), "Loop"],
    ]);
    expect(r.rows[0][3]).toBe("High");
    expect(r.rows[2][3]).toMatch(/\(95\)$/);
  });
});
