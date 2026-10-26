"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, ShieldAlert } from "lucide-react";
import { BrowserApp, type BrowserTab } from "../apps/browser-app";
import { FilesApp } from "../apps/files-app";
import { MailApp, type MailMsg } from "../apps/mail-app";
import { TerminalApp } from "../apps/terminal-app";
import { workstation } from "../model/machines";
import { PHISH_MAIL, phishingLab, type PhishState } from "../model/labs";
import { LabRunner, type LabCtx } from "../vm/runner";
import type { VmApp } from "../vm/vm-shell";
import { ANALYST, APP_ICON, StartPage, internalHeaders, rfcDate, useLabTexts, useLocalShell, useShellText, type LooseT } from "./common";

const FAKE_LINK = "https://paylinea-billing-support.example/inv/4471/login?s=a8f3c1";
const ATTACHMENT = `Invoice_4471.pdf${" ".repeat(26)}.exe`;

/** Lab 1: a forged invoice email, read in the Mail app. */
export function PhishingLab({ today, onAgain }: { today: string; onAgain: () => void }) {
  const t = useTranslations("learner.lab.vm");
  const texts = useLabTexts("phishing-anatomy");
  const shellText = useShellText();
  const machine = useMemo(() => workstation({ today, infected: false, text: { readme: t("readme") } }), [today, t]);
  const [shell, runLocal] = useLocalShell(machine);
  const [tabs, setTabs] = useState<string[]>(["new-1"]);
  const [active, setActive] = useState("new-1");
  const [seq, setSeq] = useState(2);

  const msgs = useMemo<MailMsg[]>(() => {
    const m = (k: string, key: string) => (t as unknown as LooseT)(`labs.phishing-anatomy.mail.${k}.${key}`);
    const subject = m("invoice", "subject");
    const internal = (id: string, k: "ops" | "hr" | "it", fromAddr: string, time: string, tone: string): MailMsg => ({
      id,
      fromName: m(k, "from"),
      fromAddr,
      to: ANALYST,
      subject: m(k, "subject"),
      preview: m(k, "preview"),
      time,
      body: [m(k, "p1"), m(k, "p2")],
      headers: internalHeaders({ day: today, time: `${time}:12`, fromName: m(k, "from"), fromAddr, subject: m(k, "subject"), id: `${id}.${today.replaceAll("-", "")}` }),
      tone,
    });
    return [
      {
        id: PHISH_MAIL,
        fromName: m("invoice", "from"),
        fromAddr: "billing@paylinea.example",
        replyTo: "payments@paylinea-billing-support.example",
        to: ANALYST,
        subject,
        preview: m("invoice", "preview"),
        time: "09:14",
        body: [m("invoice", "p1"), m("invoice", "p2"), m("invoice", "p3")],
        link: { text: "https://portal.paylinea.example/invoices/4471", href: FAKE_LINK, after: 1 },
        attachment: { name: ATTACHMENT, shown: ATTACHMENT, size: t("labs.phishing-anatomy.attachmentSize"), kind: t("mail.appType") },
        headers: [
          "Return-Path: <bounce-7731@mailer.fastsend-relay.example>",
          "Received: from mailer.fastsend-relay.example (mailer.fastsend-relay.example [203.0.113.91])",
          `        by mx1.lumenfreight.example with ESMTPS id 4f2a91c7; ${rfcDate(today, "09:14:07")}`,
          "Authentication-Results: mx1.lumenfreight.example;",
          "        spf=fail (domain of paylinea.example does not designate 203.0.113.91 as permitted sender) smtp.mailfrom=paylinea.example;",
          "        dkim=fail (signature verification failed) header.d=paylinea.example;",
          "        dmarc=fail (p=REJECT sp=REJECT) header.from=paylinea.example",
          'From: "Paylinea Billing" <billing@paylinea.example>',
          "Reply-To: <payments@paylinea-billing-support.example>",
          `To: <${ANALYST}>`,
          `Subject: ${subject}`,
          `Date: ${rfcDate(today, "09:13:52")}`,
          "Message-ID: <20261021091352.5521@fastsend-relay.example>",
          "X-Mailer: FastSend Bulk 4.2",
          "MIME-Version: 1.0",
          'Content-Type: multipart/mixed; boundary="----=_Part_8812"',
        ],
        tone: "bg-[#0f766e]",
      },
      internal("m-ops", "ops", "aysel.karimova@lumenfreight.example", "08:47", "bg-[#7c3aed]"),
      internal("m-hr", "hr", "hr@lumenfreight.example", "08:05", "bg-[#db2777]"),
      internal("m-it", "it", "it@lumenfreight.example", "07:58", "bg-[#2563eb]"),
    ];
  }, [t, today]);

  const newTab = (id: string): BrowserTab => ({ id, title: t("browser.newTab"), host: "", ascii: "newtab", path: "", secure: false, favicon: <Globe />, page: <StartPage /> });
  const closeTab = (id: string) => {
    const rest = tabs.filter((x) => x !== id);
    if (rest.length) {
      setTabs(rest);
      if (active === id) setActive(rest[rest.length - 1]);
    } else {
      const fresh = `new-${seq}`;
      setSeq(seq + 1);
      setTabs([fresh]);
      setActive(fresh);
    }
  };
  const blocked: BrowserTab = {
    id: "blocked",
    title: "Paylinea",
    host: "paylinea-billing-support.example",
    ascii: "paylinea-billing-support.example",
    path: "/inv/4471/login",
    secure: true,
    favicon: <ShieldAlert className="text-risk-600" />,
    page: (
      <div className="grid min-h-full place-items-center bg-risk-600 p-6 text-white">
        <div className="max-w-md">
          <ShieldAlert className="size-12" aria-hidden />
          <h3 className="mt-3 text-title font-bold">{t("browser.blockedTitle")}</h3>
          <p className="mt-2 text-caption text-white/90">{t("browser.blockedBody")}</p>
          <button type="button" onClick={() => closeTab("blocked")} className="mt-5 h-10 rounded-pill bg-white px-5 text-caption font-bold text-risk-700 hover:bg-white/90 pointer-coarse:h-11">
            {t("browser.backToSafety")}
          </button>
        </div>
      </div>
    ),
  };

  const apps = ({ run, send, act }: LabCtx<PhishState>): VmApp[] => {
    const reported: Record<string, string> = {};
    if (run.s.reported) reported[PHISH_MAIL] = t("mail.reportedBanner");
    for (const id of run.s.falseReports) reported[id] = t("mail.reportedSafe");
    return [
      {
        id: "mail",
        label: t("apps.mail"),
        ...APP_ICON.mail,
        content: (
          <MailApp
            msgs={msgs}
            reported={reported}
            onEvent={(e, id) => {
              send([e, id]);
              if (e === "linkOpen" && id === PHISH_MAIL) {
                if (!tabs.includes("blocked")) setTabs([...tabs, "blocked"]);
                setActive("blocked");
                act({ type: "open", app: "browser" });
              }
            }}
          />
        ),
      },
      {
        id: "browser",
        label: t("apps.browser"),
        ...APP_ICON.browser,
        content: (
          <BrowserApp
            tabs={tabs.map((id) => (id === "blocked" ? blocked : newTab(id)))}
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
      { id: "terminal", label: t("apps.terminal"), ...APP_ICON.terminal, content: <TerminalApp machine={machine} shell={shell} text={shellText} welcome={t("term.welcome")} run={runLocal} /> },
      { id: "files", label: t("apps.files"), ...APP_ICON.files, content: <FilesApp machine={machine} /> },
    ];
  };

  return <LabRunner def={phishingLab} texts={texts} host="WS-114" apps={apps} notes={(s) => (s.falseReports.length ? [t("labs.phishing-anatomy.falseReport")] : [])} onAgain={onAgain} />;
}
