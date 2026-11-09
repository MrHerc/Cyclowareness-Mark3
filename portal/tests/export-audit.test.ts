import { createFormatter, createTranslator } from "next-intl";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { can, type Permission } from "../src/server/auth/permissions";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

/** Exports of personal or live data leave an audit entry: the USB drop kit (one live tracking token per employee) and a signed-in certificate view. */
const { db, ready } = testDb();
let viewer: Viewer | null = null;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { isProd: false, TRUST_PROXY: 0 }, appUrl: () => "http://localhost:3000" }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "Asia/Baku" }),
  getTranslations: async (namespace: string) => createTranslator({ ...(await messagesFor("en")), namespace: namespace as never }),
}));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer, allowed: (v: Viewer, p: Permission) => can(v.user.role, p), twoFactorGap: () => false }));

const usbKit = await import("../src/app/api/admin/campaigns/[id]/usb-kit/route");
const { default: CertificatePage } = await import("../src/app/(public)/c/[token]/page");

let tenant: typeof t.tenants.$inferSelect;
const viewerFor = (user: typeof t.users.$inferSelect): Viewer => ({ sessionId: "s", twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } });
const audited = (action: string) => db.select().from(t.auditLog).where(eq(t.auditLog.action, action));

beforeAll(async () => {
  await ready();
  tenant = await addTenant(db, { plan: "professional" });
}, DB_SETUP_TIMEOUT);

describe("GET /api/admin/campaigns/[id]/usb-kit", () => {
  it("records who exported the drop kit and how many drives it holds", async () => {
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    const employee = await addUser(db, tenant.id);
    const [campaign] = await db.insert(t.campaigns).values({ tenantId: tenant.id, name: "Car park drop", channel: "usb", templateKey: "usb-salary", audience: "all" }).returning();
    await db.insert(t.campaignRecipients).values({ campaignId: campaign.id, userId: employee.id, token: "usbtoken0001" });
    viewer = viewerFor(admin);
    const res = await usbKit.GET(new Request(`http://localhost:3000/api/admin/campaigns/${campaign.id}/usb-kit`), { params: Promise.resolve({ id: campaign.id }) });
    expect(res.status).toBe(200);
    expect(await audited("campaign.usb_kit_downloaded")).toMatchObject([{ tenantId: tenant.id, actorId: admin.id, targetType: "campaign", targetId: campaign.id, meta: { drives: 1 } }]);
  });
});

describe("/c/[token]", () => {
  it("records a signed-in view of a certificate, and not an anonymous verification", async () => {
    const owner = await addUser(db, tenant.id);
    const mod = await addModule(db, { lessons: 1 });
    const token = "abcdefghij234567";
    const [cert] = await db.insert(t.certificates).values({ tenantId: tenant.id, userId: owner.id, moduleId: mod.id, serial: "CY-TEST-0001", publicToken: token }).returning();
    viewer = null;
    await CertificatePage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({}) });
    expect(await audited("certificate.downloaded")).toEqual([]);
    viewer = viewerFor(owner);
    await CertificatePage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({}) });
    expect(await audited("certificate.downloaded")).toMatchObject([{ tenantId: tenant.id, actorId: owner.id, targetType: "certificate", targetId: cert.id }]);
  });
});
