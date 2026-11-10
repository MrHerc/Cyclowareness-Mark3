import { LAB_XP } from "@/lib/domain/gamification";
import { lessonsDone, type LabId } from "@/lib/domain/labs";
import type { LabArtifact, LabScenario } from "@/lib/content/lab-scenario";
import { BEACON_IP, BEACON_PID, BEACON_STARTUP, workstation } from "./machines";
import { exec, initialShell, type ShellState } from "./shell";

/**
 * The three virtual-machine labs as pure state machines. The browser keeps the learner's actions as a
 * list of events and folds them through `step`; the server replays the same list through `replay` to
 * score the run, so the checklist the learner sees and the result that is stored never disagree.
 */

export const VM_LAB_IDS = ["phishing-anatomy", "process-hunt", "fake-signin"] as const;
export type VmLabId = (typeof VM_LAB_IDS)[number];
export type AppId = "mail" | "browser" | "terminal" | "files";
/** One learner action: a type and an optional argument (an email id, a command line). */
export type LabEvent = readonly [type: string, arg?: string];

export type Objective = { id: string; points: number; secret?: boolean };
export type Rule = { id: string; penalty: number };

export type LabDef<S> = {
  /** A VmLabId, or a module's mini-lab id (miniLabId). */
  id: string;
  primary: AppId;
  objectives: readonly Objective[];
  rules: readonly Rule[];
  hints: number;
  init: () => S;
  apply: (s: S, e: LabEvent) => S;
  achieved: (s: S) => string[];
  broken: (s: S) => string[];
  done: (s: S) => boolean;
};

export const LAB_MAX = 100;
export const HINT_COST = 5;
export const MAX_EVENTS = 600;
export const MAX_ARG = 200;

/* ---------------- Lab 1: phishing anatomy (Mail) ---------------- */

export const PHISH_MAIL = "m-invoice";
export type PhishState = { sender: boolean; link: boolean; attachment: boolean; reported: boolean; openedAttachment: boolean; openedLink: boolean; falseReports: string[] };

export const phishingLab: LabDef<PhishState> = {
  id: "phishing-anatomy",
  primary: "mail",
  // The three red flags stay unnamed in the checklist until found, so the list does not give them away.
  objectives: [
    { id: "sender", points: 20, secret: true },
    { id: "link", points: 20, secret: true },
    { id: "attachment", points: 20, secret: true },
    { id: "report", points: 40 },
  ],
  rules: [
    { id: "noAttachment", penalty: 30 },
    { id: "noLink", penalty: 20 },
  ],
  hints: 3,
  init: () => ({ sender: false, link: false, attachment: false, reported: false, openedAttachment: false, openedLink: false, falseReports: [] }),
  apply: (s, [type, arg]) => {
    const phish = arg === PHISH_MAIL;
    switch (type) {
      case "headers":
      case "reply":
        return phish ? { ...s, sender: true } : s;
      case "peek":
        return phish ? { ...s, link: true } : s;
      case "attachInfo":
        return phish ? { ...s, attachment: true } : s;
      case "attachOpen":
        return phish ? { ...s, openedAttachment: true } : s;
      case "linkOpen":
        return phish ? { ...s, openedLink: true } : s;
      case "report":
        if (phish) return { ...s, reported: true };
        return arg && !s.falseReports.includes(arg) ? { ...s, falseReports: [...s.falseReports, arg].slice(0, 10) } : s;
      default:
        return s;
    }
  },
  achieved: (s) => [s.sender && "sender", s.link && "link", s.attachment && "attachment", s.reported && "report"].filter((v): v is string => !!v),
  broken: (s) => [s.openedAttachment && "noAttachment", s.openedLink && "noLink"].filter((v): v is string => !!v),
  done: (s) => s.reported,
};

/* ---------------- Lab 2: malicious process hunt (Terminal) ---------------- */

/** Same layout as the machine the Terminal app shows (only file texts and dates differ), so replays agree. */
const HUNT_MACHINE = workstation({ today: "2026-01-01", infected: true, text: { readme: "-", ticket: "-" } });
export type HuntState = { shell: ShellState; found: boolean; whois: boolean; legitKilled: number[]; legitRemoved: string[] };

