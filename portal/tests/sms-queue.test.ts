import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import type { SmsResult } from "../src/server/sms";

const sendSms = vi.fn(async (to: string, text: string): Promise<SmsResult> => (void [to, text], { ok: true, simulated: false }));
vi.mock("../src/server/sms", () => ({ sendSms: (to: string, text: string) => sendSms(to, text), smsAvailable: () => true }));
vi.mock("../src/server/services/events", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/mail", () => ({ queueEmail: vi.fn() }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "http://localhost:3000" }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;

const { launchCampaign, sendQueuedSms } = await import("../src/server/services/campaigns");

let tenantId = "";
let seq = 0;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  await db.insert(t.users).values([
    ...[1, 2, 3].map((n) => ({ tenantId, email: `p${n}@acme.test`, name: `Person ${n}`, locale: "en", status: "active" as const, phone: `+99450000000${n}` })),
    // No phone: nothing to send, and not counted as reached.
    { tenantId, email: "nophone@acme.test", name: "No Phone", locale: "en", status: "active" as const },
  ]);
}, 180_000);

async function launchSms() {
  const [c] = await db.insert(t.campaigns).values({ tenantId, name: `Parcel ${++seq}`, channel: "sms", templateKey: "parcel-sms", audience: "all", status: "draft" }).returning();
  const res = await launchCampaign(db, c.id, null);
  return { campaign: c, res };
}
const recipients = (campaignId: string) => db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, campaignId));

describe("SMS simulations", () => {
  beforeEach(async () => {
    await db.delete(t.campaigns);
    sendSms.mockReset().mockResolvedValue({ ok: true, simulated: false });
  });

  it("are queued by the launch, not sent inside it", async () => {
    const { campaign, res } = await launchSms();
    expect(res).toEqual({ ok: true, count: 3 });
    expect(sendSms).not.toHaveBeenCalled();
    expect((await recipients(campaign.id)).every((r) => r.sentAt === null)).toBe(true);
  });

  it("are sent by the job step, each once, with the tracking link", async () => {
    const { campaign } = await launchSms();
    expect(await sendQueuedSms(db)).toBe(3);
    expect(sendSms).toHaveBeenCalledTimes(3);
    expect(sendSms.mock.calls[0][1]).toMatch(/http:\/\/localhost:3000\/t\/[a-z0-9]{16,}/);
    const rows = await recipients(campaign.id);
    expect(rows.filter((r) => r.sentAt).length).toBe(3);
    expect(await sendQueuedSms(db)).toBe(0);
    expect(sendSms).toHaveBeenCalledTimes(3);
  });

  it("stop at the first failure when the gateway is down, and the rest wait for the next tick", async () => {
    await launchSms();
    sendSms.mockResolvedValue({ ok: false, error: "down" });
    expect(await sendQueuedSms(db)).toBe(0);
    expect(sendSms).toHaveBeenCalledTimes(1);
    sendSms.mockResolvedValue({ ok: true, simulated: false });
    expect(await sendQueuedSms(db)).toBe(3);
  });

  it("record a message the gateway refused as attempted, and go on with the others", async () => {
    const { campaign } = await launchSms();
    sendSms.mockResolvedValueOnce({ ok: false, error: "failed" });
    expect(await sendQueuedSms(db)).toBe(3);
    expect((await recipients(campaign.id)).filter((r) => r.sentAt).length).toBe(3);
  });

  it("leave cancelled campaigns and launches older than a day alone", async () => {
    const { campaign } = await launchSms();
    await db.update(t.campaigns).set({ status: "cancelled" }).where(eq(t.campaigns.id, campaign.id));
    const { campaign: old } = await launchSms();
    await db.update(t.campaigns).set({ launchedAt: new Date(Date.now() - 2 * 86_400_000) }).where(eq(t.campaigns.id, old.id));
    expect(await sendQueuedSms(db)).toBe(0);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("respect the per-tick limit", async () => {
    await launchSms();
    expect(await sendQueuedSms(db, { limit: 2 })).toBe(2);
    expect(await sendQueuedSms(db)).toBe(1);
  });
});

describe("launch on the organisation's plan", () => {
  it("refuses a channel or template the plan no longer includes, scheduled launches too", async () => {
    await db.update(t.tenants).set({ plan: "essentials" }).where(eq(t.tenants.id, tenantId));
    const { campaign, res } = await launchSms();
    expect(res).toEqual({ ok: false, reason: "plan" });
    expect(await recipients(campaign.id)).toEqual([]);
    await db.update(t.tenants).set({ plan: "professional", features: { qr_trap: false } }).where(eq(t.tenants.id, tenantId));
    const [qr] = await db.insert(t.campaigns).values({ tenantId, name: "QR", channel: "email", templateKey: "mfa-qr", audience: "all", status: "scheduled", scheduledAt: new Date() }).returning();
    expect(await launchCampaign(db, qr.id, null)).toEqual({ ok: false, reason: "plan" });
    await db.update(t.tenants).set({ plan: "enterprise_hrm", features: {} }).where(eq(t.tenants.id, tenantId));
    expect((await launchSms()).res).toEqual({ ok: true, count: 3 });
  });
});
