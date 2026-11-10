import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { labScenarioErrors, labScenarioSchema, miniLabXp, type LabScenario } from "../src/lib/content/lab-scenario";
import { ARTIFACT_APP, miniLabDef, miniLabId, miniLabSlug, modulePractice, replay, scoreRun, type LabEvent } from "../src/components/lab/model/labs";
import { lessonsDone } from "../src/lib/domain/labs";
import { localeParityErrors } from "../src/lib/content/locale-parity";

const state = vi.hoisted(() => ({ features: new Set(["lab"]), catalog: ["phishing-email", "quishing"], attempts: [] as { exercise: string; score: number; max: number; fullXp: number }[] }));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("../src/server/db", () => ({ db: () => ({}) }));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => ({ tenant: { id: "t1", features: state.features }, user: { id: "u1" } }), allowed: () => false }));
vi.mock("../src/server/queries/catalog", () => ({ getCatalog: async () => state.catalog.map((slug) => ({ slug })) }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));
vi.mock("../src/server/lab/attempts", () => ({
  recordLabAttempt: async (_db: unknown, p: { exercise: string; score: number; max: number; fullXp: number }) => {
    state.attempts.push(p);
    return Math.round((p.fullXp * p.score) / p.max);
  },
}));

const { completeVmLabAction } = await import("../src/server/lab/vm-action");
const { labScenario } = await import("../src/server/lab/scenarios");

const root = path.join(__dirname, "..", "content", "library");
const modules = JSON.parse(readFileSync(path.join(root, "modules.json"), "utf8")) as { slug: string }[];

const fixture: LabScenario = {
  formatVersion: 1,
  module: "fixture",
  title: "Fixture in practice",
  intro: "Three moments.",
  decisions: [
    {
      id: "mail",
      title: "Invoice",
      prompt: "What do you do with this e-mail?",
      artifact: { kind: "email", from: { name: "Billing", address: "billing@pay.example" }, subject: "Invoice", time: "09:00", body: ["Pay today.", "Thanks"], link: { text: "Pay", href: "https://pay-now.example/x", after: 0 } },
      options: [
        { id: "report", label: "Report" },
        { id: "pay", label: "Pay" },
      ],
      safe: "report",
      explain: "A strange domain and a rush.",
      risk: "money",
    },
    { id: "text", title: "Courier", prompt: "And this?", artifact: { kind: "sms", name: "Courier", time: "10:00", body: ["Pay 1 AZN"] }, options: [{ id: "spam", label: "Spam" }, { id: "open", label: "Open" }], safe: "spam", explain: "Small fee, big theft.", risk: "money" },
    { id: "box", title: "Update", prompt: "And this?", artifact: { kind: "dialog", title: "Update ready", body: ["Restart now?"] }, options: [{ id: "update", label: "Update" }, { id: "call", label: "Call the number" }], safe: "update", explain: "A real update is calm.", risk: "malware" },
  ],
};
const choose = (d: string, o: string): LabEvent => ["choose", `${d}:${o}`];

describe("mini-lab scenarios on disk", () => {
  const english = readdirSync(path.join(root, "labs")).filter((f) => f.endsWith(".en.json"));

  it("has one English mini-lab for each of the 53 modules", () => {
    expect(english.sort()).toEqual(modules.map((m) => `${m.slug}.en.json`).sort());
    expect(english).toHaveLength(53);
  });

  for (const m of modules) {
    it(`${m.slug} is a valid mini-lab built for its module`, () => {
      const raw = JSON.parse(readFileSync(path.join(root, "labs", `${m.slug}.en.json`), "utf8"));
      expect(Object.keys(raw)[0]).toBe("formatVersion");
      const parsed = labScenarioSchema.parse(raw);
      // The schema drops unknown keys, so every key the file uses must be in it.
      expect(parsed).toEqual(raw);
      expect(parsed.module).toBe(m.slug);
      expect(labScenarioErrors(parsed)).toEqual([]);
      expect(miniLabXp(parsed)).toBeGreaterThanOrEqual(10);
      expect(miniLabXp(parsed)).toBeLessThanOrEqual(15);
      // A translation that copies the file passes the lessons' parity rules, so the same checker covers it.
      expect(localeParityErrors(raw, structuredClone(raw))).toEqual([]);
      // A decision about the recipient shows the recipient.
      for (const d of parsed.decisions) if (/recipient/i.test(d.prompt) && d.artifact.kind === "email") expect(d.artifact.to, d.id).toBeTruthy();
    });
  }

  it("is listed for every module of the catalog, in the learner's language or in English", () => {
    for (const m of modules) expect(labScenario(m.slug, "az")).toMatchObject({ lang: "en", scenario: { module: m.slug } });
    expect(labScenario("phishing-email")?.lang).toBe("en");
    expect(labScenario("no-such-module")).toBeNull();
    expect(labScenario("../modules")).toBeNull();
    expect(labScenario("phishing-email", "../x")).toBeNull();
  });
});

