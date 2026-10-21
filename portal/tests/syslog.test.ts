import { describe, expect, it } from "vitest";
import { cefEscape, formatSyslog } from "../src/server/jobs";

const delivered = new Date("2026-10-20T10:00:00.000Z");

describe("CEF escaping", () => {
  it("never lets a line break through, including a lone carriage return", () => {
    for (const v of ["first\rsecond", "first\nsecond", "first\r\nsecond"]) {
      const out = cefEscape(v);
      expect(out).not.toMatch(/[\r\n]/);
      expect(out).toBe("first\\nsecond");
    }
    expect(cefEscape("a=b\\c")).toBe("a\\=b\\\\c");
    expect(cefEscape("x|y\rz", true)).toBe("x\\|y z");
  });

  it("keeps a whole record on one line", () => {
    const line = formatSyslog("threat.reported", { tenantId: "t1", occurredAt: "2026-10-20T09:00:00.000Z", data: { context: "first\rsecond", note: "a\nb" } }, "cef", delivered);
    expect(line).not.toMatch(/[\r\n]/);
  });
});

describe("syslog timestamps", () => {
  it("stamps the event time, not the delivery time, and records the delivery separately", () => {
    const line = formatSyslog("phishing.clicked", { tenantId: "t1", occurredAt: "2026-10-20T09:00:00.000Z", data: {} }, "cef", delivered);
    expect(line).toContain(" 2026-10-20T09:00:00.000Z ");
    expect(line).toContain(`rt=${Date.parse("2026-10-20T09:00:00.000Z")}`);
    expect(line).toContain("cs2Label=deliveredAt cs2=2026-10-20T10:00:00.000Z");
  });

  it("falls back to the delivery time when the event time is missing or invalid", () => {
    expect(formatSyslog("x", { data: {} }, "json", delivered)).toContain(" 2026-10-20T10:00:00.000Z ");
    expect(formatSyslog("x", { occurredAt: "not a date", data: {} }, "cef", delivered)).toContain(`rt=${delivered.getTime()}`);
  });
});
