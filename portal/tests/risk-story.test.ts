import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { messagesFor } from "../src/i18n/translator";
import { LOCALES } from "../src/i18n/config";
import { withDefaults } from "../src/lib/tenant-defaults";
import { dayPlus } from "../src/lib/time";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
// A missing or misspelt argument throws instead of printing the message key.
vi.mock("next-intl/server", () => ({
  getTranslations: async (o: { locale: string; namespace: string }) =>
    createTranslator({
      ...(await messagesFor(o.locale)),
      namespace: o.namespace as never,
      onError: (e) => {
        throw e;
      },
    }),
}));

const { riskStory, storySentences, STORY_MIN_DAYS } = await import("../src/server/queries/risk-story");
const { buildRiskStory } = await import("../src/server/reports/build");

beforeAll(ready, DB_SETUP_TIMEOUT);

const DAY = 86_400_000;
const as = (tenantId: string, user: { id: string; role: t.Role }) => ({ user: { departmentId: null, ...user }, tenant: { id: tenantId, settings: withDefaults({}) } }) as unknown as Viewer;
const tz = withDefaults({}).timeZone;

/** Daily snapshots for `people`, `days` days back to today, each score falling by one point a day. */
async function snapshots(tenantId: string, people: { id: string; riskScore: number }[], days: number) {
  const rows = people.flatMap((p) => Array.from({ length: days }, (_, i) => ({ tenantId, userId: p.id, day: dayPlus(-(days - 1 - i), tz), score: p.riskScore + (days - 1 - i) })));
  if (rows.length) await db.insert(t.userRiskSnapshots).values(rows);
}

async function org() {
  const tenant = await addTenant(db);
  const finance = await addDepartment(db, tenant.id, "Finance");
  const it_ = await addDepartment(db, tenant.id, "IT");
  const tiny = await addDepartment(db, tenant.id, "Tiny");
  const fin = [await addUser(db, tenant.id, { departmentId: finance.id, riskScore: 60 }), await addUser(db, tenant.id, { departmentId: finance.id, riskScore: 70 }), await addUser(db, tenant.id, { departmentId: finance.id, riskScore: 80 })];
  const itp = [await addUser(db, tenant.id, { departmentId: it_.id, riskScore: 10 }), await addUser(db, tenant.id, { departmentId: it_.id, riskScore: 20 }), await addUser(db, tenant.id, { departmentId: it_.id, riskScore: 30 })];
  // Highest score, but one person is not a department's risk.
  await addUser(db, tenant.id, { departmentId: tiny.id, riskScore: 95 });
  const admin = await addUser(db, tenant.id, { role: "tenant_admin", riskScore: 0 });
  return { tenant, finance, it_, fin, itp, admin };
}