describe("mini-lab scenario schema", () => {
  it("accepts the fixture and refuses broken files", () => {
    expect(labScenarioErrors(labScenarioSchema.parse(fixture))).toEqual([]);
    expect(labScenarioSchema.safeParse({ ...fixture, decisions: fixture.decisions.slice(0, 2) }).success).toBe(false);
    expect(labScenarioSchema.safeParse({ ...fixture, decisions: [{ ...fixture.decisions[0], risk: "boredom" }, ...fixture.decisions.slice(1)] }).success).toBe(false);
    expect(labScenarioSchema.safeParse({ ...fixture, decisions: [{ ...fixture.decisions[0], options: [{ id: "only", label: "Only" }] }, ...fixture.decisions.slice(1)] }).success).toBe(false);
    const broken = structuredClone(fixture);
    broken.decisions[0].safe = "ignore";
    broken.decisions[1].id = "mail";
    const a = broken.decisions[0].artifact;
    if (a.kind === "email" && a.link) a.link.after = 5;
    expect(labScenarioErrors(broken)).toEqual(["duplicate decision id", "mail: safe option ignore missing", "mail: link after a missing paragraph"]);
  });

  it("refuses a web page with nothing on it and two decisions with the same title, and takes a recipient", () => {
    const page = { kind: "web", title: "tapan.example", url: "https://tapan.example/axtar", body: [] };
    expect(labScenarioSchema.safeParse({ ...fixture, decisions: [{ ...fixture.decisions[0], artifact: page }, ...fixture.decisions.slice(1)] }).success).toBe(false);
    expect(labScenarioSchema.safeParse({ ...fixture, decisions: [{ ...fixture.decisions[0], artifact: { ...page, body: ["Sponsored: pay-now.example"] } }, ...fixture.decisions.slice(1)] }).success).toBe(true);
    const same = structuredClone(fixture);
    same.decisions[2].title = same.decisions[1].title;
    expect(labScenarioErrors(same)).toEqual(["duplicate decision title"]);
    const draft = labScenarioSchema.parse({ ...fixture, decisions: [{ ...fixture.decisions[0], artifact: { ...fixture.decisions[0].artifact, to: "Leyla <leyla@poct.example>" } }, ...fixture.decisions.slice(1)] });
    expect(draft.decisions[0].artifact).toMatchObject({ to: "Leyla <leyla@poct.example>" });
  });

  it("prices a mini-lab at 10 to 15 XP by its number of decisions", () => {
    const withN = (n: number) => ({ ...fixture, decisions: Array.from({ length: n }, (_, i) => ({ ...fixture.decisions[0], id: `d${i}` })) });
    expect([3, 4, 5].map((n) => miniLabXp(withN(n)))).toEqual([10, 13, 15]);
  });
});

describe("mini-lab runs", () => {
  const def = miniLabDef(fixture);

  it("shares 100 points over the decisions and opens the first artifact's app", () => {
    expect(def.objectives.map((o) => o.points)).toEqual([34, 33, 33]);
    expect(def.id).toBe("mini:fixture");
    expect(def.primary).toBe("mail");
    expect(ARTIFACT_APP.web).toBe("browser");
    expect(miniLabSlug(miniLabId("quishing"))).toBe("quishing");
    expect(miniLabSlug("phishing-anatomy")).toBeNull();
  });

  it("scores the safe choices and finishes on the learner's finish once every decision is answered", () => {
    const run = replay(def, [choose("mail", "report"), choose("text", "open"), ["finish"]]);
    expect(run.done).toBe(false);
    const all = replay(def, [choose("mail", "report"), choose("text", "open"), choose("box", "update")]);
    // The last explanation stays on screen until the learner asks for the results.
    expect(all.done).toBe(false);
    expect(scoreRun(def, all)).toMatchObject({ score: 67, max: 100, achieved: ["mail", "box"], broken: [] });
    expect(replay(def, [...all.events, ["finish"]]).done).toBe(true);
  });

  it("keeps the first answer and ignores unknown decisions, options and events", () => {
    const run = replay(def, [choose("mail", "pay"), choose("mail", "report"), choose("ghost", "report"), choose("text", "nope"), ["hint"], ["report", "mail"], ["choose"]]);
    expect(run.s.answers).toEqual({ mail: "pay" });
    expect(scoreRun(def, run).score).toBe(0);
  });
});

