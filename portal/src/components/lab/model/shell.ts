/**
 * A tiny deterministic shell for the virtual-machine labs. Pure functions only: the Terminal app calls
 * `exec` for the output it prints, and the server replays the same command lines through `exec` to score
 * the lab, so both always agree on what the learner did.
 */

export type FsFile = { kind: "file"; content: string; binary?: boolean };
export type FsDir = { kind: "dir"; children: Record<string, FsNode> };
export type FsNode = FsFile | FsDir;

export type ProcRole = "system" | "legit" | "shell" | "malicious";
export type Proc = { pid: number; user: string; cpu: string; mem: string; start: string; cmd: string; role: ProcRole };
/** `owner` ties a connection without a PID column (TIME_WAIT) to the process that made it. */
export type Conn = { proto: "tcp" | "udp"; local: string; foreign: string; state: string; pid: number | null; owner?: number };
export type StartupEntry = { name: string; command: string; role: "legit" | "malicious" };

export type Machine = {
  user: string;
  host: string;
  home: string;
  fs: FsDir;
  procs: Proc[];
  conns: Conn[];
  startup: StartupEntry[];
  whois: Record<string, string[]>;
};

export type ShellState = { cwd: string; killed: number[]; removed: string[]; history: string[] };
export type OutTone = "err" | "ok" | "dim" | "head";
export type OutLine = { text: string; tone?: OutTone };
export type Effect =
  | { kind: "netstat"; pids: number[] }
  | { kind: "whois"; ip: string }
  | { kind: "kill"; pid: number }
  | { kind: "remove"; name: string }
  | { kind: "cat"; path: string };
export type ExecResult = { state: ShellState; out: OutLine[]; clear?: boolean; effects: Effect[] };

/** Words the shell shows in the learner's language; real bash errors and tool output stay the shell's own English. */
export type ShellText = {
  helpTitle: string;
  help: Record<CommandName, string>;
  unknownHint: string;
  shellKill: string;
  startupEmpty: string;
  startupNoEntry: (name: string) => string;
  startupRemoved: (name: string) => string;
  binaryFile: (file: string) => string;
  privateIp: (ip: string) => string;
};

export const COMMANDS = ["help", "ls", "cd", "pwd", "cat", "ps", "netstat", "whois", "kill", "startup", "history", "clear", "whoami"] as const;
export type CommandName = (typeof COMMANDS)[number];

export const ENGLISH_SHELL: ShellText = {
  helpTitle: "Available commands:",
  help: {
    help: "show this list",
    ls: "list files (ls -a shows hidden ones)",
    cd: "change folder",
    pwd: "show the current folder",
    cat: "print a file",
    ps: "list running processes",
    netstat: "list network connections (netstat -an shows all)",
    whois: "look up who owns an IP address",
    kill: "stop a process by its PID",
    startup: "list or remove programs that start at login",
    history: "show the commands you typed",
    clear: "clear the screen",
    whoami: "show the current user",
  },
  unknownHint: "Type help to see the available commands.",
  shellKill: "that is this terminal; the lab keeps it open",
  startupEmpty: "No programs start at login.",
  startupNoEntry: (name) => `startup: no entry named '${name}'`,
  startupRemoved: (name) => `Removed startup entry '${name}'.`,
  binaryFile: (file) => `cat: ${file}: binary file (ELF 64-bit executable), not shown`,
  privateIp: (ip) => `% ${ip} is a private-use address (RFC 1918): your own network, not the internet.`,
};

const MAX_LINE = 200;
const MAX_HISTORY = 200;

export function initialShell(machine: Machine): ShellState {
  return { cwd: machine.home, killed: [], removed: [], history: [] };
}

/** The prompt path: the home folder shows as ~. */
export function displayPath(machine: Machine, path: string): string {
  if (path === machine.home) return "~";
  return path.startsWith(`${machine.home}/`) ? `~${path.slice(machine.home.length)}` : path;
}

export function prompt(machine: Machine, state: ShellState): string {
  return `${machine.user}@${machine.host}:${displayPath(machine, state.cwd)}$`;
}

