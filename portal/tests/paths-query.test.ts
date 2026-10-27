import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import type { Viewer } from "../src/server/auth/viewer";

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
const state = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "http://localhost:3000" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(), getLocale: async () => "en" }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => state.viewer, allowed: () => true, hasFeature: () => true }));

const { getPaths } = await import("../src/server/queries/paths");
const { savePathAction } = await import("../src/server/actions/secops");
const { syncPaths } = await import("../src/server/services/library");

const text = (en: string) => ({ en });
let acme = "";
let rauf = "";
let konul = "";

const viewerOf = (userId: string, features: string[]) =>
  ({ user: { id: userId, role: "tenant_admin" }, tenant: { id: acme, features: new Set(features), settings: { defaultLocale: "en" } } }) as unknown as Viewer;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [a, g] = await db
    .insert(t.tenants)
    .values([
      { slug: "acme", name: "Acme", branding: {} as never, settings: {} as never },
      { slug: "globex", name: "Globex", branding: {} as never, settings: {} as never },
    ])
    .returning();
  acme = a.id;
  [{ id: rauf }, { id: konul }] = await db
    .insert(t.users)
    .values([
      { tenantId: acme, email: "rauf@acme.test", name: "Rauf", locale: "en" },
      { tenantId: acme, email: "konul@acme.test", name: "Konul", locale: "en" },
    ])
    .returning();
  const mod = { category: "phishing", audiences: [], title: text("M"), subtitle: text(""), minutes: 5, xp: 10, difficulty: "Easy" as const };
  const [phishing, passwords] = await db
    .insert(t.modules)
    .values([
      { ...mod, slug: "phishing-email" },
      { ...mod, slug: "passwords-mfa" },
    ])
    .returning();
  await db.insert(t.lessons).values([phishing, passwords].map((m) => ({ moduleId: m.id, key: "l1", title: text("L"), minutes: 5, position: 1 })));
  const path_ = { description: text(""), audience: text(""), recurrence: text(""), standards: [] };
  const [core, , globexOwn] = await db
    .insert(t.learningPaths)
    .values([
      // A lab id the code no longer knows is left out.
      { ...path_, key: "core", title: text("Core"), moduleSlugs: ["phishing-email", "passwords-mfa"], labIds: ["inbox-triage", "password-forge", "mfa-fatigue", "retired-lab"] },
      { ...path_, key: "acme-own", tenantId: acme, mandatory: true, title: text("Acme"), moduleSlugs: ["passwords-mfa"] },
      { ...path_, key: "globex-own", tenantId: g.id, title: text("Globex"), moduleSlugs: ["passwords-mfa"] },
    ])
    .returning();
  await db.insert(t.assignments).values([
    { tenantId: acme, pathId: core.id, scope: "user", userId: rauf, dueKind: "fixed", dueDate: "2026-12-01" },
    { tenantId: g.id, pathId: globexOwn.id, scope: "everyone" },
  ]);
  // Rauf passed inbox-triage (best 8/10) before finishing phishing-email; a row with max 0 has no share.
  await db.insert(t.labAttempts).values([
    { tenantId: acme, userId: rauf, exercise: "inbox-triage", score: 3, max: 10, xp: 0 },
    { tenantId: acme, userId: rauf, exercise: "inbox-triage", score: 8, max: 10, xp: 0 },
    { tenantId: acme, userId: rauf, exercise: "mfa-fatigue", score: 5, max: 10, xp: 0 },
    { tenantId: acme, userId: rauf, exercise: "password-forge", score: 4, max: 0, xp: 0 },
  ]);
  await db.insert(t.moduleProgress).values({ userId: konul, moduleId: phishing.id, status: "awaiting_attestation", percent: 100 });
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("getPaths", () => {
  it("lists the library's and the organisation's own paths, assigned ones first, with the person's own due day", async () => {
    const forRauf = await getPaths(viewerOf(rauf, ["paths", "lab"]), "en");
    expect(forRauf.map((p) => [p.key, p.assigned, p.due])).toEqual([
      ["core", true, "2026-12-01"],
      ["acme-own", false, null],
    ]);
    // Another person of the same organisation: not assigned, so the mandatory path leads.
    const forKonul = await getPaths(viewerOf(konul, ["paths", "lab"]), "en");
    expect(forKonul.map((p) => [p.key, p.assigned, p.due])).toEqual([
      ["acme-own", false, null],
      ["core", false, null],
    ]);
  });

  it("gives each lab the person's best share, and opens a lab once it is passed or its lessons are done", async () => {
    const core = (await getPaths(viewerOf(rauf, ["paths", "lab"]), "en")).find((p) => p.key === "core")!;
    expect(core.labs).toEqual([
      { id: "inbox-triage", best: 0.8, passed: true, unlocked: true, after: [] },
      { id: "password-forge", best: null, passed: false, unlocked: false, after: ["passwords-mfa"] },
      { id: "mfa-fatigue", best: 0.5, passed: false, unlocked: false, after: ["passwords-mfa"] },
    ]);
    const forKonul = (await getPaths(viewerOf(konul, ["paths", "lab"]), "en")).find((p) => p.key === "core")!;
    expect(forKonul.labs.map((l) => [l.id, l.best, l.unlocked])).toEqual([
      ["inbox-triage", null, true],
      ["password-forge", null, false],
      ["mfa-fatigue", null, false],
    ]);
  });

  it("has no labs without the lab feature", async () => {
    for (const p of await getPaths(viewerOf(rauf, ["paths"]), "en")) expect(p.labs, p.key).toEqual([]);
  });
});

describe("savePathAction labs", () => {
  const input = { id: null, title: "Phishing drill", description: "", audience: "", recurrence: "", standards: "", mandatory: false, moduleSlugs: ["phishing-email"] };

  it("refuses an unknown lab and stores each known one once", async () => {
    state.viewer = viewerOf(rauf, ["paths"]);
    expect(await savePathAction({ ...input, labIds: ["inbox-triage", "no-such-lab"] as never })).toEqual({ ok: false, error: "invalid" });
    const saved = await savePathAction({ ...input, labIds: ["mfa-fatigue", "inbox-triage", "mfa-fatigue"] });
    expect(saved.ok).toBe(true);
    const rows = await db.select().from(t.learningPaths).where(eq(t.learningPaths.tenantId, acme));
    expect(rows.filter((r) => r.title.en === "Phishing drill").map((r) => r.labIds)).toEqual([["mfa-fatigue", "inbox-triage"]]);
  });
});

describe("syncPaths", () => {
  it("refuses a library path that names an unknown lab, before writing anything", async () => {
    const real = fs.readFileSync;
    const shipped = JSON.parse(real(path.join(__dirname, "..", "content", "library", "paths.json"), "utf8")) as { labs?: string[] }[];
    const read = vi.spyOn(fs, "readFileSync").mockImplementation(((file: fs.PathOrFileDescriptor, options?: never) =>
      String(file).endsWith("paths.json") ? JSON.stringify([{ ...shipped[0], labs: ["inbox-triage", "no-such-lab"] }]) : real(file, options)) as typeof fs.readFileSync);
    const untouched = new Proxy({}, { get: () => () => { throw new Error("database used"); } }) as DB;
    try {
      await expect(syncPaths(untouched)).rejects.toThrow(/unknown labs: no-such-lab/);
    } finally {
      read.mockRestore();
    }
  });
});
