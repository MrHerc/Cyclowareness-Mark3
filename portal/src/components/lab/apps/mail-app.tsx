"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, FileCode2, FileText, Info, Paperclip, Reply, ShieldAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { dirOf } from "@/i18n/config";

export type MailMsg = {
  id: string;
  fromName: string;
  fromAddr: string;
  to: string;
  replyTo?: string;
  subject: string;
  preview: string;
  time: string;
  body: string[];
  /** The link sits after paragraph `after`; `href` is where it really goes. */
  link?: { text: string; href: string; after: number };
  /** `name` is the real file name, `shown` what fits in the chip. */
  attachment?: { name: string; shown: string; size: string; kind: string };
  headers: string[];
  tone: string;
  /** The language of the message text when it is not the page's (a mini-lab shown in English). */
  lang?: string;
};

export type MailEvent = "headers" | "reply" | "peek" | "attachInfo" | "attachOpen" | "linkOpen" | "report";

/** Upper-cased in the UI language: an Azerbaijani "i" becomes "İ". */
const initials = (name: string, locale: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase(locale);

/**
 * A mail client: message list, reader with Reply, Report phishing and View original (raw headers), a link
 * whose real target shows in the status bar on hover, focus or long-press, and attachments with details.
 */
export function MailApp({ msgs, reported, onEvent, ranText }: { msgs: MailMsg[]; reported: Record<string, string>; onEvent: (e: MailEvent, id: string) => void; ranText?: string }) {
  const t = useTranslations("learner.lab.vm.mail");
  const locale = useLocale();
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"read" | "original" | "reply">("read");
  const [read, setRead] = useState<string[]>([]);
  const msg = msgs.find((m) => m.id === sel) ?? null;

  const open = (id: string) => {
    setSel(id);
    setView("read");
    if (!read.includes(id)) setRead([...read, id]);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 @[34rem]:grid-cols-[13.5rem_minmax(0,1fr)] @[48rem]:grid-cols-[17rem_minmax(0,1fr)]">
      <div className={cn("min-h-0 min-w-0 flex-col border-r border-line bg-[#fafafc]", msg ? "hidden @[34rem]:flex" : "flex")}>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3 text-caption font-semibold">
          <span>{t("inbox")}</span>
          <span className="rounded-pill bg-brand-100 px-2 text-tab-sm text-brand-700 tabular-nums">
            <span aria-hidden>{msgs.length - read.length}</span>
            <span className="sr-only">{t("unread", { count: msgs.length - read.length })}</span>
          </span>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("messages")}>
          {msgs.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => open(m.id)}
                aria-current={sel === m.id ? "true" : undefined}
                className={cn("flex w-full gap-2.5 border-b border-line/70 px-3 py-2.5 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600", sel === m.id && "bg-brand-50")}
              >
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-tab-sm font-bold text-white", m.tone)} aria-hidden>
                  {initials(m.fromName, locale)}
                </span>
                <span lang={m.lang} className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-caption", read.includes(m.id) ? "font-medium" : "font-bold")}>{m.fromName}</span>
                    <span className="shrink-0 text-tab-sm text-ink-subtle tabular-nums">{m.time}</span>
                  </span>
                  <span className={cn("flex items-center gap-1 truncate text-tab", read.includes(m.id) ? "text-ink" : "font-semibold text-ink")}>
                    {m.attachment ? <Paperclip className="size-3 shrink-0 text-ink-subtle" aria-hidden /> : null}
                    <span className="truncate">{m.subject}</span>
                  </span>
                  <span className="block truncate text-tab-sm text-ink-subtle">{m.preview}</span>
                  {reported[m.id] ? <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-safe-50 px-1.5 text-[0.6875rem] font-semibold text-safe-700">{t("reportedChip")}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("min-h-0 min-w-0 flex-col", msg ? "flex" : "hidden @[34rem]:flex")}>
        {msg ? (
          <Reader key={msg.id} msg={msg} view={view} setView={setView} reported={reported[msg.id]} onEvent={(e) => onEvent(e, msg.id)} onBack={() => setSel(null)} ranText={ranText} />
        ) : (
          <p className="m-auto px-6 text-center text-caption text-ink-subtle">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}

function Reader({ msg, view, setView, reported, onEvent, onBack, ranText }: { msg: MailMsg; view: "read" | "original" | "reply"; setView: (v: "read" | "original" | "reply") => void; reported?: string; onEvent: (e: MailEvent) => void; onBack: () => void; ranText?: string }) {
  const t = useTranslations("learner.lab.vm.mail");
  const locale = useLocale();
  const [status, setStatus] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [prompt, setPrompt] = useState<"ask" | "ran" | null>(null);
  const press = useRef<{ timer: number; long: boolean } | null>(null);
  const safe = useRef<HTMLButtonElement>(null);
  // The prompt focuses its safe choice without scrolling the page (autoFocus would).
  useEffect(() => {
    if (prompt) safe.current?.focus({ preventScroll: true });
  }, [prompt]);
  const dwell = useRef<number | null>(null);

  const tool = "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-tab font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:h-11 [&_svg]:size-4";
  const reveal = (href: string) => {
    setStatus(href);
    onEvent("peek");
  };
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        <button type="button" onClick={view === "read" ? onBack : () => setView("read")} className={cn(tool, "text-ink-muted hover:bg-sunken", view === "read" && "@[34rem]:hidden")} aria-label={t("back")}>
          <ArrowLeft />
          <span className="hidden @[24rem]:inline">{t("back")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setView("reply");
            onEvent("reply");
          }}
          className={cn(tool, "text-ink hover:bg-sunken")}
        >
          <Reply />
          {t("reply")}
        </button>
        <button
          type="button"
          onClick={() => {
            setView("original");
            onEvent("headers");
          }}
          className={cn(tool, "text-ink hover:bg-sunken", view === "original" && "bg-sunken")}
        >
          <FileCode2 />
          {t("viewOriginal")}
        </button>
        <button type="button" disabled={!!reported} onClick={() => onEvent("report")} className={cn(tool, "ml-auto border border-risk-100 bg-risk-50 text-risk-700 hover:bg-risk-100 disabled:opacity-60")}>
          <ShieldAlert />
          {t("report")}
        </button>
      </div>
      {reported ? (
        <p role="status" className="flex shrink-0 items-start gap-2 bg-safe-50 px-4 py-2 text-tab text-safe-700">
          <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden />
          {reported}
        </p>
      ) : null}

      {view === "original" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <h3 className="text-caption font-bold">{t("original")}</h3>
          <p className="text-tab-sm text-ink-subtle">{t("originalHint")}</p>
          <pre className="mt-3 rounded-md border border-line bg-[#0b0f1a] p-3 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap text-[#d6deeb] [overflow-wrap:anywhere]" tabIndex={0} aria-label={t("original")}>
            {msg.headers.join("\n")}
          </pre>
        </div>
      ) : view === "reply" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-caption">
            <dt className="text-ink-subtle">{t("to")}</dt>
            <dd className="font-mono text-tab break-all">{msg.replyTo ?? msg.fromAddr}</dd>
            <dt className="text-ink-subtle">{t("subject")}</dt>
            <dd className="break-words">Re: {msg.subject}</dd>
          </dl>
          <div className="mt-3 h-28 rounded-md border border-line bg-sunken" aria-hidden />
          <p className="mt-2 text-tab-sm text-ink-subtle">{t("replyNote")}</p>
        </div>
      ) : (
        // The message is in the learner's language: it reads in that direction inside the left-to-right VM.
        <div dir={dirOf(msg.lang ?? locale)} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 lang={msg.lang} className="text-body font-bold break-words">
            {msg.subject}
          </h3>
          <div className="mt-2 flex items-start gap-2.5">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-tab font-bold text-white", msg.tone)} aria-hidden>
              {initials(msg.fromName, locale)}
            </span>
            <div className="min-w-0 text-tab">
              <p className="font-semibold text-ink">
                {msg.fromName}{" "}
                <span dir="ltr" className="font-normal break-all text-ink-subtle">
                  &lt;{msg.fromAddr}&gt;
                </span>
              </p>
              <p className="text-ink-subtle">
                {t("to")}: <bdi>{msg.to}</bdi> · {msg.time}
              </p>
            </div>
          </div>
          <div lang={msg.lang} className="mt-3 grid gap-2.5 text-caption leading-relaxed text-ink">
            {msg.body.map((p, i) => (
              <div key={i} className="grid gap-2.5">
                <p className="break-words">{p}</p>
                {msg.link && msg.link.after === i ? (
                  <p>
                    <button
                      type="button"
                      className="text-start font-semibold break-all text-[#1d4ed8] underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-brand-600"
                      aria-describedby="mail-status"
                      onMouseEnter={() => {
                        setStatus(msg.link!.href);
                        dwell.current = window.setTimeout(() => onEvent("peek"), 350);
                      }}
                      onMouseLeave={() => {
                        if (dwell.current) window.clearTimeout(dwell.current);
                        setStatus(null);
                      }}
                      onFocus={(e) => {
                        if (e.currentTarget.matches(":focus-visible")) reveal(msg.link!.href);
                      }}
                      onBlur={() => setStatus(null)}
                      onPointerDown={(e) => {
                        if (e.pointerType !== "touch") return;
                        const p = { timer: 0, long: false };
                        p.timer = window.setTimeout(() => {
                          p.long = true;
                          reveal(msg.link!.href);
                        }, 450);
                        press.current = p;
                      }}
                      onPointerUp={() => {
                        if (press.current) window.clearTimeout(press.current.timer);
                      }}
                      onPointerCancel={() => {
                        if (press.current) window.clearTimeout(press.current.timer);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        if (press.current?.long) {
                          press.current = null;
                          return;
                        }
                        press.current = null;
                        onEvent("linkOpen");
                      }}
                    >
                      {msg.link.text}
                    </button>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {msg.attachment ? (
            <div className="mt-4">
              <p className="text-tab-sm font-semibold text-ink-subtle">{t("attachment")}</p>
              <div className="mt-1.5 inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-line bg-surface">
                <button type="button" onClick={() => setPrompt("ask")} className="flex min-w-0 items-center gap-2 px-3 py-2 text-start hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 pointer-coarse:min-h-11">
                  <FileText className="size-5 shrink-0 text-risk-600" aria-hidden />
                  <span className="min-w-0">
                    {/* Cut at the end as on a left-to-right desktop, or the padded name would show its real extension. */}
                    <span dir="ltr" className="block max-w-[12rem] truncate text-tab font-semibold whitespace-pre">
                      {msg.attachment.shown}
                    </span>
                    <span className="block text-tab-sm text-ink-subtle">{msg.attachment.size}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t("attachmentDetails")}
                  aria-expanded={details}
                  onClick={() => {
                    setDetails(!details);
                    if (!details) onEvent("attachInfo");
                  }}
                  className="grid w-10 shrink-0 place-items-center border-s border-line text-ink-muted hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 pointer-coarse:w-11 [&_svg]:size-4"
                >
                  <Info />
                </button>
              </div>
              {details ? (
                <dl className="mt-2 grid max-w-md animate-rise grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-line bg-sunken p-3 text-tab">
                  <dt className="text-ink-subtle">{t("name")}</dt>
                  <dd className="font-mono break-all whitespace-pre-wrap">{msg.attachment.name}</dd>
                  <dt className="text-ink-subtle">{t("type")}</dt>
                  <dd className="font-semibold">{msg.attachment.kind}</dd>
                  <dt className="text-ink-subtle">{t("size")}</dt>
                  <dd>{msg.attachment.size}</dd>
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <p id="mail-status" className="flex h-7 min-w-0 shrink-0 items-center overflow-hidden border-t border-line bg-[#f4f4f7] px-3 font-mono text-[0.6875rem] text-ink-muted" aria-live="polite">
        {status ? <span className="truncate">{status}</span> : <span className="truncate font-sans text-ink-subtle">{msg.link && view === "read" ? t("statusHint") : " "}</span>}
      </p>

      {prompt ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ink/30 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="att-title" aria-describedby="att-body" className="w-full max-w-sm animate-rise rounded-lg border border-line bg-surface p-4 shadow-overlay">
            <div className="flex items-start gap-3">
              <TriangleAlert className={cn("mt-0.5 size-6 shrink-0", prompt === "ran" ? "text-risk-600" : "text-warn-500")} aria-hidden />
              <div className="min-w-0">
                <h3 id="att-title" className="text-caption font-bold">
                  {prompt === "ask" ? t("openTitle") : t("ranTitle")}
                </h3>
                <p id="att-body" className="mt-1 text-tab break-words text-ink-muted">
                  {prompt === "ask" ? t("openBody", { name: msg.attachment?.shown.trim() ?? "" }) : (ranText ?? t("ranBody"))}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {prompt === "ask" ? (
                <>
                  <button ref={safe} type="button" onClick={() => setPrompt(null)} className="h-9 rounded-pill bg-brand-600 px-4 text-tab font-semibold text-brand-on hover:bg-brand-700 pointer-coarse:h-11">
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt("ran");
                      onEvent("attachOpen");
                    }}
                    className="h-9 rounded-pill border border-line-strong px-4 text-tab font-semibold hover:bg-sunken pointer-coarse:h-11"
                  >
                    {t("run")}
                  </button>
                </>
              ) : (
                <button ref={safe} type="button" onClick={() => setPrompt(null)} className="h-9 rounded-pill bg-brand-600 px-4 text-tab font-semibold text-brand-on hover:bg-brand-700 pointer-coarse:h-11">
                  {t("ok")}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
