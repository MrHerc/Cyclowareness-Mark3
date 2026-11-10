"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppWindow, CheckCircle2, ChevronRight, FileText, Globe, Mail, MessageSquare, PhoneIncoming, ShieldAlert } from "lucide-react";
import type { LabArtifact, LabDecision, LabScenario } from "@/lib/content/lab-scenario";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { BrowserApp, type BrowserTab } from "../apps/browser-app";
import { FilesApp } from "../apps/files-app";
import { MailApp, type MailMsg } from "../apps/mail-app";
import { TerminalApp } from "../apps/terminal-app";
import { workstation } from "../model/machines";
import { nodeAt } from "../model/shell";
import { ARTIFACT_APP, miniLabDef, type MiniState } from "../model/labs";
import { LabRunner, type LabCtx, type LabTexts } from "../vm/runner";
import type { DebriefBack } from "../vm/debrief";
import { useStill } from "../vm/hooks";
import type { VmApp } from "../vm/vm-shell";
import { ANALYST, APP_ICON, StartPage, rfcDate, useLocalShell, useShellText } from "./common";

type Web = Extract<LabArtifact, { kind: "web" }>;
const TONES = ["bg-[#0f766e]", "bg-[#7c3aed]", "bg-[#db2777]", "bg-[#2563eb]", "bg-[#ea580c]"];

/** A module's mini-lab; "Run the lab again" remounts it with a fresh machine. */
export function MiniLab({ scenario, lang, today, back }: { scenario: LabScenario; lang: string; today: string; back: DebriefBack }) {
  const [attempt, setAttempt] = useState(0);
  return <MiniRun key={attempt} sc={scenario} lang={lang} today={today} back={back} onAgain={() => setAttempt((a) => a + 1)} />;
}

/**
 * The module's decisions one at a time in a card above the machine: each artifact opens in its own app (mail,
 * browser tab, downloaded file) or shows in the card (a text, a call, a window). The run keeps only the chosen
 * option ids; the server scores them again from the English scenario.
 */
