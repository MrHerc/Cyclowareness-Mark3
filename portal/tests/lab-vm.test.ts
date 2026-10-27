import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAB_XP } from "@/lib/domain/gamification";
import { LOCALES } from "@/i18n/config";
import { BEACON_IP, BEACON_PID, workstation } from "@/components/lab/model/machines";
import { HINT_COST, MAX_EVENTS, PHISH_MAIL, SIGNIN_MAIL, VM_LAB_IDS, VM_LABS, huntLab, isVmLab, phishingLab, replay, scoreEvents, scoreRun, signinLab, step, startRun, type LabEvent } from "@/components/lab/model/labs";
import { complete, exec, initialShell, prompt, resolvePath, type ShellState } from "@/components/lab/model/shell";
import { clampWindow, initialWm, wmReducer } from "@/components/lab/model/wm";

const m = workstation({ today: "2026-10-21", infected: true, text: { readme: "readme", ticket: "ticket text" } });
const clean = workstation({ today: "2026-10-21", infected: false, text: { readme: "readme" } });

/** Runs several lines and returns the final state and the output of the last one. */
function sh(lines: string[], machine = m) {
  let s: ShellState = initialShell(machine);
  let last = exec(machine, s, "");
  for (const l of lines) {
    last = exec(machine, s, l);
    s = last.state;
  }
  return { s, out: last.out.map((o) => o.text), last };
}