export const huntLab: LabDef<HuntState> = {
  id: "process-hunt",
  primary: "terminal",
  objectives: [
    { id: "find", points: 20 },
    { id: "whois", points: 20 },
    { id: "kill", points: 30 },
    { id: "persist", points: 30 },
  ],
  rules: [
    { id: "keepProcesses", penalty: 15 },
    { id: "keepStartup", penalty: 15 },
  ],
  hints: 3,
  init: () => ({ shell: initialShell(HUNT_MACHINE), found: false, whois: false, legitKilled: [], legitRemoved: [] }),
  apply: (s, [type, arg]) => {
    if (type !== "cmd" || typeof arg !== "string") return s;
    const r = exec(HUNT_MACHINE, s.shell, arg);
    const next: HuntState = { ...s, shell: r.state };
    for (const e of r.effects) {
      if (e.kind === "netstat" && e.pids.includes(BEACON_PID)) next.found = true;
      if (e.kind === "whois" && e.ip === BEACON_IP) next.whois = true;
      if (e.kind === "kill" && HUNT_MACHINE.procs.find((p) => p.pid === e.pid)?.role === "legit") next.legitKilled = [...next.legitKilled, e.pid];
      if (e.kind === "remove" && HUNT_MACHINE.startup.find((x) => x.name === e.name)?.role === "legit") next.legitRemoved = [...next.legitRemoved, e.name];
    }
    return next;
  },
  achieved: (s) => [s.found && "find", s.whois && "whois", s.shell.killed.includes(BEACON_PID) && "kill", s.shell.removed.includes(BEACON_STARTUP) && "persist"].filter((v): v is string => !!v),
  broken: (s) => [s.legitKilled.length > 0 && "keepProcesses", s.legitRemoved.length > 0 && "keepStartup"].filter((v): v is string => !!v),
  done: (s) => s.found && s.whois && s.shell.killed.includes(BEACON_PID) && s.shell.removed.includes(BEACON_STARTUP),
};

/* ---------------- Lab 3: fake sign-in page (Browser) ---------------- */

export const SIGNIN_MAIL = "m-share";
export type SigninState = { url: boolean; cert: boolean; typedPassword: boolean; submitted: boolean; tabOpen: boolean; closed: boolean; reported: boolean };

export const signinLab: LabDef<SigninState> = {
  id: "fake-signin",
  primary: "browser",
  objectives: [
    { id: "url", points: 25 },
    { id: "cert", points: 25 },
    { id: "close", points: 20 },
    { id: "report", points: 30 },
  ],
  rules: [
    { id: "noPassword", penalty: 30 },
    { id: "noSubmit", penalty: 20 },
  ],
  hints: 3,
  init: () => ({ url: false, cert: false, typedPassword: false, submitted: false, tabOpen: true, closed: false, reported: false }),
  apply: (s, [type, arg]) => {
    switch (type) {
      case "inspectUrl":
        return { ...s, url: true };
      case "cert":
        return { ...s, cert: true };
      case "typePw":
        return { ...s, typedPassword: true };
      case "submit":
        return { ...s, submitted: true };
      case "closeTab":
        return { ...s, tabOpen: false, closed: true };
      case "openTab":
        return { ...s, tabOpen: true };
      case "report":
        return arg === "browser" || arg === SIGNIN_MAIL ? { ...s, reported: true } : s;
      default:
        return s;
    }
  },
  achieved: (s) => [s.url && "url", s.cert && "cert", s.closed && !s.tabOpen && "close", s.reported && "report"].filter((v): v is string => !!v),
  broken: (s) => [s.typedPassword && "noPassword", s.submitted && "noSubmit"].filter((v): v is string => !!v),
  done: (s) => s.closed && !s.tabOpen && s.reported,
};

/* ---------------- Mini-labs: a module's decisions (content/library/labs) ---------------- */

/** A mini-lab's id in lab_attempts and for completeVmLabAction: "mini:<module slug>". */
export const miniLabId = (slug: string) => `mini:${slug}`;
export const miniLabSlug = (lab: string) => (lab.startsWith("mini:") ? lab.slice(5) : null);

/** The app that shows an artifact; texts, calls and windows are shown in the decision card itself. */
export const ARTIFACT_APP: Record<LabArtifact["kind"], AppId> = { email: "mail", web: "browser", file: "files", sms: "mail", call: "mail", dialog: "mail" };

export type MiniState = { answers: Record<string, string>; finished: boolean };

/**
 * One objective per decision, reached when its safe option is chosen; the 100 points are shared out evenly. The
 * learner's event is ["choose", "<decision id>:<option id>"], and only the first answer to a decision counts. The run
 * ends on ["finish"] once every decision is answered, so the last explanation stays on screen until the learner moves on.
 */