/** Absolute, normalised path of `p` seen from `cwd`; ~ is the home folder. */
export function resolvePath(machine: Machine, cwd: string, p: string): string {
  let raw = p;
  if (raw === "~" || raw.startsWith("~/")) raw = machine.home + raw.slice(1);
  const parts = (raw.startsWith("/") ? raw : `${cwd}/${raw}`).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

export function nodeAt(fs: FsDir, path: string): FsNode | null {
  let node: FsNode = fs;
  for (const part of path.split("/").filter(Boolean)) {
    if (node.kind !== "dir" || !Object.hasOwn(node.children, part)) return null;
    node = node.children[part];
  }
  return node;
}

const alive = (machine: Machine, state: ShellState) => machine.procs.filter((p) => !state.killed.includes(p.pid));
const pad = (s: string, n: number) => (s.length >= n ? `${s} ` : s + " ".repeat(n - s.length));
const progName = (p: Proc | undefined) => (p ? (p.cmd.split(" ")[0].split("/").pop() ?? p.cmd) : "-");
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const isPrivate = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

function ls(machine: Machine, state: ShellState, args: string[]): OutLine[] {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const all = flags.includes("a");
  const long = flags.includes("l");
  const targets = args.filter((a) => !a.startsWith("-"));
  const out: OutLine[] = [];
  for (const target of targets.length ? targets : ["."]) {
    const path = resolvePath(machine, state.cwd, target);
    const node = nodeAt(machine.fs, path);
    if (!node) {
      out.push({ text: `ls: cannot access '${target}': No such file or directory`, tone: "err" });
      continue;
    }
    if (targets.length > 1) out.push({ text: `${target}:`, tone: "head" });
    if (node.kind === "file") {
      out.push({ text: target });
      continue;
    }
    const names = Object.keys(node.children)
      .filter((n) => all || !n.startsWith("."))
      .sort((a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, "")));
    const label = (n: string) => (node.children[n].kind === "dir" ? `${n}/` : n);
    if (long) {
      for (const n of names) {
        const child = node.children[n];
        const size = child.kind === "dir" ? 4096 : child.binary ? 48_312 : child.content.length;
        out.push({ text: `${child.kind === "dir" ? "drwxr-xr-x" : child.binary ? "-rwxr-xr-x" : "-rw-r--r--"}  ${pad(machine.user, 8)} ${String(size).padStart(6)}  ${label(n)}` });
      }
    } else if (names.length) out.push({ text: names.map(label).join("  ") });
  }
  return out;
}

function ps(machine: Machine, state: ShellState): OutLine[] {
  return [
    { text: `${pad("USER", 9)}${pad("PID", 7)}${pad("%CPU", 6)}${pad("%MEM", 6)}${pad("START", 7)}COMMAND`, tone: "head" },
    ...alive(machine, state).map((p) => ({ text: `${pad(p.user, 9)}${pad(String(p.pid), 7)}${pad(p.cpu, 6)}${pad(p.mem, 6)}${pad(p.start, 7)}${p.cmd}` })),
  ];
}

function netstat(machine: Machine, state: ShellState, args: string[]): { out: OutLine[]; pids: number[] } {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const all = flags.includes("a");
  const procs = alive(machine, state);
  const rows = machine.conns.filter((c) => {
    const who = c.pid ?? c.owner;
    if (who !== undefined && who !== null && state.killed.includes(who)) return false;
    return all || (c.state !== "LISTEN" && c.proto === "tcp");
  });
  const out: OutLine[] = [
    { text: all ? "Active Internet connections (servers and established)" : "Active Internet connections (w/o servers)" },
    { text: `${pad("Proto", 7)}${pad("Local Address", 22)}${pad("Foreign Address", 22)}${pad("State", 13)}PID/Program`, tone: "head" },
  ];
  for (const c of rows) {
    const p = c.pid === null ? undefined : procs.find((x) => x.pid === c.pid);
    out.push({ text: `${pad(c.proto, 7)}${pad(c.local, 22)}${pad(c.foreign, 22)}${pad(c.state, 13)}${c.pid === null ? "-" : `${c.pid}/${progName(p)}`}` });
  }
  return { out, pids: [...new Set(rows.map((r) => r.pid).filter((p): p is number => p !== null))] };
}

