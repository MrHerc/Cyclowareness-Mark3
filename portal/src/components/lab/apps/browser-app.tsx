"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Globe, Lock, Plus, RotateCw, ScanSearch, ShieldAlert, X, FileBadge2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { dirOf } from "@/i18n/config";
import { useClientFormat } from "@/lib/client-format";

export type Cert = { subject: string; org: string | null; altNames: string[]; issuer: string; from: string; to: string; fingerprint: string };
export type BrowserTab = {
  id: string;
  title: string;
  /** What the address bar shows (it may contain look-alike letters). */
  host: string;
  /** The same host as the DNS sees it (punycode for non-Latin letters). */
  ascii: string;
  path: string;
  secure: boolean;
  /** A non-Latin letter hiding in the host, named for the inspect view. */
  mixed?: { char: string; name: string };
  cert?: Cert;
  favicon: ReactNode;
  page: ReactNode;
  reportable?: boolean;
};

/**
 * A browser with tabs, an address bar whose host can be inspected (punycode and mixed alphabets), a padlock
 * that opens the site information and a certificate viewer, and a Report unsafe site button.
 */
export function BrowserApp({
  tabs,
  active,
  onSelect,
  onClose,
  onNewTab,
  onInspect,
  onCert,
  onReport,
  reported,
}: {
  tabs: BrowserTab[];
  active: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onInspect: (id: string) => void;
  onCert: (id: string) => void;
  onReport: (id: string) => void;
  reported: boolean;
}) {
  const t = useTranslations("learner.lab.vm.browser");
  const locale = useLocale();
  const format = useClientFormat();
  // Certificate validity is a Baku day (YYYY-MM-DD), shown in the UI language.
  const day = (d: string) => format.dateTime(new Date(`${d}T12:00:00+04:00`), { dateStyle: "medium" });
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];
  const [pop, setPop] = useState<"info" | "inspect" | "cert" | null>(null);
  const certClose = useRef<HTMLButtonElement>(null);
  // The certificate viewer opens on its close button, without scrolling the page (autoFocus would).
  useEffect(() => {
    if (pop === "cert") certClose.current?.focus({ preventScroll: true });
  }, [pop]);
  const icon = "grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sunken focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:size-11 [&_svg]:size-4";
  if (!tab) return null;
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface">
      <div role="tablist" aria-label={t("tabs")} className="flex h-10 shrink-0 items-end gap-1 overflow-x-auto bg-[#e9e8f0] px-2 pt-1.5">
        {tabs.map((x) => (
          <div key={x.id} className={cn("group flex h-full max-w-[13rem] min-w-[7rem] items-center gap-1 rounded-t-lg pr-1 pl-2.5", x.id === tab.id ? "bg-surface" : "hover:bg-white/50")}>
            <button
              type="button"
              role="tab"
              aria-selected={x.id === tab.id}
              onClick={() => {
                setPop(null);
                onSelect(x.id);
              }}
              className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-tab focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span className="shrink-0 [&_svg]:size-3.5" aria-hidden>
                {x.favicon}
              </span>
              <span className="truncate">{x.title}</span>
            </button>
            <button
              type="button"
              aria-label={t("closeTab", { title: x.title })}
              onClick={() => {
                setPop(null);
                onClose(x.id);
              }}
              className="grid size-6 shrink-0 place-items-center rounded-full text-ink-subtle hover:bg-black/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:size-9 [&_svg]:size-3.5"
            >
              <X />
            </button>
          </div>
        ))}
        <button type="button" onClick={onNewTab} aria-label={t("newTab")} className="mb-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-white/60 pointer-coarse:size-9 [&_svg]:size-4">
          <Plus />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-line px-1.5 py-1.5">
        <span className="hidden items-center @[30rem]:flex" aria-hidden>
          <span className={cn(icon, "opacity-40")}>
            <ArrowLeft />
          </span>
          <span className={cn(icon, "opacity-40")}>
            <ArrowRight />
          </span>
          <span className={cn(icon, "opacity-60")}>
            <RotateCw />
          </span>
        </span>
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-pill bg-sunken pr-3 pl-1 pointer-coarse:h-11">
          <button
            type="button"
            aria-label={t("siteInfo")}
            aria-expanded={pop === "info"}
            disabled={tab.ascii === "newtab"}
            onClick={() => setPop(pop === "info" ? null : "info")}
            className={cn(icon, "size-7 shrink-0 disabled:opacity-40")}
          >
            {tab.secure ? <Lock /> : <Globe />}
          </button>
          <button
            type="button"
            aria-label={`${t("address")}: ${tab.host}${tab.path}. ${t("inspect")}`}
            aria-expanded={pop === "inspect"}
            disabled={tab.ascii === "newtab"}
            onClick={() => {
              setPop(pop === "inspect" ? null : "inspect");
              if (pop !== "inspect") onInspect(tab.id);
            }}
            className="min-w-0 flex-1 truncate rounded-md px-1 text-left font-mono text-tab hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:font-sans disabled:text-ink-subtle"
          >
            {tab.ascii === "newtab" ? (
              t("searchPlaceholder")
            ) : (
              <>
                <span className="text-ink">{tab.host}</span>
                <span className="text-ink-subtle">{tab.path}</span>
              </>
            )}
          </button>
          {tab.ascii !== "newtab" ? <ScanSearch className="size-4 shrink-0 text-ink-subtle" aria-hidden /> : null}
        </div>
        <button
          type="button"
          onClick={() => onReport(tab.id)}
          disabled={!tab.reportable || reported}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border border-risk-100 bg-risk-50 px-2.5 text-tab font-semibold text-risk-700 hover:bg-risk-100 disabled:opacity-45 pointer-coarse:h-11 [&_svg]:size-4"
          aria-label={t("report")}
          title={t("report")}
        >
          <ShieldAlert />
          <span className="hidden @[36rem]:inline">{t("reportShort")}</span>
        </button>
      </div>
      {reported && tab.reportable ? (
        <p role="status" className="shrink-0 bg-safe-50 px-4 py-1.5 text-tab text-safe-700">
          {t("reported")}
        </p>
      ) : null}

      {/* The page is in the learner's language: it reads in that direction inside the left-to-right VM. */}
      <div dir={dirOf(locale)} className="relative min-h-0 flex-1 overflow-y-auto">
        {tab.page}
      </div>

      {pop === "info" ? (
        <Popover onClose={() => setPop(null)} label={t("siteInfo")}>
          <p className="flex items-center gap-2 text-caption font-semibold">
            <Lock className="size-4 text-safe-600" aria-hidden />
            {tab.secure ? t("secure") : t("notSecure")}
          </p>
          <p className="mt-1 text-tab text-ink-muted">{t("secureNote")}</p>
          {tab.cert ? (
            <button
              type="button"
              onClick={() => {
                setPop("cert");
                onCert(tab.id);
              }}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-pill border border-line-strong px-3.5 text-tab font-semibold hover:bg-sunken pointer-coarse:h-11 [&_svg]:size-4"
            >
              <FileBadge2 />
              {t("viewCert")}
            </button>
          ) : null}
        </Popover>
      ) : null}
      {pop === "inspect" ? (
        <Popover onClose={() => setPop(null)} label={t("inspectTitle")}>
          <h3 className="text-caption font-bold">{t("inspectTitle")}</h3>
          <dl className="mt-2 grid gap-2 text-tab">
            <div>
              <dt className="text-ink-subtle">{t("shown")}</dt>
              <dd className="font-mono text-caption break-all">{tab.host}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">{t("real")}</dt>
              <dd className={cn("font-mono text-caption font-semibold break-all", tab.mixed ? "text-risk-700" : "text-ink")}>{tab.ascii}</dd>
            </div>
          </dl>
          <p className={cn("mt-2.5 rounded-md px-2.5 py-2 text-tab", tab.mixed ? "bg-risk-50 text-risk-700" : "bg-safe-50 text-safe-700")}>
            {tab.mixed ? t("mixed", { char: tab.mixed.char, name: tab.mixed.name }) : t("plain")}
          </p>
        </Popover>
      ) : null}
      {pop === "cert" && tab.cert ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/30 p-3">
          <div role="dialog" aria-modal="true" aria-labelledby="cert-title" className="flex max-h-full w-full max-w-md animate-rise flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-overlay">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <FileBadge2 className="size-4.5 text-brand-600" aria-hidden />
              <h3 id="cert-title" className="flex-1 text-caption font-bold">
                {t("certTitle")}
              </h3>
              <button ref={certClose} type="button" onClick={() => setPop(null)} aria-label={t("closeCert")} className={icon}>
                <X />
              </button>
            </div>
            <dl className="grid min-h-0 grid-cols-[auto_1fr] gap-x-3 gap-y-2 overflow-y-auto p-4 text-tab">
              <dt className="text-ink-subtle">{t("issuedTo")}</dt>
              <dd className="font-mono font-semibold break-all">{tab.cert.subject}</dd>
              <dt className="text-ink-subtle">{t("organisation")}</dt>
              <dd className={cn(!tab.cert.org && "text-ink-subtle italic")}>{tab.cert.org ?? t("notIncluded")}</dd>
              <dt className="text-ink-subtle">{t("altNames")}</dt>
              <dd className="font-mono break-all">{tab.cert.altNames.join(", ")}</dd>
              <dt className="text-ink-subtle">{t("issuedBy")}</dt>
              <dd>{tab.cert.issuer}</dd>
              <dt className="text-ink-subtle">{t("validFrom")}</dt>
              <dd className="tabular-nums">{day(tab.cert.from)}</dd>
              <dt className="text-ink-subtle">{t("validTo")}</dt>
              <dd className="tabular-nums">{day(tab.cert.to)}</dd>
              <dt className="text-ink-subtle">SHA-256</dt>
              <dd className="font-mono text-[0.6875rem] break-all text-ink-muted">{tab.cert.fingerprint}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Popover({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div
      role="dialog"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="absolute top-[5.25rem] left-2 z-10 w-[min(22rem,calc(100%-1rem))] animate-rise rounded-lg border border-line bg-surface p-3.5 shadow-overlay pointer-coarse:top-24"
    >
      {children}
    </div>
  );
}