export function miniLabDef(sc: LabScenario): LabDef<MiniState> {
  const n = sc.decisions.length;
  const base = Math.floor(LAB_MAX / n);
  const answeredAll = (s: MiniState) => sc.decisions.every((d) => Object.hasOwn(s.answers, d.id));
  return {
    id: miniLabId(sc.module),
    primary: ARTIFACT_APP[sc.decisions[0].artifact.kind],
    objectives: sc.decisions.map((d, i) => ({ id: d.id, points: base + (i < LAB_MAX - base * n ? 1 : 0) })),
    rules: [],
    hints: 0,
    init: () => ({ answers: {}, finished: false }),
    apply: (s, [type, arg]) => {
      if (type === "finish") return answeredAll(s) ? { ...s, finished: true } : s;
      if (type !== "choose" || !arg) return s;
      const [id, option] = arg.split(":");
      const d = sc.decisions.find((x) => x.id === id);
      if (!d || Object.hasOwn(s.answers, d.id) || !d.options.some((o) => o.id === option)) return s;
      return { ...s, answers: { ...s.answers, [d.id]: option } };
    },
    achieved: (s) => sc.decisions.filter((d) => s.answers[d.id] === d.safe).map((d) => d.id),
    broken: () => [],
    done: (s) => s.finished,
  };
}

/**
 * A module page's practice list: the module's own mini-lab first, then the labs that practise it, all open once the
 * module's lessons are done. Practice is optional: none of it counts toward completion or the attestation.
 * `mini` is the mini-lab in the language it is shown in (`lang`, set only when it is not the page's).
 */
export function modulePractice(slug: string, status: string | undefined, labs: readonly LabId[], mini: { title: string; lang: string; xp: number } | null, locale: string) {
  return {
    open: lessonsDone(status),
    items: [
      ...(mini ? [{ id: miniLabId(slug), href: `/lab/mini/${slug}`, lab: null, title: mini.title, lang: mini.lang === locale ? undefined : mini.lang, xp: mini.xp }] : []),
      ...labs.map((id) => ({ id, href: `/lab/${id}`, lab: id, title: null, lang: undefined, xp: LAB_XP[id] })),
    ],
  };
}

/* ---------------- Runs, scoring and the catalog ---------------- */

export type LabRun<S> = { s: S; hints: number; events: LabEvent[]; done: boolean };

export function startRun<S>(def: LabDef<S>): LabRun<S> {
  return { s: def.init(), hints: 0, events: [], done: false };
}

/** Applies one event. A finished run, a full log or a hint past the last one changes nothing. */
export function step<S>(def: LabDef<S>, run: LabRun<S>, e: LabEvent): LabRun<S> {
  if (run.done || run.events.length >= MAX_EVENTS) return run;
  const ev: LabEvent = e[1] === undefined ? [e[0]] : [e[0], e[1].slice(0, MAX_ARG)];
  if (ev[0] === "hint") return run.hints >= def.hints ? run : { ...run, hints: run.hints + 1, events: [...run.events, ev] };
  const s = def.apply(run.s, ev);
  return { s, hints: run.hints, events: [...run.events, ev], done: def.done(s) };
}

export function replay<S>(def: LabDef<S>, events: readonly LabEvent[]): LabRun<S> {
  return events.slice(0, MAX_EVENTS).reduce((run, e) => step(def, run, e), startRun(def));
}

export type LabScore = { score: number; max: number; achieved: string[]; broken: string[]; hintPoints: number; penalty: number };

/** Points for the objectives reached, minus the hints taken and the rules broken, kept within 0–100. */
export function scoreRun<S>(def: LabDef<S>, run: LabRun<S>): LabScore {
  const achieved = def.achieved(run.s);
  const broken = def.broken(run.s);
  const earned = def.objectives.filter((o) => achieved.includes(o.id)).reduce((a, o) => a + o.points, 0);
  const penalty = def.rules.filter((r) => broken.includes(r.id)).reduce((a, r) => a + r.penalty, 0);
  const hintPoints = run.hints * HINT_COST;
  return { score: Math.max(0, Math.min(LAB_MAX, earned - penalty - hintPoints)), max: LAB_MAX, achieved, broken, hintPoints, penalty };
}

/** Scores an event log for a lab, the way the server stores it. */
export function scoreEvents(id: VmLabId, events: readonly LabEvent[]): LabScore {
  switch (id) {
    case "phishing-anatomy":
      return scoreRun(phishingLab, replay(phishingLab, events));
    case "process-hunt":
      return scoreRun(huntLab, replay(huntLab, events));
    case "fake-signin":
      return scoreRun(signinLab, replay(signinLab, events));
  }
}

export const VM_LABS: Record<VmLabId, { primary: AppId; xp: number; objectives: number }> = {
  "phishing-anatomy": { primary: "mail", xp: LAB_XP["phishing-anatomy"], objectives: phishingLab.objectives.length },
  "process-hunt": { primary: "terminal", xp: LAB_XP["process-hunt"], objectives: huntLab.objectives.length },
  "fake-signin": { primary: "browser", xp: LAB_XP["fake-signin"], objectives: signinLab.objectives.length },
};

export function isVmLab(v: string): v is VmLabId {
  return Object.hasOwn(VM_LABS, v);
}
