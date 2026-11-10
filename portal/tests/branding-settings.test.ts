import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { addTenant, DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

// Branding is one JSON column: a colour save and a logo upload at the same moment must not undo each other.
const { db, ready } = testDb();
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
let viewer: { user: { id: string }; tenant: { id: string } } | null = null;
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => viewer, hasFeature: () => true }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { saveBrandingAction, setLogoAction } = await import("../src/server/actions/settings");

const PNG = `data:image/png;base64,${Buffer.from("logo-bytes").toString("base64")}`;

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("branding saves", () => {
  it("keep both a colour change and a logo upload made at the same moment, with one logo asset", async () => {
    const tenant = await addTenant(db);
    viewer = { user: { id: "00000000-0000-4000-8000-000000000001" }, tenant: { id: tenant.id } };
    expect(await Promise.all([saveBrandingAction({ name: "Acme", primary: "#AA0000", accent: "#00AA00" }), setLogoAction(PNG), setLogoAction(PNG)])).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    const [row] = await db.select({ branding: t.tenants.branding }).from(t.tenants).where(eq(t.tenants.id, tenant.id));
    const logos = await db.select({ id: t.assets.id }).from(t.assets).where(eq(t.assets.tenantId, tenant.id));
    expect(logos).toHaveLength(1);
    expect(row.branding).toMatchObject({ primary: "#aa0000", accent: "#00aa00", logoUrl: expect.stringContaining(`/api/assets/${logos[0].id}`) });
  });
});