describe("lab shell: commands", () => {
  it("prints help with every command and answers unknown commands like bash", () => {
    const help = sh(["help"]).out.join("\n");
    for (const c of ["ls", "cat", "ps", "netstat", "whois", "kill", "startup", "history", "clear"]) expect(help).toContain(`  ${c}`);
    const r = sh(["rm -rf /"]);
    expect(r.out[0]).toBe("bash: rm: command not found");
    expect(r.last.out[0].tone).toBe("err");
  });

  it("lists files, hides dot files unless -a, and resolves ~, .. and absolute paths", () => {
    expect(sh(["ls"]).out[0]).not.toContain(".cache");
    expect(sh(["ls -a"]).out[0]).toContain(".cache/");
    expect(sh(["ls -la ~/.cache/.sysupd"]).out.join("\n")).toContain("sysupd.conf");
    expect(sh(["ls /nope"]).out[0]).toContain("No such file or directory");
    expect(resolvePath(m, "/home/analyst/notes", "../Documents/./x")).toBe("/home/analyst/Documents/x");
  });

  it("changes folder, shows it in the prompt and refuses files and missing paths", () => {
    const r = sh(["cd notes", "pwd"]);
    expect(r.out).toEqual(["/home/analyst/notes"]);
    expect(prompt(m, r.s)).toBe("analyst@ws-114:~/notes$");
    expect(sh(["cd .bashrc"]).out[0]).toContain("Not a directory");
    expect(sh(["cd nowhere"]).out[0]).toContain("No such file or directory");
    expect(sh(["cd notes", "cd"]).s.cwd).toBe("/home/analyst");
  });

  it("prints text files, refuses folders and does not dump programs", () => {
    expect(sh(["cat notes/ticket-SEC-2291.txt"]).out).toEqual(["ticket text"]);
    expect(sh(["cat .cache/.sysupd/sysupd.conf"]).out[0]).toBe(`beacon = ${BEACON_IP}:8443`);
    expect(sh(["cat notes"]).out[0]).toContain("Is a directory");
    expect(sh(["cat .cache/.sysupd/sysupd"]).out[0]).toContain("binary file");
    expect(sh(["cat"]).out[0]).toContain("usage");
  });

  it("lists processes and the connections with their PIDs; a killed process disappears from both", () => {
    expect(sh(["ps"]).out.join("\n")).toContain(".sysupd/sysupd --silent");
    const before = sh(["netstat -an"]);
    expect(before.out.join("\n")).toMatch(new RegExp(`${BEACON_IP.replaceAll(".", "\\.")}:8443\\s+ESTABLISHED\\s+${BEACON_PID}/sysupd`));
    expect(before.out.join("\n")).toContain("LISTEN");
    expect(before.last.effects).toContainEqual({ kind: "netstat", pids: expect.arrayContaining([BEACON_PID]) });
    expect(sh(["netstat"]).out.join("\n")).not.toContain("LISTEN");
    const after = sh([`kill ${BEACON_PID}`, "netstat -an"]);
    expect(after.out.join("\n")).not.toContain(BEACON_IP);
    expect(sh([`kill -9 ${BEACON_PID}`, "ps"]).out.join("\n")).not.toContain("sysupd");
  });

  it("guards kill: root processes, the shell itself, missing PIDs and bad arguments", () => {
    expect(sh(["kill 1"]).out[0]).toBe("bash: kill: (1) - Operation not permitted");
    expect(sh(["kill 2290"]).s.killed).toEqual([]);
    expect(sh(["kill 99999"]).out[0]).toBe("bash: kill: (99999) - No such process");
    expect(sh(["kill abc"]).out[0]).toContain("arguments must be process or job IDs");
    expect(sh(["kill"]).out[0]).toContain("usage");
    expect(sh([`kill ${BEACON_PID}`, `kill ${BEACON_PID}`]).out[0]).toContain("No such process");
  });

  it("looks up IPs with whois: known owners, unknown, private and invalid addresses", () => {
    const r = sh([`whois ${BEACON_IP}`]);
    expect(r.out.join("\n")).toContain("KESTREL-VPS-NET");
    expect(r.out.join("\n")).toContain("created:        2026-10-18");
    expect(r.last.effects).toEqual([{ kind: "whois", ip: BEACON_IP }]);
    expect(sh(["whois 198.51.100.10"]).out.join("\n")).toContain("Nimbus Cloud Services");
    expect(sh(["whois 198.51.100.99"]).out[0]).toBe('No match for "198.51.100.99".');
    expect(sh(["whois 10.20.0.5"]).out[0]).toContain("private-use");
    expect(sh(["whois 999.1.1.1"]).out[0]).toContain("not an IPv4 address");
  });

  it("lists and removes startup entries", () => {
    expect(sh(["startup"]).out.join("\n")).toContain("sysupd");
    const r = sh(["startup remove sysupd", "startup list"]);
    expect(r.s.removed).toEqual(["sysupd"]);
    expect(r.out.join("\n")).not.toContain("sysupd");
    expect(sh(["startup remove ghost"]).out[0]).toContain("no entry named 'ghost'");
    expect(sh(["startup remove"]).out[0]).toContain("usage");
    expect(sh(["startup wipe"]).out[0]).toContain("usage");
  });

  it("keeps history, clears the screen and caps a line at 200 characters", () => {
    const r = sh(["ls", "ps", "history"]);
    expect(r.out).toEqual(["    1  ls", "    2  ps", "    3  history"]);
    expect(sh(["clear"]).last.clear).toBe(true);
    expect(sh([`ls ${"a".repeat(400)}`]).s.history[0]).toHaveLength(200);
    expect(sh(["   "]).s.history).toEqual([]);
  });

  it("the clean machine has no unwanted process, connection or startup entry", () => {
    expect(sh(["ps"], clean).out.join("\n")).not.toContain("sysupd");
    expect(sh(["netstat -an"], clean).out.join("\n")).not.toContain(BEACON_IP);
    expect(sh(["startup list"], clean).out.join("\n")).not.toContain("sysupd");
  });
});