function startup(machine: Machine, state: ShellState, args: string[], text: ShellText): { out: OutLine[]; removed?: string } {
  const [sub = "list", name] = args;
  const entries = machine.startup.filter((e) => !state.removed.includes(e.name));
  if (sub === "list") {
    if (!entries.length) return { out: [{ text: text.startupEmpty, tone: "dim" }] };
    return { out: [{ text: `${pad("NAME", 14)}COMMAND`, tone: "head" }, ...entries.map((e) => ({ text: `${pad(e.name, 14)}${e.command}` }))] };
  }
  if (sub === "remove") {
    if (!name) return { out: [{ text: "usage: startup remove <name>", tone: "err" }] };
    if (!entries.some((e) => e.name === name)) return { out: [{ text: text.startupNoEntry(name), tone: "err" }] };
    return { out: [{ text: text.startupRemoved(name), tone: "ok" }], removed: name };
  }
  return { out: [{ text: "usage: startup [list | remove <name>]", tone: "err" }] };
}

/** Runs one command line. Unknown commands, bad paths and bad PIDs answer like bash and change nothing. */
export function exec(machine: Machine, state: ShellState, rawLine: string, text: ShellText = ENGLISH_SHELL): ExecResult {
  const line = rawLine.trim().slice(0, MAX_LINE);
  if (!line) return { state, out: [], effects: [] };
  const history = [...state.history, line].slice(-MAX_HISTORY);
  let next: ShellState = { ...state, history };
  const [cmd, ...args] = line.split(/\s+/);
  const effects: Effect[] = [];
  let out: OutLine[] = [];
  switch (cmd) {
    case "help":
      out = [{ text: text.helpTitle, tone: "head" }, ...COMMANDS.map((c) => ({ text: `  ${pad(c, 10)}${text.help[c]}` }))];
      break;
    case "ls":
      out = ls(machine, next, args);
      break;
    case "cd": {
      const target = args[0] ?? "~";
      const path = resolvePath(machine, next.cwd, target);
      const node = nodeAt(machine.fs, path);
      if (!node) out = [{ text: `bash: cd: ${target}: No such file or directory`, tone: "err" }];
      else if (node.kind !== "dir") out = [{ text: `bash: cd: ${target}: Not a directory`, tone: "err" }];
      else next = { ...next, cwd: path };
      break;
    }
    case "pwd":
      out = [{ text: next.cwd }];
      break;
    case "whoami":
      out = [{ text: machine.user }];
      break;
    case "cat":
      if (!args.length) out = [{ text: "usage: cat <file>", tone: "err" }];
      for (const a of args) {
        const path = resolvePath(machine, next.cwd, a);
        const node = nodeAt(machine.fs, path);
        if (!node) out.push({ text: `cat: ${a}: No such file or directory`, tone: "err" });
        else if (node.kind === "dir") out.push({ text: `cat: ${a}: Is a directory`, tone: "err" });
        else if (node.binary) out.push({ text: text.binaryFile(a), tone: "dim" });
        else {
          out.push(...node.content.split("\n").map((t) => ({ text: t })));
          effects.push({ kind: "cat", path });
        }
      }
      break;
    case "ps":
      out = ps(machine, next);
      break;
    case "netstat": {
      const r = netstat(machine, next, args);
      out = r.out;
      effects.push({ kind: "netstat", pids: r.pids });
      break;
    }
    case "whois": {
      const ip = args[0];
      if (!ip) out = [{ text: "usage: whois <ip>", tone: "err" }];
      else if (!IPV4.test(ip)) out = [{ text: `whois: '${ip}' is not an IPv4 address`, tone: "err" }];
      else {
        if (isPrivate(ip)) out = [{ text: text.privateIp(ip) }];
        else out = (machine.whois[ip] ?? [`No match for "${ip}".`]).map((t) => ({ text: t }));
        effects.push({ kind: "whois", ip });
      }
      break;
    }
    case "kill": {
      const pids = args.filter((a) => !/^-(\d+|KILL|TERM|9|15)$/.test(a));
      if (!pids.length) out = [{ text: "kill: usage: kill [-9] <pid> ...", tone: "err" }];
      for (const a of pids) {
        if (!/^\d{1,7}$/.test(a)) {
          out.push({ text: `bash: kill: ${a}: arguments must be process or job IDs`, tone: "err" });
          continue;
        }
        const pid = Number(a);
        const p = alive(machine, next).find((x) => x.pid === pid);
        if (!p) out.push({ text: `bash: kill: (${pid}) - No such process`, tone: "err" });
        else if (p.user !== machine.user) out.push({ text: `bash: kill: (${pid}) - Operation not permitted`, tone: "err" });
        else if (p.role === "shell") out.push({ text: `bash: kill: (${pid}) - ${text.shellKill}`, tone: "dim" });
        else {
          next = { ...next, killed: [...next.killed, pid] };
          effects.push({ kind: "kill", pid });
        }
      }
      break;
    }
    case "startup": {
      const r = startup(machine, next, args, text);
      out = r.out;
      if (r.removed) {
        next = { ...next, removed: [...next.removed, r.removed] };
        effects.push({ kind: "remove", name: r.removed });
      }
      break;
    }
    case "history":
      out = history.map((h, i) => ({ text: `${String(i + 1).padStart(5)}  ${h}` }));
      break;
    case "clear":
      return { state: next, out: [], clear: true, effects };
    default:
      out = [
        { text: `bash: ${cmd}: command not found`, tone: "err" },
        { text: text.unknownHint, tone: "dim" },
      ];
  }
  return { state: next, out, effects };
}