describe("mini-lab result on the server", () => {
  beforeEach(() => {
    state.features = new Set(["lab"]);
    state.catalog = ["phishing-email", "quishing"];
    state.attempts = [];
  });

  it("replays the chosen options against the English scenario and stores the run", async () => {
    const sc = labScenario("phishing-email")!.scenario;
    const [first, ...rest] = sc.decisions;
    const wrong = first.options.find((o) => o.id !== first.safe)!.id;
    const log = [choose(first.id, wrong), ...rest.map((d) => choose(d.id, d.safe))];
    const expected = 100 - miniLabDef(sc).objectives[0].points;
    expect(await completeVmLabAction("mini:phishing-email", log)).toEqual({ score: expected, max: 100, xp: Math.round((miniLabXp(sc) * expected) / 100) });
    expect(state.attempts).toEqual([expect.objectContaining({ exercise: "mini:phishing-email", score: expected, max: 100, fullXp: miniLabXp(sc) })]);
  });

  it("refuses an unknown mini-lab, a path in the id, a tenant without labs and a malformed log", async () => {
    expect(await completeVmLabAction("mini:no-such-module", [])).toEqual({ error: "forbidden" });
    expect(await completeVmLabAction("mini:../modules", [])).toEqual({ error: "forbidden" });
    expect(await completeVmLabAction(42 as unknown as string, [])).toEqual({ error: "forbidden" });
    expect(await completeVmLabAction("mini:quishing", [["choose", 7]])).toEqual({ error: "invalid" });
    state.features = new Set();
    expect(await completeVmLabAction("mini:quishing", [])).toEqual({ error: "forbidden" });
    expect(state.attempts).toEqual([]);
  });

  it("refuses the mini-lab of a module outside the viewer's catalog", async () => {
    state.catalog = ["quishing"];
    expect(await completeVmLabAction("mini:phishing-email", [])).toEqual({ error: "forbidden" });
    expect(state.attempts).toEqual([]);
  });
});

describe("mini-lab on the module page", () => {
  it("opens once the module's lessons are done; completion and attestation do not wait for it", () => {
    expect(["not_started", "in_progress", undefined].map(lessonsDone)).toEqual([false, false, false]);
    expect(["awaiting_attestation", "completed"].map(lessonsDone)).toEqual([true, true]);
  });

  it("lists the mini-lab first, then the labs that practise the module, locked until the lessons are done", () => {
    const sc = labScenario("phishing-email", "az")!;
    const mini = { title: sc.scenario.title, lang: sc.lang, xp: miniLabXp(sc.scenario) };
    const locked = modulePractice("phishing-email", "in_progress", ["inbox-triage", "phishing-anatomy"], mini, "az");
    expect(locked.open).toBe(false);
    expect(locked.items).toEqual([
      { id: "mini:phishing-email", href: "/lab/mini/phishing-email", lab: null, title: sc.scenario.title, lang: "en", xp: miniLabXp(sc.scenario) },
      { id: "inbox-triage", href: "/lab/inbox-triage", lab: "inbox-triage", title: null, lang: undefined, xp: 20 },
      { id: "phishing-anatomy", href: "/lab/phishing-anatomy", lab: "phishing-anatomy", title: null, lang: undefined, xp: 30 },
    ]);
    expect(modulePractice("phishing-email", "awaiting_attestation", [], mini, "az").open).toBe(true);
    // Shown in the page's language, the title needs no lang of its own; a module without a mini-lab lists only its labs.
    expect(modulePractice("phishing-email", "completed", [], { ...mini, lang: "en" }, "en").items[0].lang).toBeUndefined();
    expect(modulePractice("quishing", "completed", [], null, "en")).toEqual({ open: true, items: [] });
  });
});
