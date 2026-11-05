import { describe, expect, it, vi } from "vitest";
import { isForeignKeyViolation, isUniqueViolation, logFailure } from "../src/server/db/errors";
import { formatLog } from "../src/server/log";

describe("isUniqueViolation", () => {
  const pg = Object.assign(new Error('duplicate key value violates unique constraint "threat_reports_number_idx"'), { code: "23505", constraint: "threat_reports_number_idx" });
  it("recognises the driver error directly and wrapped by drizzle", () => {
    expect(isUniqueViolation(pg)).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error("Failed query: insert ..."), { cause: pg }))).toBe(true);
  });
  it("matches a named index by constraint or message", () => {
    expect(isUniqueViolation(pg, "threat_reports_number_idx")).toBe(true);
    expect(isUniqueViolation({ code: "23505", message: 'duplicate key value violates unique constraint "users_phone_active_idx"' }, "users_phone_active_idx")).toBe(true);
    expect(isUniqueViolation(pg, "certificates_serial_unique")).toBe(false);
  });
  it("ignores other errors", () => {
    expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error("fk"), { code: "23503" }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  const fk = Object.assign(new Error('update or delete on table "modules" violates foreign key constraint "attestations_module_id_modules_id_fk"'), { code: "23503", constraint: "attestations_module_id_modules_id_fk" });
  it("recognises the driver error directly and wrapped by drizzle", () => {
    expect(isForeignKeyViolation(fk)).toBe(true);
    expect(isForeignKeyViolation(Object.assign(new Error("Failed query: delete ..."), { cause: fk }))).toBe(true);
    expect(isForeignKeyViolation(fk, "attestations_module_id_modules_id_fk")).toBe(true);
    expect(isForeignKeyViolation(fk, "certificates_module_id_modules_id_fk")).toBe(false);
  });
  it("ignores other errors", () => {
    expect(isForeignKeyViolation(Object.assign(new Error("dup"), { code: "23505" }))).toBe(false);
    expect(isForeignKeyViolation(new Error("connection refused"))).toBe(false);
  });
});

describe("logFailure", () => {
  it("logs the name, the driver code and the frames, never the failed query or its parameters", () => {
    const pg = Object.assign(new Error("duplicate key"), { code: "23505" });
    const wrapped = Object.assign(new Error("Failed query: insert into outbox values ($1)\nparams: https://x.test/account/reset/SECRET"), { name: "DrizzleQueryError", cause: pg });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    logFailure("[test] failed", wrapped, { tenantId: "t1" });
    vi.unstubAllEnvs();
    const calls = [...log.mock.calls];
    log.mockRestore();
    expect(calls).toHaveLength(1);
    const line = JSON.parse(String(calls[0][0]));
    expect(line).toMatchObject({ level: "error", msg: "[test] failed", tenantId: "t1", error: "DrizzleQueryError", code: "23505" });
    expect(line.at).toMatch(/^at /);
    expect(JSON.stringify(calls)).not.toMatch(/SECRET|params|Failed query/);
  });
});

describe("formatLog", () => {
  const now = new Date("2026-11-05T10:00:00.000Z");

  it("writes one JSON object per event in production", () => {
    const line = formatLog("warn", "[jobs] mail failed", { tenantId: "t1", userId: undefined, attempts: 2 }, false, now);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({ ts: "2026-11-05T10:00:00.000Z", level: "warn", msg: "[jobs] mail failed", tenantId: "t1", attempts: 2 });
  });

  it("keeps the line readable in development and leaves out empty fields", () => {
    expect(formatLog("info", "[bootstrap] ready", { tenantId: "t1", userId: undefined, n: 3 }, true, now)).toBe("2026-11-05T10:00:00.000Z INFO [bootstrap] ready tenantId=t1 n=3");
  });
});