describe("lab shell: tab completion", () => {
  const s = initialShell(m);
  it("completes commands, paths, PIDs, IPs and startup entries", () => {
    expect(complete(m, s, "net").line).toBe("netstat ");
    expect(complete(m, s, "cat no").line).toBe("cat notes/");
    expect(complete(m, s, "cat notes/t").line).toBe("cat notes/ticket-SEC-2291.txt ");
    expect(complete(m, s, "ls .ca").line).toBe("ls .cache/");
    expect(complete(m, s, "kill 42").line).toBe(`kill ${BEACON_PID} `);
    expect(complete(m, s, "whois 203").line).toBe(`whois ${BEACON_IP} `);
    expect(complete(m, s, "startup re").line).toBe("startup remove ");
    expect(complete(m, s, "startup remove sy").line).toBe("startup remove sysupd ");
  });

  it("lists the options when several match and leaves unknown words alone", () => {
    const r = complete(m, s, "c");
    expect(r.options).toEqual(["cd", "cat", "clear"]);
    expect(r.line).toBe("c");
    expect(complete(m, s, "h").options).toEqual(["help", "history"]);
    expect(complete(m, s, "zzz").line).toBe("zzz");
    expect(complete(m, s, "ls D").options).toEqual(["Desktop/", "Documents/", "Downloads/"]);
  });
});

const run = <S>(def: Parameters<typeof replay<S>>[0], events: LabEvent[]) => {
  const r = replay(def, events);
  return { r, score: scoreRun(def, r) };
};

describe("phishing anatomy lab", () => {
  it("scores the three red flags and the report, and finishes on the report", () => {
    const { r, score } = run(phishingLab, [
      ["headers", PHISH_MAIL],
      ["peek", PHISH_MAIL],
      ["attachInfo", PHISH_MAIL],
      ["report", PHISH_MAIL],
    ]);
    expect(r.done).toBe(true);
    expect(score.score).toBe(100);
    expect(score.achieved).toEqual(["sender", "link", "attachment", "report"]);
  });

  it("counts clues only on the phishing email and records a genuine email reported", () => {
    const { r, score } = run(phishingLab, [
      ["headers", "m-hr"],
      ["peek", "m-ops"],
      ["report", "m-it"],
      ["report", "m-it"],
    ]);
    expect(score.achieved).toEqual([]);
    expect(r.s.falseReports).toEqual(["m-it"]);
    expect(r.done).toBe(false);
  });

  it("the Reply preview also reveals the forged sender", () => {
    expect(run(phishingLab, [["reply", PHISH_MAIL]]).score.achieved).toEqual(["sender"]);
  });

  it("opening the attachment and following the link break the rules", () => {
    const { score } = run(phishingLab, [
      ["attachOpen", PHISH_MAIL],
      ["linkOpen", PHISH_MAIL],
      ["report", PHISH_MAIL],
    ]);
    expect(score.broken).toEqual(["noAttachment", "noLink"]);
    expect(score.score).toBe(0);
  });

  it("ignores everything after the lab is done", () => {
    const { r } = run(phishingLab, [
      ["report", PHISH_MAIL],
      ["attachOpen", PHISH_MAIL],
    ]);
    expect(r.s.openedAttachment).toBe(false);
    expect(r.events).toHaveLength(1);
  });
});

