import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { can } from "../src/server/auth/permissions";
import { todayIn } from "../src/lib/time";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { isProd: false }, appUrl: () => "https://portal.example" }));
vi.mock("../src/server/sms", () => ({ smsAvailable: () => false, sendSms: vi.fn() }));
const audit = vi.fn();
vi.mock("../src/server/services/audit", () => ({ audit }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

type TestViewer = { user: { id: string; role: t.Role; totpEnabled: boolean }; tenant: { id: string; settings: { timeZone: string } } };
let viewer: TestViewer | null = null;
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer, allowed: (v: TestViewer, p: Parameters<typeof can>[1]) => can(v.user.role, p), twoFactorGap: () => false }));

const { platformMetrics } = await import("../src/server/queries/platform-metrics");
const { GET } = await import("../src/app/api/super/seats/route");

const NOW = new Date("2026-11-06T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
let alpha = "";
let beta = "";
let operator = "";
let admin = "";

beforeAll(async () => {
  await ready();
  const a = await addTenant(db, { slug: "alpha", name: "Alpha", plan: "professional" });
  const b = await addTenant(db, { slug: "beta", name: "Beta", plan: "essentials" });
  [alpha, beta] = [a.id, b.id];
  const recent = await addUser(db, alpha, { lastActiveAt: daysAgo(2) });
  const lastMonth = await addUser(db, alpha, { lastActiveAt: daysAgo(20) });
  await addUser(db, alpha, { status: "invited" });
  await addUser(db, alpha, { status: "suspended", lastActiveAt: daysAgo(1) });
  const op = await addUser(db, alpha, { role: "super_admin", lastActiveAt: daysAgo(40) });
  const ad = await addUser(db, beta, { role: "tenant_admin" });
  [operator, admin] = [op.id, ad.id];

  const mod = await addModule(db, { lessons: 3 });
  const [l1, l2, l3] = mod.lessons;
  await db.insert(t.lessonProgress).values([
    { userId: recent.id, lessonId: l1.id, completedAt: daysAgo(3), lastCompletedAt: daysAgo(3) },
    { userId: recent.id, lessonId: l2.id, startedAt: daysAgo(1) },
    { userId: lastMonth.id, lessonId: l1.id, completedAt: daysAgo(60) },
    { userId: lastMonth.id, lessonId: l3.id, startedAt: daysAgo(45) },
    { userId: ad.id, lessonId: l1.id, completedAt: daysAgo(90), lastCompletedAt: daysAgo(5) },
  ]);
  await db.insert(t.moduleProgress).values([
    { userId: recent.id, moduleId: mod.id, status: "completed", percent: 100 },
    { userId: lastMonth.id, moduleId: mod.id, status: "in_progress", percent: 30 },
  ]);
  await db.insert(t.certificates).values([
    { tenantId: alpha, userId: recent.id, moduleId: mod.id, serial: "S-1", publicToken: "p1", evidence: "server_verified" },
    { tenantId: alpha, userId: lastMonth.id, moduleId: mod.id, serial: "S-2", publicToken: "p2", evidence: "self_reported" },
  ]);
  const [c1] = await db.insert(t.campaigns).values({ tenantId: alpha, name: "Q1", channel: "email", templateKey: "payroll", audience: "all", status: "completed" }).returning();
  const [c2] = await db.insert(t.campaigns).values({ tenantId: alpha, name: "Q2", channel: "email", templateKey: "payroll", audience: "all", status: "running" }).returning();
  await db.insert(t.campaignRecipients).values([
    { campaignId: c1.id, userId: recent.id, token: "tok-aaaaaaaaaaaaaa1", sentAt: NOW, openedAt: NOW, clickedAt: NOW },
    { campaignId: c1.id, userId: lastMonth.id, token: "tok-aaaaaaaaaaaaaa2", sentAt: NOW, reportedAt: NOW },
    { campaignId: c2.id, userId: recent.id, token: "tok-aaaaaaaaaaaaaa3", sentAt: NOW, openedAt: NOW },
  ]);
}, DB_SETUP_TIMEOUT);

describe("platformMetrics", () => {
  it("counts each organisation's usage on its own", async () => {
    const rows = await platformMetrics(NOW);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(alpha)).toMatchObject({
      slug: "alpha",
      plan: "professional",
      // The operator account in Alpha is not a seat.
      active: 2,
      invited: 1,
      weekly: 1,
      monthly: 2,
      lessonsStarted: 2,
      lessonsCompleted: 1,
      modulesCompleted: 1,
      sent: 3,
      opened: 2,
      clicked: 1,
      reported: 1,
      certificates: 1,
    });
    // A replay in the window counts by last_completed_at; nothing from Alpha leaks into Beta.
    expect(byId.get(beta)).toMatchObject({ active: 1, invited: 0, weekly: 0, monthly: 0, lessonsStarted: 1, lessonsCompleted: 1, modulesCompleted: 0, sent: 0, reported: 0, certificates: 0 });
  });
});

describe("GET /api/super/seats", () => {
  it("refuses anyone but a platform operator", async () => {
    viewer = null;
    expect((await GET(new Request("http://localhost/api/super/seats"))).status).toBe(401);
    viewer = { user: { id: admin, role: "tenant_admin", totpEnabled: true }, tenant: { id: beta, settings: { timeZone: "Asia/Baku" } } };
    expect((await GET(new Request("http://localhost/api/super/seats"))).status).toBe(403);
    expect(audit).not.toHaveBeenCalled();
  });

  it("gives the operator one seat row per organisation and records the export", async () => {
    viewer = { user: { id: operator, role: "super_admin", totpEnabled: true }, tenant: { id: alpha, settings: { timeZone: "Asia/Baku" } } };
    const res = await GET(new Request("http://localhost/api/super/seats"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const month = todayIn("Asia/Baku").slice(0, 7);
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toEqual(["organisation,plan,active_people,invited_people,month", `alpha,professional,2,1,${month}`, `beta,essentials,1,0,${month}`]);
    expect(audit).toHaveBeenCalledWith(db, expect.objectContaining({ action: "seats.exported", actorId: operator }));
  });
});
