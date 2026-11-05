import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { defaultSettings } from "../src/lib/tenant-defaults";

// The single sign-on routes against a real (in-memory) database; the provider round trip is stubbed.
const h = vi.hoisted(() => ({
  db: undefined as unknown,
  session: null as unknown,
  claims: {} as Record<string, unknown>,
  cookie: undefined as string | undefined,
  audits: [] as { action: string; meta?: Record<string, unknown> }[],
}));
vi.mock("../src/server/db", async () => ({ db: () => h.db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0, isProd: false, secret: "test-only-secret-0123456789-abcdefghij-0123456789" }, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/request", async (original) => ({ ...(await original<typeof import("../src/server/request")>()), clientIp: async () => null, userAgent: async () => null }));
vi.mock("../src/server/auth/viewer", () => ({ getSession: async () => h.session, allowed: () => true }));
vi.mock("../src/server/services/audit", () => ({ audit: async (_db: unknown, entry: { action: string; meta?: Record<string, unknown> }) => void h.audits.push(entry) }));
vi.mock("../src/server/auth/oidc", async (original) => ({
  ...(await original<typeof import("../src/server/auth/oidc")>()),
  discover: async (issuer: string) => ({ issuer, authorizationEndpoint: `${issuer}/auth`, tokenEndpoint: `${issuer}/token`, jwksUri: `${issuer}/jwks`, secretPost: false }),
  exchangeCode: async () => "id-token",
  verifyIdToken: async () => h.claims,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "cy_sso" && h.cookie ? { value: h.cookie } : undefined), set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));

const start = await import("../src/app/api/sso/start/route");
const callback = await import("../src/app/api/sso/callback/[tenant]/route");
const { sealState } = await import("../src/server/auth/oidc");
const db = () => h.db as DB;

const ISSUER = "https://idp.sso.test";
const SUB = (sub: string) => `${ISSUER} ${sub}`;
let proven: string;
let unproven: string;

/** Where the route redirected (NEXT_REDIRECT carries the target in its digest). */
const redirectOf = (run: Promise<unknown>) =>
  run.then(
    () => "no redirect",
    (e: { digest?: string }) => {
      const m = /^NEXT_REDIRECT;[a-z]+;(.*);\d+;$/.exec(String(e?.digest));
      if (!m) throw e;
      return m[1];
    },
  );
const lastRefusal = () => h.audits.filter((a) => a.action === "sso.sign_in_refused").at(-1)?.meta?.reason;

async function signIn(slug: string, claims: Record<string, unknown>) {
  h.claims = { iss: ISSUER, email_verified: true, ...claims };
  h.cookie = sealState({ state: "s1", nonce: "n1", verifier: "v1", tenant: slug, test: false, at: Date.now() });
  return redirectOf(callback.GET(new Request(`http://localhost:3000/api/sso/callback/${slug}?code=c&state=s1`), { params: Promise.resolve({ tenant: slug }) }));
}

beforeAll(async () => {
  const pglite = new PGlite();
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  h.db = drizzle(pglite, { schema: t });
  const settings = defaultSettings("en");
  settings.identity = { ...settings.identity, ssoEnabled: true, sso: { protocol: "oidc", issuer: ISSUER, clientId: "portal", autoCreate: true } };
  const branding = { primary: "#4f46e5", accent: "#ff7a1a" };
  [{ id: proven }] = await db().insert(t.tenants).values({ slug: "proven", name: "Proven", plan: "professional", branding, settings, domain: "proven.test", domainVerifiedAt: new Date() }).returning();
  [{ id: unproven }] = await db().insert(t.tenants).values({ slug: "unproven", name: "Unproven", plan: "professional", branding, settings, domain: "unproven.test", domainVerifiedAt: null }).returning();
}, 180_000);

beforeEach(() => {
  h.session = null;
  h.audits.length = 0;
});

describe("SSO start", () => {
  it("refuses an organisation whose domain proof is missing, unless an administrator tests the settings", async () => {
    expect(await redirectOf(start.GET(new Request("http://localhost:3000/api/sso/start?tenant=unproven")))).toBe("/sign-in?error=sso");
    h.session = { tenant: { slug: "unproven" } };
    expect(await redirectOf(start.GET(new Request("http://localhost:3000/api/sso/start?tenant=unproven&test=1")))).toMatch(/^https:\/\/idp\.sso\.test\/auth\?/);
    expect(await redirectOf(start.GET(new Request("http://localhost:3000/api/sso/start?tenant=proven")))).toMatch(/^https:\/\/idp\.sso\.test\/auth\?/);
  });
});

describe("SSO callback", () => {
  it("refuses an unproven domain before any account is looked up or created", async () => {
    expect(await signIn("unproven", { sub: "u-1", email: "new@unproven.test" })).toBe("/sign-in?error=sso");
    expect(lastRefusal()).toBe("domain_unproven");
    expect(await db().select().from(t.users).where(eq(t.users.email, "new@unproven.test"))).toEqual([]);
  });

  it("binds the provider's subject at the first sign-in and refuses another subject for the same address", async () => {
    expect(await signIn("proven", { sub: "p-1", email: "aysel@proven.test" })).toBe("/app");
    const [created] = await db().select().from(t.users).where(eq(t.users.email, "aysel@proven.test"));
    expect(created).toMatchObject({ tenantId: proven, status: "active", ssoSubject: SUB("p-1") });
    expect(await signIn("proven", { sub: "p-1", email: "aysel@proven.test" })).toBe("/app");
    expect(await signIn("proven", { sub: "p-2", email: "aysel@proven.test" })).toBe("/sign-in?error=sso");
    expect(lastRefusal()).toBe("subject_changed");
    expect(await signIn("proven", { email: "aysel@proven.test" })).toBe("/sign-in?error=sso");
    expect(lastRefusal()).toBe("no_subject");
  });

  it("binds an existing account at its first single sign-on and again after an administrator unlinks it", async () => {
    await db().insert(t.users).values({ tenantId: proven, email: "rauf@proven.test", name: "Rauf", passwordHash: "hash" });
    expect(await signIn("proven", { sub: "p-3", email: "rauf@proven.test" })).toBe("/app");
    const subject = () => db().select({ ssoSubject: t.users.ssoSubject }).from(t.users).where(eq(t.users.email, "rauf@proven.test")).then(([u]) => u.ssoSubject);
    expect(await subject()).toBe(SUB("p-3"));
    await db().update(t.users).set({ ssoSubject: null }).where(eq(t.users.email, "rauf@proven.test"));
    expect(await signIn("proven", { sub: "p-4", email: "rauf@proven.test" })).toBe("/app");
    expect(await subject()).toBe(SUB("p-4"));
  });

  it("needs a verified standard email claim, but trusts a claim the organisation named", async () => {
    expect(await signIn("proven", { sub: "p-5", email: "leyla@proven.test", email_verified: false })).toBe("/sign-in?error=sso");
    expect(lastRefusal()).toBe("email_not_verified");
    const [row] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, proven));
    const custom = { ...row.settings, identity: { ...row.settings.identity, sso: { ...row.settings.identity.sso!, emailClaim: "upn" } } };
    await db().update(t.tenants).set({ settings: custom }).where(eq(t.tenants.id, proven));
    expect(await signIn("proven", { sub: "p-5", upn: "leyla@proven.test", email_verified: false })).toBe("/app");
    await db().update(t.tenants).set({ settings: row.settings }).where(eq(t.tenants.id, proven));
  });
});
