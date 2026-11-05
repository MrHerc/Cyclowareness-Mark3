import path from "node:path";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { LOCALES } from "../src/i18n/config";
import { TEMPLATES } from "../src/lib/campaigns/templates";

const env: { isProd?: boolean } = {};
vi.mock("../src/server/sms", () => ({ sendSms: vi.fn(), smsAvailable: () => true }));
vi.mock("../src/server/services/events", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/mail", () => ({ queueEmail: vi.fn() }));
vi.mock("../src/server/env", () => ({ env, appUrl: () => "http://localhost:3000" }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
const { launchBlocker, launchCampaign } = await import("../src/server/services/campaigns");

let tenantId = "";
const voice = TEMPLATES.find((x) => x.channel === "voice")!;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  await db.insert(t.users).values({ tenantId, email: "p@acme.test", name: "Person", locale: "en", status: "active", phone: "+994500000001" });
}, 180_000);

describe("voice campaigns", () => {
  it.each([false, true])("are refused in every environment (production: %s)", async (prod) => {
    env.isProd = prod;
    expect(await launchBlocker(db, tenantId, "voice", 1)).toBe("voice");
    const [c] = await db.insert(t.campaigns).values({ tenantId, name: `Call ${prod}`, channel: "voice", templateKey: voice.key, audience: "all", status: "draft" }).returning();
    expect(await launchCampaign(db, c.id, null)).toEqual({ ok: false, reason: "voice" });
    expect(await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, c.id))).toEqual([]);
  });

  it("have a translated launch-blocked reason in every language", () => {
    for (const l of LOCALES) {
      const m = JSON.parse(readFileSync(path.join(__dirname, "..", "messages", l, "admin.json"), "utf8"));
      expect(m.campaigns.blocked.voice, l).toBeTruthy();
    }
  });
});
