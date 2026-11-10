import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "../src/server/db/schema";
import { featuresFor, type Feature } from "../src/lib/tenant-defaults";

vi.mock("../src/server/db", async () => ({ db: () => ({}), t: await import("../src/server/db/schema") }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { allowed, privileged, twoFactorGap } = await import("../src/server/auth/viewer");
type V = Parameters<typeof allowed>[0];

const viewer = (role: Role, o: { requireAdmin2fa?: boolean; totpEnabled?: boolean; features?: Set<Feature> } = {}) =>
  ({
    user: { role, totpEnabled: o.totpEnabled ?? false },
    tenant: { settings: { identity: { requireAdmin2fa: o.requireAdmin2fa ?? false } }, features: o.features ?? featuresFor("enterprise_hrm") },
  }) as unknown as V;

describe("two-step rule on admin pages and actions", () => {
  it("always applies to the platform operator, and to every console role when the organisation requires it", () => {
    expect(twoFactorGap(viewer("super_admin"))).toBe(true);
    expect(twoFactorGap(viewer("super_admin", { totpEnabled: true }))).toBe(false);
    for (const role of ["executive", "content_creator", "department_head", "tenant_admin"] as const) {
      expect(twoFactorGap(viewer(role, { requireAdmin2fa: true })), role).toBe(true);
      expect(twoFactorGap(viewer(role)), role).toBe(false);
    }
    expect(twoFactorGap(viewer("learner", { requireAdmin2fa: true }))).toBe(false);
  });

  it("also gates a console permission used inside a self-service action (privileged)", () => {
    // An analyst who has not enrolled the mandatory authenticator gets no analyst powers on learner paths either.
    expect(privileged(viewer("analyst", { requireAdmin2fa: true }), "secops.read")).toBe(false);
    expect(privileged(viewer("analyst", { requireAdmin2fa: true }), "support.manage")).toBe(false);
    expect(privileged(viewer("analyst", { requireAdmin2fa: true, totpEnabled: true }), "secops.read")).toBe(true);
    expect(privileged(viewer("analyst"), "secops.read")).toBe(true);
    expect(privileged(viewer("content_creator", { requireAdmin2fa: true }), "studio.write")).toBe(false);
    expect(privileged(viewer("learner", { totpEnabled: true }), "secops.read")).toBe(false);
  });
});

describe("drafts outside the console", () => {
  it("open in learner pages, actions and routes only through privileged(), never allowed()", () => {
    const src = path.join(__dirname, "..", "src");
    const offenders = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/^app[\\/]\(admin\)|^app[\\/]api[\\/]admin/.test(f))
      .filter((f) => /\ballowed\([^)]*"studio\.write"\)/.test(readFileSync(path.join(src, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("plan features behind permissions", () => {
  it("refuses reports, league, paths, support and feedback once their feature is off", () => {
    const off = featuresFor("enterprise_hrm", { reports: false, league: false, paths: false, support: false, feedback: false });
    for (const p of ["reports.read", "league.read", "paths.write", "support.manage", "feedback.read"] as const) {
      expect(allowed(viewer("tenant_admin"), p), p).toBe(true);
      expect(allowed(viewer("tenant_admin", { features: off }), p), p).toBe(false);
    }
  });
});