describe("process hunt lab", () => {
  const solve: LabEvent[] = [
    ["cmd", "netstat -an"],
    ["cmd", `whois ${BEACON_IP}`],
    ["cmd", `kill ${BEACON_PID}`],
    ["cmd", "startup remove sysupd"],
  ];

  it("ticks each step from the shell's effects and finishes when all four are done", () => {
    const steps = solve.map((_, i) => run(huntLab, solve.slice(0, i + 1)).score.achieved);
    expect(steps).toEqual([["find"], ["find", "whois"], ["find", "whois", "kill"], ["find", "whois", "kill", "persist"]]);
    const { r, score } = run(huntLab, solve);
    expect(r.done).toBe(true);
    expect(score.score).toBe(100);
  });

  it("does not count the beacon as found once it is killed, nor whois of another IP", () => {
    const { score } = run(huntLab, [
      ["cmd", `kill ${BEACON_PID}`],
      ["cmd", "netstat -an"],
      ["cmd", "whois 198.51.100.10"],
    ]);
    expect(score.achieved).toEqual(["kill"]);
  });

  it("penalises stopping or removing approved software", () => {
    const { score } = run(huntLab, [...solve.slice(0, 3), ["cmd", "kill 901"], ["cmd", "startup remove nimbus-sync"], solve[3]]);
    expect(score.broken).toEqual(["keepProcesses", "keepStartup"]);
    expect(score.score).toBe(70);
  });

  it("charges hints and stops at the last one", () => {
    const { r, score } = run(huntLab, [["hint"], ["hint"], ["hint"], ["hint"], ...solve]);
    expect(r.hints).toBe(3);
    expect(score.score).toBe(100 - 3 * HINT_COST);
  });

  it("follows cd between commands, so relative paths resolve as in the terminal", () => {
    const r = replay(huntLab, [
      ["cmd", "cd .cache"],
      ["cmd", "cd .sysupd"],
    ]);
    expect(r.s.shell.cwd).toBe("/home/analyst/.cache/.sysupd");
  });
});

describe("fake sign-in lab", () => {
  it("needs the tab closed and the page reported to finish", () => {
    expect(run(signinLab, [["inspectUrl"], ["cert"], ["report", "browser"]]).r.done).toBe(false);
    const { r, score } = run(signinLab, [["inspectUrl"], ["cert"], ["report", "browser"], ["closeTab"]]);
    expect(r.done).toBe(true);
    expect(score.score).toBe(100);
  });

  it("accepts the report from the email too, but not from another email", () => {
    expect(run(signinLab, [["report", SIGNIN_MAIL]]).score.achieved).toEqual(["report"]);
    expect(run(signinLab, [["report", "m-it"]]).score.achieved).toEqual([]);
  });

  it("a reopened tab is no longer closed", () => {
    expect(run(signinLab, [["closeTab"], ["openTab"]]).score.achieved).toEqual([]);
  });

  it("typing a password and pressing Sign in are risky actions", () => {
    const { score } = run(signinLab, [["typePw"], ["submit"], ["inspectUrl"], ["cert"], ["report", "browser"], ["closeTab"]]);
    expect(score.broken).toEqual(["noPassword", "noSubmit"]);
    expect(score.score).toBe(50);
  });
});

describe("lab runs and the catalog", () => {
  it("never scores below zero and ignores unknown events", () => {
    expect(scoreEvents("phishing-anatomy", [["attachOpen", PHISH_MAIL], ["linkOpen", PHISH_MAIL], ["hint"], ["bogus", "x"]]).score).toBe(0);
    expect(scoreEvents("process-hunt", [["cmd"]]).score).toBe(0);
  });

  it("caps the event log and the argument length", () => {
    const many: LabEvent[] = Array.from({ length: MAX_EVENTS + 50 }, () => ["cmd", "ls"]);
    expect(replay(huntLab, many).events).toHaveLength(MAX_EVENTS);
    const r = step(huntLab, startRun(huntLab), ["cmd", "x".repeat(1000)]);
    expect(r.events[0][1]).toHaveLength(200);
  });

  it("prices the labs from LAB_XP and only accepts its own ids", () => {
    for (const id of VM_LAB_IDS) expect(VM_LABS[id].xp).toBe(LAB_XP[id]);
    expect(isVmLab("process-hunt")).toBe(true);
    for (const v of ["inbox-triage", "constructor", "__proto__", "toString", ""]) expect(isVmLab(v)).toBe(false);
  });
});

