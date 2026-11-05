import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { dayAt, dayBoundary, dayPlus, offsetAt, todayIn, zonedTime } from "@/lib/time";
import { fromZonedParts, zonedParts } from "@/lib/baku-clock";
import { toCsv } from "@/lib/csv";
import { dayKey } from "@/lib/domain/gamification";
import { DEFAULT_TIME_ZONE } from "@/lib/day";
import { isTimeZone, withDefaults } from "@/lib/tenant-defaults";
import { toXlsx } from "@/server/reports/xlsx";

vi.mock("../src/server/env", async (original) => ({ ...(await original<typeof import("../src/server/env")>()), appUrl: () => "https://app.test" }));
const audit = vi.fn();
vi.mock("../src/server/services/audit", () => ({ audit }));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
let viewer: { user: { id: string }; tenant: { id: string; settings: { timeZone: string } } } | null = null;
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => viewer, hasFeature: () => true }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { dueEnd, scheduledReports } = await import("../src/server/jobs");
const { awardXp } = await import("../src/server/services/progress");
const { saveTimeZoneAction } = await import("../src/server/actions/settings");

const BERLIN = "Europe/Berlin";
const RIYADH = "Asia/Riyadh";

describe("offsetAt and zonedTime", () => {
  it("reads the offset in force from Intl, daylight saving included", () => {
    expect(offsetAt(DEFAULT_TIME_ZONE, new Date("2026-07-01T00:00:00Z"))).toBe("+04:00");
    expect(offsetAt(RIYADH, new Date("2026-01-15T00:00:00Z"))).toBe("+03:00");
    expect(offsetAt(BERLIN, new Date("2026-01-15T00:00:00Z"))).toBe("+01:00");
    expect(offsetAt(BERLIN, new Date("2026-07-01T00:00:00Z"))).toBe("+02:00");
    expect(offsetAt("UTC", new Date("2026-07-01T00:00:00Z"))).toBe("+00:00");
  });

  it("gives the wall-clock time on the days the clocks change", () => {
    // Berlin springs forward on 29 March 2026 at 02:00 and falls back on 25 October at 03:00.
    expect(zonedTime("2026-03-29", "01:30:00", BERLIN).toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(zonedTime("2026-03-29", "12:00:00", BERLIN).toISOString()).toBe("2026-03-29T10:00:00.000Z");
    expect(zonedTime("2026-10-25", "12:00:00", BERLIN).toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });
});

describe("due dates end at 23:59:59 in the organisation's zone", () => {
  it("in Berlin, on either side of a daylight-saving change", () => {
    expect(dueEnd("2026-03-28", BERLIN).toISOString()).toBe("2026-03-28T22:59:59.000Z");
    expect(dueEnd("2026-03-29", BERLIN).toISOString()).toBe("2026-03-29T21:59:59.000Z");
    expect(dueEnd("2026-10-24", BERLIN).toISOString()).toBe("2026-10-24T21:59:59.000Z");
    expect(dueEnd("2026-10-25", BERLIN).toISOString()).toBe("2026-10-25T22:59:59.000Z");
  });

  it("in Riyadh and, as before the setting existed, in Baku", () => {
    expect(dueEnd("2026-11-30", RIYADH).toISOString()).toBe("2026-11-30T20:59:59.000Z");
    expect(dueEnd("2026-11-30", DEFAULT_TIME_ZONE).toISOString()).toBe("2026-11-30T19:59:59.000Z");
  });

  it("day boundaries follow the zone: Berlin's 25 October has 25 hours", () => {
    const start = dayBoundary("2026-10-25", false, BERLIN)!;
    const end = dayBoundary("2026-10-25", true, BERLIN)!;
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000 - 1);
    expect(dayBoundary("2026-10-25")!.toISOString()).toBe("2026-10-24T20:00:00.000Z");
  });

  it("counts days in calendar days, not 24-hour steps", () => {
    // 00:30 on 29 March in Berlin, the 23-hour day: 24 hours earlier is still 27 March's evening.
    const at = new Date("2026-03-28T23:30:00Z");
    expect(todayIn(BERLIN, at)).toBe("2026-03-29");
    expect(dayPlus(-1, BERLIN, at)).toBe("2026-03-28");
    expect(dayPlus(14, BERLIN, at)).toBe("2026-04-12");
    expect(dayAt("2026-03-29", BERLIN).toISOString()).toBe("2026-03-29T10:00:00.000Z");
  });
});

describe("date and time inputs in the organisation's zone", () => {
  it("round-trip in Berlin across a daylight-saving change", () => {
    expect(zonedParts("2026-03-29T00:30:00Z", BERLIN)).toEqual({ date: "2026-03-29", time: "01:30" });
    expect(zonedParts("2026-03-29T01:30:00Z", BERLIN)).toEqual({ date: "2026-03-29", time: "03:30" });
    expect(fromZonedParts("2026-07-01", "10:00", BERLIN)?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(fromZonedParts("2026-12-01", "10:00", BERLIN)?.toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(fromZonedParts("2026-12-01", "10:00", RIYADH)?.toISOString()).toBe("2026-12-01T07:00:00.000Z");
    expect(fromZonedParts("2026-02-30", "10:00", BERLIN)).toBeNull();
  });
});

describe("streak days turn over at the organisation's midnight", () => {
  it("dayKey changes at midnight Berlin, not midnight Baku or UTC", () => {
    expect(dayKey(new Date("2026-07-01T21:59:59Z"), BERLIN)).toBe("2026-07-01");
    expect(dayKey(new Date("2026-07-01T22:00:00Z"), BERLIN)).toBe("2026-07-02");
    expect(dayKey(new Date("2026-12-01T22:59:59Z"), BERLIN)).toBe("2026-12-01");
    expect(dayKey(new Date("2026-12-01T23:00:00Z"), BERLIN)).toBe("2026-12-02");
  });
});

describe("tenant setting", () => {
  it("defaults to Baku for rows written before the setting, and keeps only real IANA zones", () => {
    expect(withDefaults({}).timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(withDefaults({ timeZone: "Mars/Olympus" }).timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(withDefaults({ timeZone: 4 }).timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(withDefaults({ timeZone: BERLIN }).timeZone).toBe(BERLIN);
    expect(isTimeZone(RIYADH)).toBe(true);
    expect(isTimeZone("+03:00")).toBe(false);
  });
});

/** The text of one file in a ZIP made by toXlsx (local headers only: stored or deflated). */
function zipEntry(buf: Buffer, name: string): string {
  for (let o = 0; buf.readUInt32LE(o) === 0x04034b50; ) {
    const method = buf.readUInt16LE(o + 8);
    const size = buf.readUInt32LE(o + 18);
    const nameLen = buf.readUInt16LE(o + 26);
    const start = o + 30 + nameLen + buf.readUInt16LE(o + 28);
    const data = buf.subarray(start, start + size);
    if (buf.toString("utf8", o + 30, o + 30 + nameLen) === name) return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    o = start + size;
  }
  throw new Error(`${name} not found`);
}

describe("exported times", () => {
  const at = new Date("2026-07-01T10:00:00Z");

  it("CSV writes the organisation's wall-clock time", () => {
    expect(toCsv(["at"], [[at]], BERLIN)).toContain("2026-07-01 12:00");
    expect(toCsv(["at"], [[at]], RIYADH)).toContain("2026-07-01 13:00");
    expect(toCsv(["at"], [[at]])).toContain("2026-07-01 14:00");
  });

  it("an XLSX date cell is the organisation's wall-clock time, summer or winter", () => {
    const serial = (wall: number) => wall / 86_400_000 + 25569;
    const sheet = (d: Date, tz?: string) => zipEntry(toXlsx("S", ["at"], [[d]], tz), "xl/worksheets/sheet1.xml");
    expect(sheet(at, BERLIN)).toContain(`<v>${serial(Date.UTC(2026, 6, 1, 12))}</v>`);
    expect(sheet(new Date("2026-12-01T10:00:00Z"), BERLIN)).toContain(`<v>${serial(Date.UTC(2026, 11, 1, 11))}</v>`);
    expect(sheet(at)).toContain(`<v>${serial(Date.UTC(2026, 6, 1, 14))}</v>`);
  });
});

/* ───────── database: streaks and scheduled reports ───────── */

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
let berlin = "";
let baku = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [b] = await db.insert(t.tenants).values({ slug: "berlin", name: "Berlin GmbH", branding: {} as never, settings: { timeZone: BERLIN, email: { enabled: true } } as never }).returning();
  // Written before the setting existed: no timeZone at all.
  const [k] = await db.insert(t.tenants).values({ slug: "baku", name: "Baku MMC", branding: {} as never, settings: {} as never }).returning();
  berlin = b.id;
  baku = k.id;
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("awardXp streak days", () => {
  it("counts 23:30 and 00:30 Berlin as two days for a Berlin organisation, one day in Baku", async () => {
    const streakAfter = async (tenantId: string, email: string) => {
      const [u] = await db.insert(t.users).values({ tenantId, email, name: "Learner" }).returning();
      for (const at of ["2026-07-01T21:30:00Z", "2026-07-01T22:30:00Z"]) await awardXp(db, { tenantId, userId: u.id, amount: 10, reason: "lesson", at: new Date(at) });
      const [row] = await db.select({ current: t.users.streakCurrent, lastDay: t.users.streakLastDay }).from(t.users).where(eq(t.users.id, u.id));
      return row;
    };
    expect(await streakAfter(berlin, "a@berlin.test")).toEqual({ current: 2, lastDay: "2026-07-02" });
    // 01:30 and 02:30 on 2 July in Baku: the same day, exactly as before the setting.
    expect(await streakAfter(baku, "a@baku.test")).toEqual({ current: 1, lastDay: "2026-07-02" });
  });
});

describe("scheduled reports", () => {
  it("go out at 08:00 Berlin time, in summer and in winter", async () => {
    await db.insert(t.reportSchedules).values({ tenantId: berlin, kind: "completion", format: "csv", frequency: "weekly", day: 1, recipients: ["ciso@outside.test"] });
    const [row] = await db.select().from(t.tenants).where(eq(t.tenants.id, berlin));
    const tenant = { id: row.id, name: row.name, settings: withDefaults(row.settings), branding: { primary: "#4f46e5" } };
    // Monday 6 July 2026 (CEST, +02:00) and Monday 9 November 2026 (CET, +01:00).
    expect(await scheduledReports(db, tenant, new Date("2026-07-06T05:59:00Z"))).toBe(0);
    expect(await scheduledReports(db, tenant, new Date("2026-07-06T06:00:00Z"))).toBe(1);
    expect(await scheduledReports(db, tenant, new Date("2026-11-09T06:59:00Z"))).toBe(0);
    expect(await scheduledReports(db, tenant, new Date("2026-11-09T07:00:00Z"))).toBe(1);
    const mail = await db.select({ text: t.outbox.text }).from(t.outbox).where(eq(t.outbox.tenantId, berlin));
    expect(mail.at(-1)?.text).toContain("from=2026-11-02&to=2026-11-09");
  });
});

describe("saveTimeZoneAction", () => {
  it("stores a known IANA zone with an audit entry and refuses anything else", async () => {
    const [row] = await db.insert(t.tenants).values({ slug: "riyadh", name: "Riyadh Co", branding: {} as never, settings: { defaultLocale: "ar" } as never }).returning();
    viewer = { user: { id: "00000000-0000-4000-8000-000000000001" }, tenant: { id: row.id, settings: { timeZone: DEFAULT_TIME_ZONE } } };
    const stored = async () => (await db.select({ s: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, row.id)))[0].s;
    expect(await saveTimeZoneAction("Mars/Olympus")).toEqual({ ok: false, field: "timeZone" });
    expect((await stored()).timeZone).toBeUndefined();
    expect(await saveTimeZoneAction(RIYADH)).toEqual({ ok: true });
    const s = await stored();
    expect(s.timeZone).toBe(RIYADH);
    expect(s.defaultLocale).toBe("ar");
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: row.id, action: "settings.timezone", meta: { from: DEFAULT_TIME_ZONE, to: RIYADH } }));
  });
});
