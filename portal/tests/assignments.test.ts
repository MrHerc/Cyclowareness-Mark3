import { describe, expect, it } from "vitest";
import { departmentClosure, targetsOf, type UserLite } from "@/server/services/assignments";

const departments = [
  { id: "finance", parentId: null },
  { id: "payroll", parentId: "finance" },
  { id: "it", parentId: null },
];
const at = new Date("2026-01-01T00:00:00Z");
const users: UserLite[] = [
  { id: "aysel", departmentId: "finance", createdAt: at },
  { id: "rauf", departmentId: "payroll", createdAt: at },
  { id: "leyla", departmentId: "it", createdAt: at },
  { id: "nigar", departmentId: null, createdAt: at },
];
const closure = departmentClosure(departments);

const ids = (list: UserLite[]) => list.map((u) => u.id).sort();

describe("departmentClosure", () => {
  it("includes every sub-department and the department itself", () => {
    expect([...closure.get("finance")!].sort()).toEqual(["finance", "payroll"]);
    expect([...closure.get("payroll")!]).toEqual(["payroll"]);
    expect([...closure.get("it")!]).toEqual(["it"]);
  });
});

describe("targetsOf", () => {
  const everyone = { scope: "everyone" as const, departmentId: null, userId: null };
  const finance = { scope: "department" as const, departmentId: "finance", userId: null };
  const onlyLeyla = { scope: "user" as const, departmentId: null, userId: "leyla" };

  it("targets the whole organisation, a department tree or one person", () => {
    expect(ids(targetsOf(everyone, users, closure))).toEqual(["aysel", "leyla", "nigar", "rauf"]);
    expect(ids(targetsOf(finance, users, closure))).toEqual(["aysel", "rauf"]);
    expect(ids(targetsOf(onlyLeyla, users, closure))).toEqual(["leyla"]);
  });

  it("reports the full audience of each of two overlapping assignments for the same module", () => {
    // "Everyone: Phishing emails" followed by "Finance: Phishing emails (due date)": the second
    // row must still read "x of 2 completed", not "0 of 0".
    const perAssignment = new Map([everyone, finance].map((a, i) => [`a${i + 1}`, new Set(targetsOf(a, users, closure).map((u) => u.id))]));
    expect(perAssignment.get("a1")?.size).toBe(4);
    expect([...perAssignment.get("a2")!].sort()).toEqual(["aysel", "rauf"]);
  });

  it("ignores a department assignment whose department has no people and a missing department", () => {
    expect(targetsOf({ scope: "department", departmentId: "legal", userId: null }, users, closure)).toEqual([]);
    expect(targetsOf({ scope: "department", departmentId: null, userId: null }, users, closure)).toEqual([]);
  });
});
