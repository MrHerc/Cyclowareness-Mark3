import { createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { can, type Permission } from "../src/server/auth/permissions";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { parseCsv } from "../src/lib/csv";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
let viewer: Viewer;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => createTranslator({ ...(await messagesFor("en")), namespace: namespace as never }),
}));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer, allowed: (v: Viewer, p: Permission) => can(v.user.role, p), twoFactorGap: () => false }));

const { GET } = await import("../src/app/api/admin/policies/[id]/signoffs/route");

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("GET /api/admin/policies/[id]/signoffs", () => {
  it("lists the sign-off addresses for roles that read the audit log, and leaves the column out for a content creator", async () => {
    const tenant = await addTenant(db, { plan: "professional" });
    const signer = await addUser(db, tenant.id);
    const [policy] = await db.insert(t.policies).values({ tenantId: tenant.id, title: "Acceptable use" }).returning();
    const [version] = await db.insert(t.policyVersions).values({ policyId: policy.id, version: 1, title: "Acceptable use", bodyMd: "Use the systems responsibly, always.", publishedAt: new Date() }).returning();
    await db.insert(t.policySignoffs).values({ versionId: version.id, userId: signer.id, ip: "203.0.113.7" });
    const download = async (role: t.Role) => {
      const user = await addUser(db, tenant.id, { role });
      viewer = { sessionId: "s", twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } };
      const res = await GET(new Request(`http://localhost:3000/api/admin/policies/${policy.id}/signoffs`), { params: Promise.resolve({ id: policy.id }) });
      expect(res.status).toBe(200);
      return parseCsv((await res.text()).replace(/^﻿/, ""));
    };

    const [adminHeader, ...adminRows] = await download("tenant_admin");
    expect(adminHeader.at(-1)).toBe("IP");
    expect(adminRows.find((r) => r[1] === signer.email)?.at(-1)).toBe("203.0.113.7");

    const [creatorHeader, ...creatorRows] = await download("content_creator");
    expect(creatorHeader).toEqual(adminHeader.slice(0, -1));
    expect(creatorRows.every((r) => r.length === creatorHeader.length)).toBe(true);
    expect(JSON.stringify(creatorRows)).not.toContain("203.0.113.7");
  });
});
