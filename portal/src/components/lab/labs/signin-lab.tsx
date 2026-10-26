"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Cloud, FileSpreadsheet, Globe } from "lucide-react";
import { BrowserApp, type BrowserTab, type Cert } from "../apps/browser-app";
import { FilesApp } from "../apps/files-app";
import { MailApp, type MailMsg } from "../apps/mail-app";
import { TerminalApp } from "../apps/terminal-app";
import { daysBefore, workstation } from "../model/machines";
import { SIGNIN_MAIL, signinLab, type SigninState } from "../model/labs";
import { LabRunner, type LabCtx } from "../vm/runner";
import type { VmApp } from "../vm/vm-shell";
import { ANALYST, APP_ICON, StartPage, internalHeaders, rfcDate, useLabTexts, useLocalShell, useShellText, type LooseT } from "./common";

/** The look-alike host: the second letter is the Cyrillic о (U+043E), which IDNA turns into this punycode. */
const FAKE_HOST = "clоudora.example";
const FAKE_ASCII = "xn--cludora-bjg.example";
const PHISH_TAB = "phish";

function SignInPage({ onType, onSubmit }: { onType: () => void; onSubmit: () => void }) {
  const t = useTranslations("learner.lab.vm.labs.fake-signin.page");
  const [email, setEmail] = useState(ANALYST);
  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(false);
  const field = "mt-1 h-10 w-full rounded-md border border-[#cbd5e1] bg-white px-3 text-caption text-[#0f172a] focus:border-[#2563eb] focus:ring-3 focus:ring-[#bfdbfe] focus:outline-none pointer-coarse:h-11";
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-[#e0ecff] via-[#f1f6ff] to-[#e8f6ff] p-4">
      <div className="w-full max-w-[22rem] rounded-xl bg-white p-6 text-[#0f172a] shadow-raised">
        <p className="flex items-center gap-2 text-body font-bold text-[#1e40af]">
          <Cloud className="size-6 fill-[#bfdbfe] text-[#2563eb]" aria-hidden />
          Cloudora
        </p>
        <h3 className="mt-4 text-body font-bold">{t("heading")}</h3>
        <p className="mt-1 text-tab text-[#475569]">{t("sub")}</p>
        <div className="mt-3 flex items-center gap-2.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
          <FileSpreadsheet className="size-7 shrink-0 text-[#16a34a]" aria-hidden />
          <span className="min-w-0 text-tab">
            <span className="block truncate font-semibold">{t("fileName")}</span>
            <span className="block truncate text-[#64748b]">{t("sharedBy")}</span>
          </span>
        </div>
        <label className="mt-4 block text-tab font-semibold">
          {t("email")}
          <input value={email} onChange={(e) => setEmail(e.target.value.slice(0, 120))} autoComplete="off" spellCheck={false} className={field} />
        </label>
        <label className="mt-3 block text-tab font-semibold">
          {t("password")}
          {/* A practice field: the value stays in this component and is never sent or logged, only the fact that something was typed. */}
          <input
            type="password"
            name="lab-practice-field"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value.slice(0, 120));
              if (e.target.value) onType();
            }}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            className={field}
          />
        </label>
        {wrong ? (
          <p role="alert" className="mt-2 text-tab font-semibold text-[#dc2626]">
            {t("wrong")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setWrong(true);
            setPw("");
            onSubmit();
          }}
          className="mt-4 h-10 w-full rounded-md bg-[#2563eb] text-caption font-bold text-white hover:bg-[#1d4ed8] pointer-coarse:h-11"
        >
          {t("signIn")}
        </button>
        <p className="mt-3 text-center text-tab-sm text-[#2563eb]">{t("forgot")}</p>
        <p className="mt-4 border-t border-[#e2e8f0] pt-3 text-center text-[0.6875rem] text-[#94a3b8]">© Cloudora · {t("footer")}</p>
      </div>
    </div>
  );
}

