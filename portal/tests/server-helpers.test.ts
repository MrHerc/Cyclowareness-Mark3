import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { JOBS_ENABLED: "1" }, appUrl: () => "https://portal.example" }));

const { audit, withoutNul, AUDIT_ACTIONS } = await import("../src/server/services/audit");
const { emitEvent } = await import("../src/server/services/events");
const { createTenantWithAdmin, TENANT_SLUG_RE } = await import("../src/server/services/tenants");
const { issueAccountLink } = await import("../src/server/auth/links");
const { sha256Hex } = await import("../src/server/crypto");
const { defaultSettings } = await import("../src/lib/tenant-defaults");

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("withoutNul", () => {
  it("removes U+0000 from strings, keys and nested values", () => {
    expect(withoutNul("a\u0000b")).toBe("ab");
    expect(withoutNul({ "k\u0000": ["x\u0000", { y: "z\u0000" }], n: 1, ok: true, none: null })).toEqual({ k: ["x", { y: "z" }], n: 1, ok: true, none: null });
  });

  it("leaves other objects alone", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    expect(withoutNul({ at }).at).toBe(at);
  });
});

describe("audit", () => {
  it("writes an entry PostgreSQL can store even when caller text carries NUL bytes", async () => {
    const tenant = await addTenant(db);
    await audit(db, { tenantId: tenant.id, actorId: null, action: "auth.sign_in", targetType: "user\u0000", targetId: "id\u0000", meta: { ua: "Mozilla\u0000/5.0" }, ip: "10.0.0.1\u0000" });
    const [row] = await db.select().from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id));
    expect(row).toMatchObject({ action: "auth.sign_in", targetType: "user", targetId: "id", meta: { ua: "Mozilla/5.0" }, ip: "10.0.0.1" });
  });

  it("keeps optional fields null and honours a given time", async () => {
    const tenant = await addTenant(db);
    const at = new Date("2026-01-02T03:04:05Z");
    await audit(db, { tenantId: tenant.id, actorId: null, action: "auth.sign_out", at });
    const [row] = await db.select().from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id));
    expect(row).toMatchObject({ targetType: null, targetId: null, meta: null, ip: null, at });
  });

  it("has a translated sentence for every action code in every language", async () => {
    const fs = await import("node:fs");
    const { LOCALES } = await import("../src/i18n/config");
    for (const locale of LOCALES) {
      const labels = JSON.parse(fs.readFileSync(`messages/${locale}/admin.json`, "utf8")).auditActions as Record<string, string>;
      const missing = AUDIT_ACTIONS.filter((a) => !labels[a.replaceAll(".", "_")]);
      expect(missing, locale).toEqual([]);
    }
  });
});

describe("emitEvent", () => {
  const integrations = (o: Partial<t.TenantSettings["integrations"]>) => ({ ...defaultSettings("en"), integrations: { webhookEnabled: false, webhookEvents: [], syslogEnabled: false, ...o } });
  const queued = async (tenantId: string) => db.select().from(t.webhookDeliveries).where(eq(t.webhookDeliveries.tenantId, tenantId));

  it("queues one delivery per enabled target for subscribed events only", async () => {
    const tenant = await addTenant(db, { plan: "professional", settings: integrations({ webhookEnabled: true, webhookUrl: "https://siem.example/hook", syslogEnabled: true, syslogHost: "siem.example", webhookEvents: ["incident.created"] }) });
    await emitEvent(db, tenant.id, "incident.created", { number: "IR-20" });
    await emitEvent(db, tenant.id, "phishing.clicked", { userId: "x" });
    const rows = await queued(tenant.id);
    expect(rows.map((r) => r.target).sort()).toEqual(["syslog", "webhook"]);
    expect(rows[0].payload).toMatchObject({ event: "incident.created", tenantId: tenant.id, data: { number: "IR-20" } });
    expect(Date.parse(String(rows[0].payload.occurredAt))).not.toBeNaN();
  });

  it("sends nothing to a target that is switched off or has no address", async () => {
    const tenant = await addTenant(db, { plan: "professional", settings: integrations({ webhookEnabled: true, syslogEnabled: true, syslogHost: "", webhookEvents: ["incident.created"] }) });
    await emitEvent(db, tenant.id, "incident.created", {});
    expect(await queued(tenant.id)).toEqual([]);
  });

  it("sends nothing on a plan without integrations, or when the operator switched them off", async () => {
    const settings = integrations({ webhookEnabled: true, webhookUrl: "https://siem.example/hook", webhookEvents: ["incident.created"] });
    const essentials = await addTenant(db, { plan: "essentials", settings });
    const overridden = await addTenant(db, { plan: "enterprise_hrm", settings, features: { integrations: false } });
    await emitEvent(db, essentials.id, "incident.created", {});
    await emitEvent(db, overridden.id, "incident.created", {});
    expect(await queued(essentials.id)).toEqual([]);
    expect(await queued(overridden.id)).toEqual([]);
  });

  it("ignores an unknown tenant", async () => {
    await expect(emitEvent(db, "00000000-0000-4000-8000-000000000000", "incident.created", {})).resolves.toBeUndefined();
  });
});