function MiniRun({ sc, lang, today, back, onAgain }: { sc: LabScenario; lang: string; today: string; back: DebriefBack; onAgain: () => void }) {
  const t = useTranslations("learner.lab");
  const tv = useTranslations("learner.lab.vm");
  const def = useMemo(() => miniLabDef(sc), [sc]);
  const shellText = useShellText();
  const still = useStill();
  const machine = useMemo(() => {
    const m = workstation({ today, infected: false, text: { readme: tv("readme") } });
    const downloads = nodeAt(m.fs, `${m.home}/Downloads`);
    if (downloads?.kind === "dir") for (const d of sc.decisions) if (d.artifact.kind === "file") downloads.children[d.artifact.name] = { kind: "file", content: d.artifact.text };
    return m;
  }, [sc, today, tv]);
  const [shell, runLocal] = useLocalShell(machine);
  const webs = sc.decisions.filter((d): d is LabDecision & { artifact: Web } => d.artifact.kind === "web");
  // Like the inbox, a decision's tab opens when the decision is reached (show() and openTab() add it).
  const [tabs, setTabs] = useState<string[]>(() => (sc.decisions[0].artifact.kind === "web" ? [sc.decisions[0].id] : ["new-1"]));
  const [active, setActive] = useState(tabs[0]);
  const [seq, setSeq] = useState(2);
  const [reportedTabs, setReportedTabs] = useState<string[]>([]);
  const [reported, setReported] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);

  const msgs = useMemo<MailMsg[]>(
    () =>
      // Only the e-mails of the decisions reached so far are in the inbox.
      sc.decisions.slice(0, idx + 1).flatMap((d, i) => {
        const a = d.artifact;
        if (a.kind !== "email") return [];
        return [
          {
            id: d.id,
            fromName: a.from.name,
            fromAddr: a.from.address,
            to: a.to ?? ANALYST,
            subject: a.subject,
            preview: a.body[0],
            time: a.time,
            body: a.body,
            link: a.link,
            attachment: a.attachment && { name: a.attachment.name, shown: a.attachment.name, size: a.attachment.size, kind: (a.attachment.name.split(".").pop() ?? "").toUpperCase() },
            headers: [`From: "${a.from.name}" <${a.from.address}>`, `To: ${a.to ?? `<${ANALYST}>`}`, `Subject: ${a.subject}`, `Date: ${rfcDate(today, `${a.time}:00`)}`, "MIME-Version: 1.0"],
            tone: TONES[i % TONES.length],
            lang,
          },
        ];
      }),
    [sc, today, idx, lang],
  );

  const texts = useMemo<LabTexts>(() => {
    const byId = new Map(sc.decisions.map((d) => [d.id, d]));
    return {
      title: sc.title,
      brief: sc.intro,
      hints: [],
      lang,
      nothingFound: t("mini.nothingFound"),
      objective: (id) => byId.get(id)?.title ?? id,
      why: (id) => {
        const d = byId.get(id);
        return d ? t("mini.why", { risk: t(`mini.risk.${d.risk}`), text: d.explain }) : "";
      },
      rule: () => "",
      ruleWhy: () => "",
    };
  }, [sc, t, lang]);

  const webTab = (d: LabDecision & { artifact: Web }): BrowserTab => {
    const u = new URL(d.artifact.url);
    return { id: d.id, title: d.artifact.title, host: u.host, ascii: u.host, path: `${u.pathname}${u.search}`, secure: u.protocol === "https:", favicon: <Globe />, page: <WebPage a={d.artifact} lang={lang} /> };
  };
  const newTab = (id: string): BrowserTab => ({ id, title: tv("browser.newTab"), host: "", ascii: "newtab", path: "", secure: false, favicon: <Globe />, page: <StartPage /> });
  const openTab = (id: string) => {
    if (!tabs.includes(id)) setTabs([...tabs, id]);
    setActive(id);
  };
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

  /** Brings the decision's app forward (and its tab, for a web page); `scroll` also brings the machine into view. */
  const show = (d: LabDecision, act: LabCtx<MiniState>["act"], scroll = false) => {
    if (d.artifact.kind === "web") openTab(d.id);
    act({ type: "open", app: ARTIFACT_APP[d.artifact.kind] });
    if (scroll) document.getElementById("lab-machine")?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  };

  const stage = ({ run, send, act }: LabCtx<MiniState>) => {
    const d = sc.decisions[idx];
    const last = idx === sc.decisions.length - 1;
    return (
      <DecisionCard
        key={d.id}
        d={d}
        n={idx + 1}
        total={sc.decisions.length}
        lang={lang}
        picked={run.s.answers[d.id]}
        focusOnMount={idx > 0}
        onChoose={(o) => send(["choose", `${d.id}:${o}`])}
        onShow={() => show(d, act, true)}
        onNext={() => {
          if (last) return send(["finish"]);
          const next = sc.decisions[idx + 1];
          setIdx(idx + 1);
          if (next.artifact.kind === "email" || next.artifact.kind === "web" || next.artifact.kind === "file") show(next, act);
        }}
        last={last}
      />
    );
  };

  const apps = (): VmApp[] => [
    {
      id: "mail",
      label: tv("apps.mail"),
      ...APP_ICON.mail,
      content: (
        <MailApp
          msgs={msgs}
          reported={reported}
          ranText={t("mini.ranBody")}
          onEvent={(e, id) => {
            // Practice only: the mini-lab scores the decision card, not what is done in the apps.
            if (e === "report") setReported({ ...reported, [id]: tv("mail.reportedBanner") });
          }}
        />
      ),
    },
    {
      id: "browser",
      label: tv("apps.browser"),
      ...APP_ICON.browser,
      content: (
        <BrowserApp
          tabs={tabs.map((id) => {
            const d = webs.find((w) => w.id === id);
            return d ? webTab(d) : newTab(id);
          })}
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
          onReport={(id) => setReportedTabs([...reportedTabs, id])}
          reported={reportedTabs.includes(active)}
        />
      ),
    },
    { id: "terminal", label: tv("apps.terminal"), ...APP_ICON.terminal, content: <TerminalApp machine={machine} shell={shell} text={shellText} welcome={tv("term.welcome")} run={runLocal} /> },
    { id: "files", label: tv("apps.files"), ...APP_ICON.files, content: <FilesApp machine={machine} /> },
  ];

  return <LabRunner def={def} texts={texts} host="WS-114" apps={apps} stage={stage} back={back} onAgain={onAgain} />;
}

