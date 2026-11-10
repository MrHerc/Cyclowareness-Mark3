import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, createFormatter, createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

/** /admin/campaigns: the one-person re-simulations stay out of the list, not out of the organisation's funnel. */
const { db, ready } = testDb();
let viewer: Viewer;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "Asia/Baku" }),
  getTranslations: async (namespace: string) => createTranslator({ ...(await messagesFor("en")), namespace: namespace as never }),
}));
vi.mock("../src/server/auth/viewer", () => ({ requirePermission: async () => viewer, allowed: () => true }));

const { default: CampaignsPage } = await import("../src/app/(admin)/admin/campaigns/(index)/page");

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("/admin/campaigns", () => {
  it("lists no one-person re-simulation, and still counts its result in the organisation's funnel", async () => {
    const tenant = await addTenant(db, { plan: "enterprise_hrm" });
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    const [a, b] = [await addUser(db, tenant.id), await addUser(db, tenant.id)];
    viewer = { sessionId: "s", twoFactorVerified: true, user: admin, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } } as unknown as Viewer;
    const [plain, resim] = await db
      .insert(t.campaigns)
      .values([
        { tenantId: tenant.id, name: "Quarterly payslip", channel: "email", templateKey: "payslip", audience: "all", status: "completed", launchedAt: new Date() },
        { tenantId: tenant.id, name: "Overdue invoice: re-simulation", channel: "email", templateKey: "invoice", audience: "person", userId: a.id, status: "completed", launchedAt: new Date() },
      ])
      .returning();
    const now = new Date();
    await db.insert(t.campaignRecipients).values([
      { campaignId: plain.id, userId: a.id, token: `p1${plain.id}`, sentAt: now, clickedAt: now },
      { campaignId: plain.id, userId: b.id, token: `p2${plain.id}`, sentAt: now, reportedAt: now },
      { campaignId: resim.id, userId: a.id, token: `r1${resim.id}`, sentAt: now, reportedAt: now },
    ]);
    const page = (await CampaignsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as never)) as ReactNode;
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, (await messagesFor("en")) as ComponentProps<typeof NextIntlClientProvider>, page));
    expect(html).toContain("Quarterly payslip");
    expect(html).not.toContain("re-simulation");
    expect(html).toContain("1 campaign");
    expect(html).toContain("2 of 3 recipients reported the simulation");
    expect(html).toContain("Across 2 campaigns with results");
  }, 60_000);
});