describe("riskStory", () => {
  it("is an empty state for a new organisation and below the minimum of snapshot days", async () => {
    const o = await org();
    const v = as(o.tenant.id, o.admin);
    expect(await riskStory(v, "en")).toEqual({ empty: true, days: 0 });
    await snapshots(o.tenant.id, o.fin, STORY_MIN_DAYS - 1);
    expect(await riskStory(v, "en")).toEqual({ empty: true, days: STORY_MIN_DAYS - 1 });
    expect(await storySentences({ empty: true, days: 3 }, "en")).toEqual(["Not enough history for a risk story yet: it needs 7 days of daily risk snapshots, and 3 days have been collected."]);
  });

  it("names the most exposed department, its weakest category, the trend, the mover, certificates and the next step", async () => {
    const o = await org();
    const now = Date.now();
    const email = await addModule(db, { category: "email", title: { en: "Phishing basics" }, lessons: 0 });
    const accounts = await addModule(db, { category: "accounts", title: { en: "Passwords" }, lessons: 0 });
    await snapshots(o.tenant.id, [...o.fin, ...o.itp], 8);
    const risk = (userId: string, moduleId: string, status: "open" | "closed" = "open") => ({ tenantId: o.tenant.id, userId, kind: "phishing_click" as const, severity: "medium" as const, title: "Clicked", moduleId, status });
    await db.insert(t.behaviorRisks).values([risk(o.fin[0].id, email.id), risk(o.fin[1].id, email.id), risk(o.fin[2].id, accounts.id), risk(o.fin[2].id, accounts.id, "closed"), risk(o.itp[0].id, accounts.id)]);
    const [before, after] = await db
      .insert(t.campaigns)
      .values([
        { tenantId: o.tenant.id, name: "Invoice lure", channel: "email", templateKey: "invoice", audience: "all", status: "completed", launchedAt: new Date(now - 40 * DAY) },
        { tenantId: o.tenant.id, name: "Parcel lure", channel: "email", templateKey: "parcel", audience: "all", status: "completed", launchedAt: new Date(now - 3 * DAY) },
      ])
      .returning();
    const people = [...o.fin, o.itp[0]];
    await db.insert(t.campaignRecipients).values([
      ...people.map((p, i) => ({ campaignId: before.id, userId: p.id, token: `b${i}${before.id}`, sentAt: before.launchedAt, clickedAt: i < 2 ? before.launchedAt : null })),
      ...people.map((p, i) => ({ campaignId: after.id, userId: p.id, token: `a${i}${after.id}`, sentAt: after.launchedAt, clickedAt: i < 1 ? after.launchedAt : null })),
    ]);
    const done = new Date(now - 2 * DAY);
    await db.insert(t.moduleProgress).values([
      { userId: o.fin[0].id, moduleId: email.id, status: "completed", percent: 100, completedAt: done },
      { userId: o.fin[1].id, moduleId: email.id, status: "completed", percent: 100, completedAt: done },
      { userId: o.itp[0].id, moduleId: accounts.id, status: "completed", percent: 100, completedAt: done },
      { userId: o.itp[1].id, moduleId: accounts.id, status: "completed", percent: 100, completedAt: new Date(now - 60 * DAY) },
      { userId: o.itp[2].id, moduleId: accounts.id, status: "completed", percent: 100, completedAt: new Date(now - 60 * DAY) },
    ]);
    await db.insert(t.certificates).values([
      { tenantId: o.tenant.id, userId: o.fin[0].id, moduleId: email.id, serial: `S-${email.id}`, publicToken: `p${email.id}`, evidence: "server_verified" },
      { tenantId: o.tenant.id, userId: o.fin[1].id, moduleId: email.id, serial: `T-${email.id}`, publicToken: `q${email.id}`, evidence: "self_reported" },
    ]);

    const s = await riskStory(as(o.tenant.id, o.admin), "en");
    if (s.empty) throw new Error("expected a story");
    // Finance and IT fall from (score + 7) to score: averages 52 → 45 over the eight snapshot days.
    expect(s.trend).toMatchObject({ from: 52, to: 45 });
    expect(s.weakest).toEqual({ id: o.finance.id, name: "Finance", risk: 70, category: "email", inCategory: 2, module: { id: email.id, title: "Phishing basics" } });
    expect(s.campaign).toEqual({ name: "Parcel lure", from: 50, to: 25 });
    expect(s.training).toEqual({ title: "Phishing basics", people: 2 });
    expect(s.certified).toEqual({ people: 1, total: 8, share: 13 });

    const sentences = await storySentences(s, "en");
    expect(sentences).toHaveLength(6);
    expect(sentences[0]).toBe("Finance is the most exposed department, with an average risk score of 70; its weakest area is “Email”, with 2 open risks.");
    expect(sentences[1]).toMatch(/^Since .+, the average risk score has fallen by 7 points to 45\.$/);
    expect(sentences[5]).toBe("Recommended next step: assign “Phishing basics” to Finance.");

    // A department filter narrows the story to that department's people.
    const it = await riskStory(as(o.tenant.id, o.admin), "en", o.it_.id);
    if (it.empty) throw new Error("expected a story");
    expect(it.weakest).toMatchObject({ name: "IT", category: "accounts", inCategory: 1 });
    expect(it.certified).toEqual({ people: 0, total: 3, share: 0 });

    // The compliance pack carries the same sentences as its own section.
    const section = await buildRiskStory(as(o.tenant.id, o.admin), {}, "en");
    expect(section).toEqual({ title: "Risk story", headers: ["Finding"], rows: sentences.map((x) => [x]) });

    // A filter outside the viewer's scope, or another organisation's department, matches nobody.
    const head = await addUser(db, o.tenant.id, { departmentId: o.it_.id, role: "department_head", riskScore: 0 });
    expect(await riskStory(as(o.tenant.id, head), "en", o.finance.id)).toEqual({ empty: true, days: 0 });
    const foreign = await addDepartment(db, (await addTenant(db)).id, "Elsewhere");
    expect(await riskStory(as(o.tenant.id, o.admin), "en", foreign.id)).toEqual({ empty: true, days: 0 });
  });
});

describe("storySentences", () => {
  const since = new Date("2026-10-16T00:00:00Z");
  const full = {
    empty: false as const,
    trend: { since, from: 50, to: 41 },
    weakest: { id: "d", name: "Finance", risk: 70, category: "social", inCategory: 3, module: { id: "m", title: "CEO fraud" } },
    campaign: { name: "Parcel lure", from: 40, to: 12 },
    training: { title: "CEO fraud", people: 21 },
    certified: { people: 1, total: 2, share: 50 },
  };
  const sparse = { ...full, trend: { since, from: 40, to: 41 }, weakest: { ...full.weakest, category: null, inCategory: 0, module: null }, campaign: null, training: null };
  const steady = { ...sparse, trend: { since, from: 41, to: 41 }, weakest: null };

  for (const locale of LOCALES) {
    it(`renders every sentence and tile in ${locale} without a missing argument`, async () => {
      for (const [story, n] of [[full, 6], [sparse, 3], [steady, 2], [{ empty: true as const, days: 0 }, 1], [{ empty: true as const, days: 2 }, 1]] as const) {
        const out = await storySentences(story, locale);
        expect(out).toHaveLength(n);
        for (const line of out) expect(line).not.toMatch(/[{}]|riskStory/);
      }
      const tr = createTranslator({ ...(await messagesFor(locale)), namespace: "admin.riskStory", onError: (e) => { throw e; } });
      for (const k of ["risk", "certified", "weakest"] as const) expect(tr(`tiles.${k}`)).toBeTruthy();
      expect(tr("tiles.change", { since })).not.toMatch(/[{}]/);
    });
  }
});