describe("createTenantWithAdmin", () => {
  it("accepts organisation slugs of 3–40 lowercase letters, digits and inner hyphens", () => {
    for (const ok of ["abc", "safarov", "acme-2026", "a".repeat(40)]) expect(TENANT_SLUG_RE.test(ok), ok).toBe(true);
    for (const bad of ["ab", "-abc", "abc-", "ABC", "a_b", "a b", "a".repeat(41), "ağ"]) expect(TENANT_SLUG_RE.test(bad), bad).toBe(false);
  });

  it("creates the organisation with default settings and an invited administrator", async () => {
    const { tenantId, adminId } = await createTenantWithAdmin(db, { slug: "neworg", name: "New Org", plan: "professional", locale: "ru", adminName: "Ivan Petrov", adminEmail: "Ivan.Petrov@NewOrg.Example" });
    const [tenant] = await db.select().from(t.tenants).where(eq(t.tenants.id, tenantId));
    const [admin] = await db.select().from(t.users).where(eq(t.users.id, adminId));
    expect(tenant).toMatchObject({ slug: "neworg", plan: "professional", branding: { senderName: "New Org" } });
    expect(tenant.settings.defaultLocale).toBe("ru");
    expect(tenant.settings.identity.requireAdmin2fa).toBe(true);
    expect(admin).toMatchObject({ email: "ivan.petrov@neworg.example", role: "tenant_admin", status: "invited", locale: "ru", passwordHash: null });
  });

  it("creates the platform operator as super_admin when asked", async () => {
    const { adminId } = await createTenantWithAdmin(db, { slug: "platform-x", name: "Platform", plan: "enterprise_hrm", locale: "en", adminName: "Op", adminEmail: "op@platform.example", adminRole: "super_admin" });
    const [admin] = await db.select({ role: t.users.role }).from(t.users).where(eq(t.users.id, adminId));
    expect(admin.role).toBe("super_admin");
  });
});

describe("issueAccountLink", () => {
  const tokens = async (userId: string, kind: "invite" | "reset") => db.select().from(t.authTokens).where(and(eq(t.authTokens.userId, userId), eq(t.authTokens.kind, kind)));

  it("returns a public link whose token is stored only as its hash", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id, { status: "invited" });
    const link = await issueAccountLink(user.id, "invite");
    const token = link.match(/^https:\/\/portal\.example\/account\/invite\/([a-z2-7]+)$/)?.[1];
    expect(token).toBeTruthy();
    const [row] = await tokens(user.id, "invite");
    expect(row.id).toBe(sha256Hex(token!));
    expect(row.id).not.toContain(token!);
  });

  it("gives invites 14 days and resets one hour", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id);
    const before = Date.now();
    await issueAccountLink(user.id, "invite");
    await issueAccountLink(user.id, "reset");
    const [invite] = await tokens(user.id, "invite");
    const [reset] = await tokens(user.id, "reset");
    expect(invite.expiresAt.getTime() - before).toBeGreaterThanOrEqual(14 * 86_400_000 - 5_000);
    expect(invite.expiresAt.getTime() - before).toBeLessThanOrEqual(14 * 86_400_000 + 5_000);
    expect(reset.expiresAt.getTime() - before).toBeGreaterThanOrEqual(60 * 60_000 - 5_000);
    expect(reset.expiresAt.getTime() - before).toBeLessThanOrEqual(60 * 60_000 + 5_000);
  });

  it("replaces an earlier reset link but keeps live invite links", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id, { status: "invited" });
    await issueAccountLink(user.id, "reset");
    await issueAccountLink(user.id, "reset");
    expect(await tokens(user.id, "reset")).toHaveLength(1);
    await issueAccountLink(user.id, "invite");
    await issueAccountLink(user.id, "invite");
    expect(await tokens(user.id, "invite")).toHaveLength(2);
  });

  it("cleans up used and expired invite links when a new one is made", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id, { status: "invited" });
    await db.insert(t.authTokens).values([
      { id: "used", userId: user.id, kind: "invite", expiresAt: new Date(Date.now() + 86_400_000), usedAt: new Date() },
      { id: "expired", userId: user.id, kind: "invite", expiresAt: new Date(Date.now() - 1_000) },
      { id: "live", userId: user.id, kind: "invite", expiresAt: new Date(Date.now() + 86_400_000) },
    ]);
    await issueAccountLink(user.id, "invite");
    const ids = (await tokens(user.id, "invite")).map((r) => r.id);
    expect(ids).toContain("live");
    expect(ids).not.toContain("used");
    expect(ids).not.toContain("expired");
    expect(ids).toHaveLength(2);
  });
});
