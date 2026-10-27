import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAB_IDS, LAB_MODULES, isLabId, labUnlocked, labWaitsFor, labsForModule, labPassed } from "@/lib/domain/labs";
import { LAB_XP } from "@/lib/domain/gamification";
import { departmentClosure, pathsAssignedTo, type UserLite } from "@/server/services/assignments";
import { orderPaths } from "@/server/queries/paths";

const lib = path.join(process.cwd(), "content", "library");
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(lib, file), "utf8"));
const paths = read<{ key: string; modules: string[]; labs?: string[] }[]>("paths.json");
const slugs = new Set(read<{ slug: string }[]>("modules.json").map((m) => m.slug));

describe("paths.json", () => {
  it("references existing modules and labs only", () => {
    for (const p of paths) {
      expect(p.modules.filter((s) => !slugs.has(s)), p.key).toEqual([]);
      expect((p.labs ?? []).filter((id) => !isLabId(id)), p.key).toEqual([]);
      expect(new Set(p.labs).size, `${p.key} repeats a lab`).toBe((p.labs ?? []).length);
    }
  });

  it("gives every path practice labs", () => {
    for (const p of paths) expect(p.labs?.length, p.key).toBeGreaterThan(0);
  });
});

describe("lab registry", () => {
  it("lists every lab that earns XP, each practising existing modules", () => {
    expect([...LAB_IDS].sort()).toEqual(Object.keys(LAB_XP).sort());
    for (const id of LAB_IDS) expect(LAB_MODULES[id].filter((s) => !slugs.has(s)), id).toEqual([]);
  });

  it("finds the labs of a module", () => {
    expect(labsForModule("phishing-email")).toEqual(["inbox-triage", "phishing-anatomy"]);
    expect(labsForModule("no-such-module")).toEqual([]);
  });

  it("passes from 70% of the maximum", () => {
    expect(labPassed(null)).toBe(false);
    expect(labPassed(0.69)).toBe(false);
    expect(labPassed(0.7)).toBe(true);
  });
});

describe("labUnlocked", () => {
  const path = ["phishing-email", "passwords-mfa", "safe-browsing"];

  it("waits for the lab's own modules that are in the path", () => {
    const status = new Map([["phishing-email", "in_progress"], ["passwords-mfa", "completed"]]);
    expect(labUnlocked("inbox-triage", path, status)).toBe(false);
    expect(labWaitsFor("inbox-triage", path, status)).toEqual(["phishing-email"]);
    // password-forge practises passwords-mfa (done) and password-managers-work (not in this path).
    expect(labUnlocked("password-forge", path, status)).toBe(true);
  });

  it("counts lessons awaiting their confirmation as done", () => {
    expect(labUnlocked("inbox-triage", path, new Map([["phishing-email", "awaiting_attestation"]]))).toBe(true);
  });

  it("waits for the whole path when none of the lab's modules is in it", () => {
    const status = new Map([["phishing-email", "completed"], ["passwords-mfa", "completed"]]);
    expect(labWaitsFor("process-hunt", path, status)).toEqual(["safe-browsing"]);
    expect(labUnlocked("process-hunt", path, new Map(path.map((s) => [s, "completed"])))).toBe(true);
  });
});

describe("pathsAssignedTo", () => {
  const closure = departmentClosure([
    { id: "finance", parentId: null },
    { id: "payroll", parentId: "finance" },
    { id: "it", parentId: null },
  ]);
  const at = new Date("2026-01-01T00:00:00Z");
  const rauf: UserLite = { id: "rauf", departmentId: "payroll", createdAt: at };
  const none = { userId: null, departmentId: null, dueKind: "none" as const, dueDate: null, dueDays: null };

  it("keeps only the paths whose assignments target the person, with the earliest due day", () => {
    const assigned = pathsAssignedTo(
      [
        { ...none, scope: "department", departmentId: "finance", pathId: "bec", dueKind: "fixed", dueDate: "2026-03-01" },
        { ...none, scope: "user", userId: "rauf", pathId: "bec", dueKind: "fixed", dueDate: "2026-02-01" },
        { ...none, scope: "department", departmentId: "it", pathId: "technical" },
        { ...none, scope: "user", userId: "konul", pathId: "new-hire" },
        { ...none, scope: "everyone", pathId: "core" },
        { ...none, scope: "everyone", pathId: null },
      ],
      rauf,
      closure,
    );
    expect(Object.fromEntries(assigned)).toEqual({ bec: "2026-02-01", core: null });
  });
});

describe("orderPaths", () => {
  it("puts the viewer's assigned paths first, then mandatory ones, then the rest, oldest first", () => {
    const p = (id: string, mandatory: boolean, day: number) => ({ id, key: id, mandatory, createdAt: new Date(2026, 0, day) });
    const list = [p("leaders", false, 1), p("core", true, 2), p("technical", false, 3), p("new-hire", true, 1), p("finance", false, 1)];
    expect(orderPaths(list, new Set(["technical"])).map((x) => x.id)).toEqual(["technical", "new-hire", "core", "finance", "leaders"]);
  });
});