function commonPrefix(words: string[]): string {
  if (!words.length) return "";
  let p = words[0];
  for (const w of words) while (!w.startsWith(p)) p = p.slice(0, -1);
  return p;
}

function pathCandidates(machine: Machine, state: ShellState, token: string): string[] {
  const slash = token.lastIndexOf("/");
  const dirPart = slash >= 0 ? token.slice(0, slash + 1) : "";
  const base = slash >= 0 ? token.slice(slash + 1) : token;
  const dir = nodeAt(machine.fs, resolvePath(machine, state.cwd, dirPart || "."));
  if (!dir || dir.kind !== "dir") return [];
  return Object.keys(dir.children)
    .filter((n) => n.startsWith(base) && (base.startsWith(".") || !n.startsWith(".")))
    .sort()
    .map((n) => dirPart + n + (dir.children[n].kind === "dir" ? "/" : ""));
}

/**
 * Tab completion: the command name, then paths (ls, cat, cd), PIDs (kill), known IPs (whois) and startup
 * entries. One candidate completes the word; several extend it to their common prefix and are listed.
 */
export function complete(machine: Machine, state: ShellState, line: string): { line: string; options: string[] } {
  const words = line.split(" ");
  const token = words[words.length - 1];
  const head = words.slice(0, -1);
  let candidates: string[];
  if (head.filter(Boolean).length === 0) candidates = COMMANDS.filter((c) => c.startsWith(token));
  else {
    const cmd = head.find(Boolean) ?? "";
    const args = head.filter(Boolean).slice(1);
    if (cmd === "ls" || cmd === "cat" || cmd === "cd") candidates = pathCandidates(machine, state, token);
    else if (cmd === "kill") candidates = alive(machine, state).map((p) => String(p.pid)).filter((p) => p.startsWith(token));
    else if (cmd === "whois") candidates = [...new Set([...machine.conns.map((c) => c.foreign.split(":")[0]).filter((ip) => ip !== "0.0.0.0" && !isPrivate(ip)), ...Object.keys(machine.whois)])].filter((ip) => ip.startsWith(token)).sort();
    else if (cmd === "startup" && args.length === 0) candidates = ["list", "remove"].filter((s) => s.startsWith(token));
    else if (cmd === "startup" && args[0] === "remove" && args.length === 1) candidates = machine.startup.filter((e) => !state.removed.includes(e.name)).map((e) => e.name).filter((n) => n.startsWith(token));
    else candidates = [];
  }
  if (!candidates.length) return { line, options: [] };
  const prefix = candidates.length === 1 ? candidates[0] + (candidates[0].endsWith("/") ? "" : " ") : commonPrefix(candidates);
  const nextLine = [...head, prefix].join(" ");
  return { line: nextLine.length >= line.length ? nextLine : line, options: candidates.length > 1 ? candidates : [] };
}