describe("window manager", () => {
  it("opens, focuses and stacks windows", () => {
    let s = initialWm("mail");
    expect(s.focus).toBe("mail");
    s = wmReducer(s, { type: "open", app: "terminal" });
    expect(s.focus).toBe("terminal");
    expect(s.wins.terminal.z).toBeGreaterThan(s.wins.mail.z);
    s = wmReducer(s, { type: "focus", app: "mail" });
    expect(s.wins.mail.z).toBeGreaterThan(s.wins.terminal.z);
    expect(wmReducer(s, { type: "focus", app: "files" })).toBe(s);
  });

  it("minimise and close hand focus to the next window; the taskbar toggles", () => {
    let s = wmReducer(initialWm("mail"), { type: "open", app: "browser" });
    s = wmReducer(s, { type: "minimise", app: "browser" });
    expect(s.focus).toBe("mail");
    s = wmReducer(s, { type: "taskbar", app: "browser" });
    expect(s.focus).toBe("browser");
    expect(s.wins.browser.min).toBe(false);
    s = wmReducer(s, { type: "taskbar", app: "browser" });
    expect(s.wins.browser.min).toBe(true);
    s = wmReducer(s, { type: "close", app: "mail" });
    expect(s.focus).toBeNull();
    expect(s.wins.mail.open).toBe(false);
  });

  it("maximises, moves and shows the desktop", () => {
    let s = wmReducer(initialWm("files"), { type: "toggleMax", app: "files" });
    expect(s.wins.files.max).toBe(true);
    s = wmReducer(s, { type: "move", app: "files", x: 40.6, y: 12.2 });
    expect([s.wins.files.x, s.wins.files.y]).toEqual([41, 12]);
    expect(wmReducer(s, { type: "move", app: "mail", x: 1, y: 1 })).toBe(s);
    s = wmReducer(s, { type: "home" });
    expect(s.focus).toBeNull();
    expect(s.wins.files.min).toBe(true);
  });

  it("keeps the title bar on the desktop", () => {
    expect(clampWindow(-2000, -50, 600, 800, 500)).toEqual({ x: -504, y: 0 });
    expect(clampWindow(5000, 5000, 600, 800, 500)).toEqual({ x: 704, y: 460 });
  });
});

describe("lab texts", () => {
  const load = (l: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", l, "learner.json"), "utf8")).lab;
  it("has every objective, rule, hint and mail text the labs look up, in every interface language", () => {
    for (const locale of LOCALES) {
      const lab = load(locale);
      for (const def of [phishingLab, huntLab, signinLab]) {
        const t = lab.vm.labs[def.id];
        expect(lab.games[def.id].title, `${locale} ${def.id}`).toBeTruthy();
        for (const o of def.objectives) {
          expect(t.objectives[o.id], `${locale} ${def.id} objective ${o.id}`).toBeTruthy();
          expect(t.why[o.id], `${locale} ${def.id} why ${o.id}`).toBeTruthy();
        }
        for (const r of def.rules) {
          expect(t.rules[r.id], `${locale} ${def.id} rule ${r.id}`).toBeTruthy();
          expect(t.ruleWhy[r.id], `${locale} ${def.id} ruleWhy ${r.id}`).toBeTruthy();
        }
        for (let i = 1; i <= def.hints; i++) expect(t.hints[`h${i}`], `${locale} ${def.id} hint ${i}`).toBeTruthy();
      }
      const mail = (id: string, k: string, keys: string[]) => keys.forEach((key) => expect(lab.vm.labs[id].mail[k][key], `${locale} ${id} ${k}.${key}`).toBeTruthy());
      for (const k of ["invoice", "ops", "hr", "it"]) mail("phishing-anatomy", k, ["from", "subject", "preview", "p1", "p2"]);
      mail("phishing-anatomy", "invoice", ["p3"]);
      mail("process-hunt", "soc", ["from", "subject", "preview", "p1", "p2", "p3"]);
      mail("process-hunt", "news", ["from", "subject", "preview", "p1", "p2"]);
      mail("fake-signin", "share", ["from", "subject", "preview", "p1", "p2", "link"]);
      mail("fake-signin", "it", ["from", "subject", "preview", "p1", "p2"]);
    }
  });
});
