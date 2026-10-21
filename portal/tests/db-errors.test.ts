import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation } from "../src/server/db/errors";

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
