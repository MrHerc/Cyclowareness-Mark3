"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { BrowserApp, type BrowserTab } from "../apps/browser-app";
import { FilesApp } from "../apps/files-app";
import { MailApp, type MailMsg } from "../apps/mail-app";
import { TerminalApp } from "../apps/terminal-app";
import { BEACON_PID, BEACON_STARTUP, workstation } from "../model/machines";
import { huntLab, type HuntState } from "../model/labs";
import { LabRunner, type LabCtx } from "../vm/runner";
import type { VmApp } from "../vm/vm-shell";
import { ANALYST, APP_ICON, StartPage, internalHeaders, useLabTexts, useShellText, type LooseT } from "./common";

/** Lab 2: an infected workstation, investigated from the Terminal. */
export function HuntLab({ today, onAgain }: { today: string; onAgain: () => void }) {
  const t = useTranslations("learner.lab.vm");
  const lt = t as unknown as LooseT;
  const texts = useLabTexts("process-hunt");
  const shellText = useShellText();
  const machine = useMemo(
    () =>
      workstation({
        today,
        infected: true,
        text: { readme: t("readme"), ticket: t("labs.process-hunt.ticket"), whoisDescr: t("labs.process-hunt.whois.descr"), whoisRemarks: t("labs.process-hunt.whois.remarks") },
      }),
    [today, t],
  );
  const [tabs, setTabs] = useState<string[]>(["new-1"]);
  const [active, setActive] = useState("new-1");
  const [seq, setSeq] = useState(2);
  const [mailReported, setMailReported] = useState<Record<string, string>>({});

  const msgs = useMemo<MailMsg[]>(() => {
    const m = (k: string, key: string) => lt(`labs.process-hunt.mail.${k}.${key}`);
    const mail = (id: string, k: string, fromAddr: string, time: string, tone: string, paragraphs: number): MailMsg => ({
      id,
      fromName: m(k, "from"),
      fromAddr,
      to: ANALYST,
      subject: m(k, "subject"),
      preview: m(k, "preview"),
      time,
      body: Array.from({ length: paragraphs }, (_, i) => m(k, `p${i + 1}`)),
      headers: internalHeaders({ day: today, time: `${time}:31`, fromName: m(k, "from"), fromAddr, subject: m(k, "subject"), id: `${id}.${today.replaceAll("-", "")}` }),
      tone,
    });
    return [mail("m-soc", "soc", "soc@lumenfreight.example", "09:41", "bg-[#b91c1c]", 3), mail("m-news", "news", "it@lumenfreight.example", "08:10", "bg-[#2563eb]", 2)];
  }, [lt, today]);

  const closeTab = (id: string) => {
    const rest = tabs.filter((x) => x !== id);
    const fresh = `new-${seq}`;
    if (!rest.length) setSeq(seq + 1);
    setTabs(rest.length ? rest : [fresh]);
    if (active === id) setActive(rest.length ? rest[rest.length - 1] : fresh);
  };
  const tab = (id: string): BrowserTab => ({ id, title: t("browser.newTab"), host: "", ascii: "newtab", path: "", secure: false, favicon: <Globe />, page: <StartPage /> });

  const apps = ({ run, send }: LabCtx<HuntState>): VmApp[] => [
    { id: "mail", label: t("apps.mail"), ...APP_ICON.mail, content: <MailApp msgs={msgs} reported={mailReported} onEvent={(e, id) => e === "report" && setMailReported({ ...mailReported, [id]: t("mail.reportedSafe") })} /> },
    {
      id: "browser",
      label: t("apps.browser"),
      ...APP_ICON.browser,
      content: (
        <BrowserApp
          tabs={tabs.map(tab)}
          active={active}
          onSelect={setActive}
          onClose={closeTab}
          onNewTab={() => {
            const id = `new-${seq}`;
            setSeq(seq + 1);
            setTabs([...tabs, id]);
            setActive(id);
          }}
          onInspect={() => {}}
          onCert={() => {}}
          onReport={() => {}}
          reported={false}
        />
      ),
    },
    { id: "terminal", label: t("apps.terminal"), ...APP_ICON.terminal, content: <TerminalApp machine={machine} shell={run.s.shell} text={shellText} welcome={t("labs.process-hunt.welcome")} run={(line) => send(["cmd", line])} /> },
    { id: "files", label: t("apps.files"), ...APP_ICON.files, content: <FilesApp machine={machine} /> },
  ];

  // The two halves of the clean-up depend on each other; the debrief says which one was left undone.
  const notes = (s: HuntState) => {
    const killed = s.shell.killed.includes(BEACON_PID);
    const removed = s.shell.removed.includes(BEACON_STARTUP);
    return [...(killed && !removed ? [t("labs.process-hunt.notes.comeback")] : []), ...(!killed && removed ? [t("labs.process-hunt.notes.stillRunning")] : [])];
  };

  return <LabRunner def={huntLab} texts={texts} host="WS-114" apps={apps} notes={notes} onAgain={onAgain} />;
}
