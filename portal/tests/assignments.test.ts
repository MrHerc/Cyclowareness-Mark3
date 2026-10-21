import { describe, expect, it } from "vitest";
import { assignedSince, coveringAssignments, departmentClosure, gainsCoverage, targetsOf, type UserLite } from "@/server/services/assignments";

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

describe("assignedSince (start of the reminder clock)", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  const assignment = (scope: "everyone" | "department" | "user") => ({ scope, createdAt: day(10) });
  const person = (p: Partial<UserLite>): UserLite => ({ id: "p", departmentId: "finance", createdAt: day(1), ...p });

  it("is the assignment date for someone who was already there", () => {
    expect(assignedSince(assignment("everyone"), person({}))).toEqual(day(10));
  });

  it("is the join date for someone added after the assignment", () => {
    expect(assignedSince(assignment("everyone"), person({ createdAt: day(15) }))).toEqual(day(15));
  });

  it("is the activation date for an invitation accepted later, for every scope", () => {
    for (const scope of ["everyone", "department", "user"] as const) expect(assignedSince(assignment(scope), person({ activatedAt: day(20) }))).toEqual(day(20));
    // An activation before the assignment changes nothing.
    expect(assignedSince(assignment("everyone"), person({ activatedAt: day(5) }))).toEqual(day(10));
  });

  it("is the department change for a department assignment only", () => {
    const moved = person({ departmentChangedAt: day(25) });
    expect(assignedSince(assignment("department"), moved)).toEqual(day(25));
    // Moving between departments does not restart an organisation-wide or personal assignment.
    expect(assignedSince(assignment("everyone"), moved)).toEqual(day(10));
    expect(assignedSince(assignment("user"), moved)).toEqual(day(10));
    // A move before the assignment changes nothing.
    expect(assignedSince(assignment("department"), person({ departmentChangedAt: day(3) }))).toEqual(day(10));
  });

  it("takes the latest of all dates", () => {
    expect(assignedSince(assignment("department"), person({ createdAt: day(12), activatedAt: day(30), departmentChangedAt: day(22) }))).toEqual(day(30));
    expect(assignedSince(assignment("department"), person({ createdAt: day(12), activatedAt: day(18), departmentChangedAt: day(22) }))).toEqual(day(22));
  });
});

describe("coveringAssignments / gainsCoverage (when a department change moves the department date)", () => {
  const tree = departmentClosure([
    { id: "finance", parentId: null },
    { id: "payroll", parentId: "finance" },
    { id: "audit", parentId: "finance" },
    { id: "it", parentId: null },
  ]);
  const onFinance = [{ id: "a1", scope: "department" as const, departmentId: "finance" }];
  const cover = (d: string | null, list = onFinance, closure = tree) => coveringAssignments(list, closure, d);

  it("does not count a move between sub-departments of the assigning department", () => {
    expect(gainsCoverage(cover("payroll"), cover("audit"))).toBe(false);
    expect(gainsCoverage(cover("payroll"), cover("finance"))).toBe(false);
    expect(gainsCoverage(cover("payroll"), cover(null))).toBe(false);
  });

  it("counts a move under a department assignment that did not cover the person", () => {
    expect(gainsCoverage(cover("it"), cover("payroll"))).toBe(true);
    expect(gainsCoverage(cover(null), cover("finance"))).toBe(true);
    // A sub-department's own assignment covers only it.
    const withAudit = [...onFinance, { id: "a2", scope: "department" as const, departmentId: "audit" }];
    expect(gainsCoverage(cover("payroll", withAudit), cover("audit", withAudit))).toBe(true);
  });

  it("counts re-parenting only when the new parent brings an assignment", () => {
    const moved = departmentClosure([
      { id: "finance", parentId: null },
      { id: "payroll", parentId: "finance" },
      { id: "audit", parentId: "finance" },
      { id: "it", parentId: "finance" },
    ]);
    expect(gainsCoverage(cover("it"), cover("it", onFinance, moved))).toBe(true);
    expect(gainsCoverage(cover("it", [{ id: "a3", scope: "department", departmentId: "it" }]), cover("it", [{ id: "a3", scope: "department", departmentId: "it" }], moved))).toBe(false);
  });
});