/**
 * One decision. Choosing keeps the options focusable (aria-disabled) and moves focus to the feedback's button, as the
 * lesson player's feedback does; the next decision's card focuses its prompt. The risk tag shows only with the feedback.
 */
function DecisionCard({ d, n, total, lang, picked, focusOnMount, onChoose, onShow, onNext, last }: { d: LabDecision; n: number; total: number; lang: string; picked?: string; focusOnMount: boolean; onChoose: (option: string) => void; onShow: () => void; onNext: () => void; last: boolean }) {
  const t = useTranslations("learner.lab");
  const tv = useTranslations("learner.lab.vm");
  const heading = useRef<HTMLHeadingElement>(null);
  const verdictId = useId();
  const explainId = useId();
  // A frame later: Next also opens the next artifact's app, whose window takes the focus in the same commit.
  useEffect(() => {
    if (!focusOnMount) return;
    const id = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusOnMount]);
  const ok = picked === d.safe;
  const app = ARTIFACT_APP[d.artifact.kind];
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-caption font-semibold text-ink-muted">{t("mini.decision", { n, total })}</p>
      <h2 ref={heading} tabIndex={-1} lang={lang} className="mt-1.5 text-body font-bold text-balance outline-none">
        {d.prompt}
      </h2>
      <div lang={lang}>
        <InlineArtifact a={d.artifact} says={t("mini.says")} />
      </div>
      {d.artifact.kind === "email" || d.artifact.kind === "web" || d.artifact.kind === "file" ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-sunken px-3.5 py-2.5">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-caption font-semibold [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle">
            {d.artifact.kind === "email" ? (
              <>
                <Mail aria-hidden />
                <span className="min-w-0">
                  <span lang={lang} className="block truncate">
                    <bdi>{d.artifact.from.name}</bdi> · {d.artifact.subject}
                  </span>
                  {d.artifact.to ? (
                    <span className="block font-normal break-all text-ink-muted">
                      {tv("mail.to")}:{" "}
                      <bdi lang={lang} dir="ltr">
                        {d.artifact.to}
                      </bdi>
                    </span>
                  ) : null}
                </span>
              </>
            ) : d.artifact.kind === "web" ? (
              <>
                <Globe aria-hidden />
                <span dir="ltr" className="min-w-0 font-mono break-all">
                  {d.artifact.url}
                </span>
              </>
            ) : (
              <>
                <FileText aria-hidden />
                <span className="min-w-0 font-mono break-all">{d.artifact.name}</span>
              </>
            )}
          </span>
          <Button variant="secondary" size="sm" onClick={onShow}>
            {t("mini.show", { app: tv(`apps.${app}`) })}
          </Button>
        </div>
      ) : null}
      <div role="group" aria-label={t("mini.choices")} lang={lang} className="mt-4 grid gap-2 sm:grid-cols-2">
        {d.options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-disabled={!!picked}
            aria-pressed={picked === o.id}
            onClick={() => {
              if (!picked) onChoose(o.id);
            }}
            className={cn(
              "rounded-lg border-2 px-4 py-3 text-start text-body-sm font-semibold transition-colors",
              picked === o.id ? (ok ? "border-safe-500 bg-safe-50 text-safe-700" : "border-risk-500 bg-risk-50 text-risk-700") : "border-line bg-surface",
              !picked && "hover:border-brand-300",
              picked && picked !== o.id && "opacity-60",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {picked ? <Feedback ok={ok} verdictId={verdictId} explainId={explainId} risk={t(`mini.risk.${d.risk}`)} explain={d.explain} lang={lang} action={last ? t("mini.results") : t("mini.next")} onAction={onNext} /> : null}
    </Card>
  );
}

/** The verdict, the risk tag and the explanation; its button takes the focus when it appears. */
function Feedback({ ok, verdictId, explainId, risk, explain, lang, action, onAction }: { ok: boolean; verdictId: string; explainId: string; risk: string; explain: string; lang: string; action: string; onAction: () => void }) {
  const t = useTranslations("learner.lab");
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
  }, []);
  return (
    <div role="alertdialog" aria-labelledby={verdictId} aria-describedby={explainId} className={cn("mt-4 rounded-lg p-3.5", ok ? "bg-safe-50" : "bg-risk-50")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={verdictId} className={cn("flex items-center gap-2 text-body-sm font-bold", ok ? "text-safe-700" : "text-risk-700")}>
          {ok ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <ShieldAlert className="size-5 shrink-0" aria-hidden />}
          {ok ? t("mini.safeChoice") : t("mini.riskyChoice")}
        </p>
        <Pill>{risk}</Pill>
      </div>
      <p id={explainId} lang={lang} className="mt-1 text-caption text-ink-muted">
        {explain}
      </p>
      <Button ref={button} size="sm" className="mt-3" iconRight={<ChevronRight />} onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/** A text message, a call or a window, shown in the decision card itself. */
function InlineArtifact({ a, says }: { a: LabArtifact; says: string }) {
  if (a.kind === "sms")
    return (
      <div className="mt-3 rounded-lg bg-sunken p-3.5">
        <p className="flex items-center gap-2 text-caption font-semibold">
          <MessageSquare className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <bdi className="min-w-0 truncate">{a.name}</bdi>
          <span className="ms-auto shrink-0 font-normal text-ink-subtle tabular-nums">{a.time}</span>
        </p>
        <div className="mt-2 grid justify-items-start gap-1.5">
          {a.body.map((p) => (
            <p key={p} className="max-w-full rounded-lg rounded-ss-sm bg-surface px-3 py-2 text-body-sm break-words shadow-xs">
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  if (a.kind === "call")
    return (
      <div className="mt-3 rounded-lg bg-sunken p-3.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption font-semibold">
          <PhoneIncoming className="size-4 shrink-0 text-safe-600" aria-hidden />
          <bdi>{a.name}</bdi>
          <span dir="ltr" className="font-normal text-ink-subtle tabular-nums">
            {a.number}
          </span>
        </p>
        <p className="mt-2 text-tab font-semibold text-ink-subtle">{says}</p>
        {a.body.map((p) => (
          <p key={p} className="mt-1 border-s-2 border-line-strong ps-3 text-body-sm italic">
            {p}
          </p>
        ))}
      </div>
    );
  if (a.kind === "dialog")
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <p className="flex items-center gap-2 border-b border-line bg-sunken px-3.5 py-2 text-caption font-semibold">
          <AppWindow className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          {a.title}
        </p>
        <div className="grid gap-1 p-3.5 text-body-sm">
          {a.body.map((p) => (
            <p key={p} className="break-words">
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  return null;
}

/** A browser tab's page: heading, text and a form whose fields cannot be typed into (the lab never takes a password). */
function WebPage({ a, lang }: { a: Web; lang: string }) {
  return (
    <div lang={lang} className="min-h-full bg-surface p-6">
      <div className="mx-auto grid max-w-sm gap-3">
        <h3 className="text-title-sm font-bold">{a.title}</h3>
        {a.body.map((p) => (
          <p key={p} className="text-body-sm text-ink-muted">
            {p}
          </p>
        ))}
        {a.fields?.map((f) => (
          <label key={f} className="grid gap-1 text-caption font-semibold">
            {f}
            <input disabled className="h-10 rounded-md border border-line-strong bg-sunken px-3" />
          </label>
        ))}
        {a.button ? (
          <button type="button" disabled className="h-10 rounded-pill bg-brand-600 px-5 text-caption font-bold text-brand-on opacity-70">
            {a.button}
          </button>
        ) : null}
      </div>
    </div>
  );
}
