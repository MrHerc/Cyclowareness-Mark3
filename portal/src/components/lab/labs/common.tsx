"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, Globe, Mail, SquareTerminal, ShieldCheck } from "lucide-react";
import type { AppId, VmLabId } from "../model/labs";
import { COMMANDS, exec, initialShell, type Machine, type ShellState, type ShellText } from "../model/shell";
import type { LabTexts } from "../vm/runner";

export const APP_ICON: Record<AppId, { icon: React.ReactNode; tile: string }> = {
  mail: { icon: <Mail />, tile: "bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white" },
  browser: { icon: <Globe />, tile: "bg-gradient-to-br from-[#14b8a6] to-[#0f766e] text-white" },
  terminal: { icon: <SquareTerminal />, tile: "bg-gradient-to-br from-[#334155] to-[#0f172a] text-white" },
  files: { icon: <FolderOpen />, tile: "bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white" },
};

export const ANALYST = "analyst@lumenfreight.example";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An RFC 5322 date for a raw header (always English, like real headers), from a Baku day and HH:MM:SS. */
export function rfcDate(day: string, time: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${day} ${time} +0400`;
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${time} +0400`;
}

/** Raw headers of a genuine internal message: every check passes. */
export function internalHeaders({ day, time, fromName, fromAddr, subject, id }: { day: string; time: string; fromName: string; fromAddr: string; subject: string; id: string }): string[] {
  return [
    `Return-Path: <${fromAddr}>`,
    "Received: from mail.lumenfreight.example (mail.lumenfreight.example [10.20.0.5])",
    `        by mx1.lumenfreight.example with ESMTPS id ${id}; ${rfcDate(day, time)}`,
    "Authentication-Results: mx1.lumenfreight.example;",
    `        spf=pass smtp.mailfrom=${fromAddr.split("@")[1]};`,
    `        dkim=pass header.d=${fromAddr.split("@")[1]};`,
    `        dmarc=pass (p=REJECT) header.from=${fromAddr.split("@")[1]}`,
    `From: "${fromName}" <${fromAddr}>`,
    `To: <${ANALYST}>`,
    `Subject: ${subject}`,
    `Date: ${rfcDate(day, time)}`,
    `Message-ID: <${id}@lumenfreight.example>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
}

/** The terminal's help texts and messages in the learner's language. */
export function useShellText(): ShellText {
  const t = useTranslations("learner.lab.vm.term");
  return useMemo(
    () => ({
      helpTitle: t("helpTitle"),
      help: Object.fromEntries(COMMANDS.map((c) => [c, t(`help.${c}`)])) as ShellText["help"],
      unknownHint: t("unknownHint"),
      shellKill: t("shellKill"),
      startupEmpty: t("startupEmpty"),
      startupNoEntry: (name) => t("startupNoEntry", { name }),
      startupRemoved: (name) => t("startupRemoved", { name }),
      binaryFile: (file) => t("binaryFile", { file }),
      privateIp: (ip) => t("privateIp", { ip }),
    }),
    [t],
  );
}

/** A terminal session outside the lab's goals (labs 1 and 3): its commands are not part of the score. */
export function useLocalShell(machine: Machine): [ShellState, (line: string) => void] {
  const [shell, setShell] = useState(() => initialShell(machine));
  return [shell, (line) => setShell((s) => exec(machine, s, line).state)];
}

/** A translator for keys built at run time; tests/lab-vm.test.ts checks that every such key exists in all locales. */
export type LooseT = (key: string, values?: Record<string, string | number>) => string;

/** Objective, rule and hint texts of a lab from learner.lab.vm.labs.<id>. */
export function useLabTexts(id: VmLabId): LabTexts {
  const t = useTranslations("learner.lab") as unknown as LooseT;
  const k = `vm.labs.${id}`;
  return {
    title: t(`games.${id}.title`),
    brief: t(`${k}.brief`),
    hints: [t(`${k}.hints.h1`), t(`${k}.hints.h2`), t(`${k}.hints.h3`)],
    objective: (o) => t(`${k}.objectives.${o}`),
    why: (o) => t(`${k}.why.${o}`),
    rule: (r) => t(`${k}.rules.${r}`),
    ruleWhy: (r) => t(`${k}.ruleWhy.${r}`),
  };
}

/** The browser's new-tab page. */
export function StartPage() {
  const t = useTranslations("learner.lab.vm.browser");
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-[#f5f4fb] to-surface p-6">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#0f766e] text-white shadow-raised [&_svg]:size-7">
          <ShieldCheck />
        </span>
        <p className="text-body font-bold">{t("homeTitle")}</p>
        <p className="text-caption text-ink-muted">{t("homeBody")}</p>
      </div>
    </div>
  );
}
