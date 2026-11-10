import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

// The simulation sender address: saved only on a look-alike domain proven by TXT record, used only for simulation mail.
const sendMail = vi.fn(async () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
// The mail server resolves to a public address (net-guard); the TXT resolver is replaced below.
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "8.8.4.4", family: 4 }], Resolver: class {} }));
// The TXT record published on each domain; a domain is found only when the action looks for that record.
const published = new Map<string, string>();
vi.mock("../src/server/auth/domain-proof", async (original) => ({
  ...(await original<typeof import("../src/server/auth/domain-proof")>()),
  domainProofFound: async (host: string, expected: string | readonly string[]) => [expected].flat().includes(published.get(host) ?? "-"),
}));
// A separate domain-proof secret, as the rotation runbook leaves it: the proof must not be keyed on APP_SECRET.
vi.mock("../src/server/env", () => ({ env: { isProd: false, secret: "test-only-secret-0123456789-abcdefghij-0123456789", domainProofSecret: "proof-only-secret-0123456789-abcdefghij-012345" }, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(), getFormatter: vi.fn() }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
let tenantId = "";
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => ({ user: { id: "00000000-0000-4000-8000-000000000001", locale: "en" }, tenant: { id: tenantId, name: "Acme" } }), hasFeature: () => true }));

const { domainProofRecordAction, saveEmailAction, verifySimulationDomainAction } = await import("../src/server/actions/settings");
const { domainProofRecord } = await import("../src/server/auth/domain-proof");
const { env } = await import("../src/server/env");
const { queueEmail } = await import("../src/server/mail");
/** Publishes the record Branding → Domain proof shows. */
const prove = async (host: string) => published.set(host, (await domainProofRecordAction()).record);

const SERVER = { host: "smtp.acme.example", port: 587, secure: false, fromAddress: "training@acme.example", enabled: true };
const email = async () => (await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId)))[0].settings.email;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: { email: { ...SERVER, testedAt: new Date().toISOString() } } as never }).returning();
  tenantId = tenant.id;
}, 180_000);

describe("simulation sender address", () => {
  it("is saved only once its look-alike domain is proven by the TXT record", async () => {
    expect(await saveEmailAction({ ...SERVER, simulationFromAddress: "accounts@ofis-techizat.example" })).toEqual({ ok: false, field: "simulationFromAddress", error: "simulationNotProven" });
    expect(await verifySimulationDomainAction("not an address")).toEqual({ ok: false, found: false });
    expect(await verifySimulationDomainAction("accounts@ofis-techizat.example")).toEqual({ ok: true, found: false, domain: "ofis-techizat.example" });
    expect((await email()).simulationDomain).toBeUndefined();
    // A record keyed on APP_SECRET is not the one the organisation was told to publish.
    published.set("ofis-techizat.example", domainProofRecord(tenantId, env.secret));
    expect((await verifySimulationDomainAction("accounts@ofis-techizat.example")).found).toBe(false);
    await prove("ofis-techizat.example");
    expect(await verifySimulationDomainAction("accounts@Ofis-Techizat.example")).toEqual({ ok: true, found: true, domain: "ofis-techizat.example" });
    expect((await email()).simulationDomain).toBe("ofis-techizat.example");
    expect(await saveEmailAction({ ...SERVER, simulationFromAddress: "accounts@ofis-techizat.example" })).toEqual({ ok: true });
    expect((await email()).simulationFromAddress).toBe("accounts@ofis-techizat.example");
    // Another domain, even the organisation's own, is not the proven one.
    expect(await saveEmailAction({ ...SERVER, simulationFromAddress: "accounts@acme.example" })).toEqual({ ok: false, field: "simulationFromAddress", error: "simulationNotProven" });
    expect((await email()).simulationFromAddress).toBe("accounts@ofis-techizat.example");
  });

  it("is the From address of simulation mail only", async () => {
    sendMail.mockClear();
    expect((await queueEmail(db, tenantId, { to: "aysel@acme.example", kind: "simulation", subject: "Payslip", text: "Open", lang: "en", fromName: "Accounting" })).status).toBe("sent");
    expect((await queueEmail(db, tenantId, { to: "aysel@acme.example", kind: "welcome", subject: "Welcome", text: "Hello", lang: "en" })).status).toBe("sent");
    expect(sendMail).toHaveBeenNthCalledWith(1, expect.objectContaining({ from: '"Accounting" <accounts@ofis-techizat.example>' }));
    expect(sendMail).toHaveBeenNthCalledWith(2, expect.objectContaining({ from: '"Acme" <training@acme.example>' }));
  });

  it("drops the address when a different domain is proven", async () => {
    await prove("other.example");
    expect((await verifySimulationDomainAction("x@other.example")).found).toBe(true);
    const e = await email();
    expect(e.simulationDomain).toBe("other.example");
    expect(e.simulationFromAddress).toBeUndefined();
  });
});