/** Lab 3: a shared-file link that opens a look-alike sign-in page in the Browser. */
export function SigninLab({ today, onAgain }: { today: string; onAgain: () => void }) {
  const t = useTranslations("learner.lab.vm");
  const lt = t as unknown as LooseT;
  const texts = useLabTexts("fake-signin");
  const shellText = useShellText();
  const machine = useMemo(() => workstation({ today, infected: false, text: { readme: t("readme") } }), [today, t]);
  const [shell, runLocal] = useLocalShell(machine);
  const [extra, setExtra] = useState<string[]>([]);
  const [active, setActive] = useState(PHISH_TAB);
  const [seq, setSeq] = useState(1);
  const [mailReported, setMailReported] = useState<Record<string, string>>({});

  const msgs = useMemo<MailMsg[]>(() => {
    const m = (k: string, key: string) => lt(`labs.fake-signin.mail.${k}.${key}`);
    return [
      {
        id: SIGNIN_MAIL,
        fromName: m("share", "from"),
        fromAddr: "no-reply@cloudora-share.example",
        to: ANALYST,
        subject: m("share", "subject"),
        preview: m("share", "preview"),
        time: "10:02",
        body: [m("share", "p1"), m("share", "p2")],
        link: { text: m("share", "link"), href: `https://${FAKE_ASCII}/s/q4-freight-rates`, after: 0 },
        headers: [
          "Return-Path: <no-reply@cloudora-share.example>",
          "Received: from smtp.cloudora-share.example (smtp.cloudora-share.example [198.51.100.201])",
          `        by mx1.lumenfreight.example with ESMTPS id 77c1e0aa; ${rfcDate(today, "10:02:44")}`,
          "Authentication-Results: mx1.lumenfreight.example;",
          "        spf=pass smtp.mailfrom=cloudora-share.example;",
          "        dkim=pass header.d=cloudora-share.example;",
          "        dmarc=pass (p=NONE) header.from=cloudora-share.example",
          `From: "${m("share", "from")}" <no-reply@cloudora-share.example>`,
          `To: <${ANALYST}>`,
          `Subject: ${m("share", "subject")}`,
          `Date: ${rfcDate(today, "10:02:31")}`,
          "MIME-Version: 1.0",
          'Content-Type: text/html; charset="UTF-8"',
        ],
        tone: "bg-[#2563eb]",
      },
      {
        id: "m-it",
        fromName: m("it", "from"),
        fromAddr: "it@lumenfreight.example",
        to: ANALYST,
        subject: m("it", "subject"),
        preview: m("it", "preview"),
        time: "08:20",
        body: [m("it", "p1"), m("it", "p2")],
        headers: internalHeaders({ day: today, time: "08:20:05", fromName: m("it", "from"), fromAddr: "it@lumenfreight.example", subject: m("it", "subject"), id: `m-it.${today.replaceAll("-", "")}` }),
        tone: "bg-[#0f766e]",
      },
    ];
  }, [lt, today]);

  const cert: Cert = {
    subject: "files-share-cdn.example",
    org: null,
    altNames: [FAKE_ASCII, "files-share-cdn.example"],
    issuer: "QuickCert DV CA R2",
    from: daysBefore(today, 2),
    to: daysBefore(today, -88),
    fingerprint: "4F:9A:2C:71:0B:E3:58:D2:6A:11:C0:7E:93:42:AF:15:88:3D:C6:02:71:B9:4E:5A:D0:63:17:2F:AE:94:C8:21",
  };

  const apps = ({ run, send, act }: LabCtx<SigninState>): VmApp[] => {
    const open = run.s.tabOpen;
    const ids = [...(open ? [PHISH_TAB] : []), ...extra];
    const visible = ids.length ? ids : ["new-0"];
    const current = visible.includes(active) ? active : visible[visible.length - 1];
    const tabOf = (id: string): BrowserTab =>
      id === PHISH_TAB
        ? {
            id,
            title: t("labs.fake-signin.page.title"),
            host: FAKE_HOST,
            ascii: FAKE_ASCII,
            path: "/s/q4-freight-rates",
            secure: true,
            mixed: { char: "о", name: t("labs.fake-signin.mixedName") },
            cert,
            favicon: <Cloud className="fill-[#bfdbfe] text-[#2563eb]" />,
            page: <SignInPage onType={() => !run.s.typedPassword && send(["typePw"])} onSubmit={() => send(["submit"])} />,
            reportable: true,
          }
        : { id, title: t("browser.newTab"), host: "", ascii: "newtab", path: "", secure: false, favicon: <Globe />, page: <StartPage /> };
    return [
      {
        id: "mail",
        label: t("apps.mail"),
        ...APP_ICON.mail,
        content: (
          <MailApp
            msgs={msgs}
            reported={mailReported}
            onEvent={(e, id) => {
              if (e === "report") {
                setMailReported({ ...mailReported, [id]: id === SIGNIN_MAIL ? t("mail.reportedBanner") : t("mail.reportedSafe") });
                if (id === SIGNIN_MAIL) send(["report", id]);
              }
              if (e === "linkOpen" && id === SIGNIN_MAIL) {
                if (!open) send(["openTab"]);
                setActive(PHISH_TAB);
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
            tabs={visible.map(tabOf)}
            active={current}
            onSelect={setActive}
            onClose={(id) => {
              if (id === PHISH_TAB) send(["closeTab"]);
              else setExtra(extra.filter((x) => x !== id));
              const rest = visible.filter((x) => x !== id);
              if (!rest.length) {
                const fresh = `new-${seq}`;
                setSeq(seq + 1);
                setExtra([fresh]);
                setActive(fresh);
              } else if (current === id) setActive(rest[rest.length - 1]);
            }}
            onNewTab={() => {
              const id = `new-${seq}`;
              setSeq(seq + 1);
              setExtra([...extra.filter((x) => x !== "new-0"), id]);
              setActive(id);
            }}
            onInspect={(id) => id === PHISH_TAB && send(["inspectUrl"])}
            onCert={(id) => id === PHISH_TAB && send(["cert"])}
            onReport={(id) => id === PHISH_TAB && send(["report", "browser"])}
            reported={run.s.reported}
          />
        ),
      },
      { id: "terminal", label: t("apps.terminal"), ...APP_ICON.terminal, content: <TerminalApp machine={machine} shell={shell} text={shellText} welcome={t("term.welcome")} run={runLocal} /> },
      { id: "files", label: t("apps.files"), ...APP_ICON.files, content: <FilesApp machine={machine} /> },
    ];
  };

  return <LabRunner def={signinLab} texts={texts} host="WS-114" apps={apps} onAgain={onAgain} />;
}
