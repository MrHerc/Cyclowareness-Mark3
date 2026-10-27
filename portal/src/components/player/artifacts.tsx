"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  BatteryFull,
  Check,
  ChevronLeft,
  File as FileIcon,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  Info,
  Lock,
  LockOpen,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  PhoneOff,
  Play,
  QrCode,
  Reply,
  Shield,
  Signal,
  Star,
  Wifi,
  WifiOff,
} from "lucide-react";
import type {
  Artifact,
  Brand,
  CallArtifact,
  ChatArtifact,
  DialogArtifact,
  EmailArtifact,
  FileArtifact,
  LoginArtifact,
  NotificationArtifact,
  PermissionArtifact,
  QrArtifact,
  SmsArtifact,
  UrlArtifact,
  WifiArtifact,
} from "@/lib/content/types";
import { plain } from "@/lib/content/types";
import { BrandAvatar } from "./brand-avatar";
import { RichText, langProps, useArtifactMode, useContentLang } from "./rich";
import { cn } from "@/lib/cn";

const BrandsCtx = createContext<Record<string, Brand>>({});
export function BrandsProvider({ brands, children }: { brands: Record<string, Brand>; children: ReactNode }) {
  return <BrandsCtx.Provider value={brands}>{children}</BrandsCtx.Provider>;
}
function useBrand(ref?: string): Brand | null {
  const brands = useContext(BrandsCtx);
  return (ref && brands[ref]) || null;
}

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full overflow-hidden rounded-xl border border-line bg-surface text-start shadow-raised", className)}>{children}</div>;
}

/** `inbox`: shown inside the mailbox simulation (brand back row, "To: me"); otherwise a lesson illustration. */
function EmailView({ a, onBack, inbox = false }: { a: EmailArtifact; onBack?: () => void; inbox?: boolean }) {
  const t = useTranslations("player");
  const brand = useBrand(a.brandRef);
  const { onAttachment } = useArtifactMode();
  const attachmentClass = "flex items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-caption";
  return (
    <Shell>
      {onBack ? (
        <button type="button" onClick={onBack} className="flex w-full items-center gap-2 border-b border-line px-4 py-2.5 text-start text-caption font-semibold text-brand-700 hover:bg-sunken">
          <ChevronLeft className="size-4" />
          {t("simulation.inbox")}
        </button>
      ) : (
        <div className={cn("flex items-center gap-2 border-b border-line px-4 py-2.5 text-caption font-semibold", inbox ? "text-brand-700" : "text-ink-muted")}>
          <ChevronLeft className="size-4" />
          {t("simulation.inbox")}
          {!inbox ? (
            <span aria-hidden className="ms-auto flex items-center gap-2 text-ink-subtle">
              <Star className="size-3.5" />
              <Reply className="size-3.5" />
              <MoreVertical className="size-3.5" />
            </span>
          ) : null}
        </div>
      )}
      <div className="px-5 pt-4 pb-5">
        <RichText value={a.subject} className="text-title-sm font-bold text-ink" as="div" />
        <div className="mt-3 flex items-start gap-3">
          <BrandAvatar brand={brand} name={plain(a.from?.name)} />
          <div className="min-w-0 flex-1 text-caption">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <RichText value={a.from?.name} className="font-semibold text-ink" as="span" />
              {a.time ? <span className="text-tab text-ink-subtle">{a.time}</span> : null}
            </div>
            <RichText value={a.from?.address} className="break-all text-ink-muted" as="span" boldAfterAt />
            {a.to ? <p className="text-tab text-ink-subtle">{t("simulation.to", { to: a.to })}</p> : inbox ? <p className="text-tab text-ink-subtle">{t("simulation.toMe")}</p> : null}
          </div>
        </div>
        <RichText value={a.body} className="mt-4 text-body-sm leading-relaxed text-ink" />
        {a.attachments?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {a.attachments.map((f, i) => {
              const chip = (
                <>
                  <Paperclip className="size-4 text-ink-subtle" />
                  <RichText value={f.name} className="font-semibold" as="span" />
                  {f.size ? <span className="text-tab text-ink-subtle">{f.size}</span> : null}
                </>
              );
              return onAttachment ? (
                <button key={i} type="button" onClick={onAttachment} className={cn(attachmentClass, "text-start hover:border-brand-300 hover:bg-brand-50")}>
                  {chip}
                </button>
              ) : (
                <div key={i} className={attachmentClass}>
                  {chip}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function PhoneFrame({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[22rem] rounded-[2.4rem] border-[10px] border-ink bg-ink p-0 shadow-overlay", className)}>
      <div className={cn("relative min-h-[26rem] overflow-hidden rounded-[1.7rem]", dark ? "bg-[#14112e] text-white" : "bg-canvas")}>
        <div className={cn("flex items-center justify-between px-5 pt-2.5 pb-1 text-tab-sm font-semibold", dark ? "text-white/80" : "text-ink")}>
          <span>09:41</span>
          <span className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-pill bg-ink" />
          <span className="flex items-center gap-1">
            <Signal className="size-3.5" />
            <Wifi className="size-3.5" />
            <BatteryFull className="size-4" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChatView({ a }: { a: ChatArtifact }) {
  const t = useTranslations("player.artifact");
  const brand = useBrand(a.brandRef);
  const whats = a.app === "whatsapp";
  const tele = a.app === "telegram";
  return (
    <PhoneFrame>
      <div className={cn("flex items-center gap-3 px-4 py-3 text-white", whats ? "bg-[#0b7a69]" : tele ? "bg-[#2a8bd0]" : "bg-brand-600")}>
        <ArrowLeft className="size-4" />
        <BrandAvatar brand={brand} name={plain(a.contact)} size="sm" />
        <RichText value={a.contact} className="truncate text-caption font-semibold" as="span" />
      </div>
      <div className={cn("grid gap-2 px-3 py-4", whats ? "bg-[#ece5dd]" : "bg-sunken")}>
        {(a.messages ?? []).map((m, i) => (
          <div key={i} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-caption leading-snug shadow-xs", m.from === "me" ? "ms-auto rounded-ee-sm bg-[#dcf8c6] text-ink" : "rounded-es-sm bg-surface text-ink")}>
            {m.voice ? (
              <span className="flex items-center gap-2 text-ink-muted">
                <Play className="size-4 fill-current" />
                <span className="h-1 w-24 rounded-pill bg-ink-disabled/50" />
                <Mic className="size-3.5" />
                <span className="sr-only">{t("voiceMessage")}</span>
              </span>
            ) : null}
            <RichText value={m.body} className={cn(m.voice && "mt-1.5 italic")} />
            {m.time ? <span className="mt-1 block text-end text-[0.65rem] text-ink-subtle">{m.time}</span> : null}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function SmsView({ a }: { a: SmsArtifact }) {
  const brand = useBrand(a.brandRef);
  return (
    <PhoneFrame>
      <div className="flex flex-col items-center gap-1 border-b border-line bg-surface px-4 py-3">
        <BrandAvatar brand={brand} name={plain(a.sender)} size="sm" />
        <RichText value={a.sender} className="text-caption font-semibold" as="span" />
      </div>
      <div className="grid gap-2 px-3 py-4">
        {a.time ? <p className="text-center text-[0.65rem] text-ink-subtle">{a.time}</p> : null}
        {(a.messages ?? []).map((m, i) => (
          <div key={i} className="max-w-[85%] rounded-2xl rounded-es-sm bg-surface px-3.5 py-2.5 text-caption leading-snug shadow-xs">
            <RichText value={m} />
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function DialogView({ a }: { a: DialogArtifact }) {
  const lang = useContentLang();
  const tone = a.tone ?? "app";
  const Icon = tone === "warning" ? AlertTriangle : tone === "system" ? Shield : Info;
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-surface p-5 text-start shadow-overlay">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone === "warning" ? "bg-warn-50 text-warn-700" : tone === "system" ? "bg-brand-50 text-brand-600" : "bg-sunken text-ink-muted")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <RichText value={a.title} className="text-body font-semibold" />
          <RichText value={a.body} className="mt-1 text-caption text-ink-muted" />
        </div>
      </div>
      {a.buttons?.length ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2" {...langProps(lang)}>
          {a.buttons.map((b, i) => (
            <span key={i} className={cn("rounded-pill px-4 py-2 text-caption font-semibold", i === a.buttons!.length - 1 ? "bg-brand-600 text-brand-on" : "border border-line-strong text-ink")}>
              {b}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrowserBar({ url, secure }: { url: ReactNode; secure: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
      <span className="flex gap-1.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-risk-500/70" />
        <span className="size-2.5 rounded-full bg-warn-500/70" />
        <span className="size-2.5 rounded-full bg-safe-500/70" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-pill bg-surface px-3 py-1.5 text-caption">
        {secure ? <Lock className="size-3.5 shrink-0 text-ink-subtle" /> : <LockOpen className="size-3.5 shrink-0 text-risk-600" />}
        <div dir="ltr" className="min-w-0 truncate">
          {url}
        </div>
      </div>
    </div>
  );
}

function LoginView({ a }: { a: LoginArtifact }) {
  const t = useTranslations("player.artifact");
  const lang = useContentLang();
  const brand = useBrand(a.brandRef);
  const urlText = plain(a.url);
  // Fields and button come from the lesson; a lesson that leaves them out gets the interface's own.
  const fieldLang = a.fields ? lang : undefined;
  return (
    <Shell>
      <BrowserBar url={<RichText value={a.url} as="span" ltr />} secure={urlText.startsWith("https")} />
      <div className="grid place-items-center px-6 py-8">
        <div className="w-full max-w-xs">
          <div className="mb-5 flex flex-col items-center gap-2">
            <BrandAvatar brand={brand} name={a.brand} size="lg" />
            <p className="text-body font-bold">{a.brand ?? brand?.name}</p>
          </div>
          <div className="grid gap-2.5">
            {(a.fields ?? [t("emailField"), t("passwordField")]).map((f) => (
              <div key={f} {...langProps(fieldLang)} className="rounded-md border border-line-strong px-3 py-2.5 text-caption text-ink-disabled">
                {f}
              </div>
            ))}
            <span {...langProps(a.button ? lang : undefined)} className="mt-1 rounded-pill py-2.5 text-center text-caption font-semibold text-white" style={{ background: brand?.color ?? "var(--brand)" }}>
              {a.button ?? t("signIn")}
            </span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function UrlView({ a }: { a: UrlArtifact }) {
  const secure = plain(a.url).startsWith("https");
  return (
    <Shell>
      <BrowserBar url={<RichText value={a.url} as="span" className="font-mono text-tab" ltr />} secure={secure} />
      <div className="grid h-32 place-items-center bg-canvas">
        <Globe className="size-10 text-ink-disabled" />
      </div>
    </Shell>
  );
}

function NotificationView({ a }: { a: NotificationArtifact }) {
  const brand = useBrand(a.brandRef);
  return (
    <PhoneFrame dark>
      <div className="px-3 pt-10">
        <div className="rounded-2xl bg-white/92 p-3.5 text-ink shadow-raised backdrop-blur">
          <div className="flex items-center gap-2 text-tab-sm text-ink-muted">
            <BrandAvatar brand={brand} name={a.app} size="sm" className="size-5 text-[0.5rem] [&_svg]:size-3" />
            <span className="font-semibold uppercase">{a.app ?? brand?.name}</span>
            <span className="ms-auto">{a.time}</span>
          </div>
          <RichText value={a.title} className="mt-1.5 text-caption font-semibold" />
          <RichText value={a.body} className="text-caption text-ink-muted" />
        </div>
      </div>
    </PhoneFrame>
  );
}

function PermissionView({ a }: { a: PermissionArtifact }) {
  const t = useTranslations("player.artifact");
  const brand = useBrand(a.brandRef);
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-line bg-surface p-5 text-start shadow-overlay">
      <div className="flex items-center gap-3">
        <BrandAvatar brand={brand} name={a.app} />
        <p className="text-body-sm font-semibold">{t("permissionsTitle", { app: a.app ?? brand?.name ?? "" })}</p>
      </div>
      <ul className="mt-4 grid gap-2">
        {(a.permissions ?? []).map((p, i) => (
          <li key={i} className="flex items-center gap-2.5 rounded-md bg-sunken px-3 py-2.5 text-caption">
            {p.needed ? <Check className="size-4 text-safe-600" /> : <AlertTriangle className="size-4 text-warn-500" />}
            <RichText value={p.label} as="span" />
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2 text-caption font-semibold">
        <span className="rounded-pill border border-line-strong px-4 py-2">{t("deny")}</span>
        <span className="rounded-pill bg-brand-600 px-4 py-2 text-brand-on">{t("allow")}</span>
      </div>
    </div>
  );
}

/** Animated voice bars shown while someone on the line is being narrated. */
export function SpeakingBars({ active, className }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-5 items-end gap-0.5", className)}>
      {[0, 1, 2, 3, 4].map((k) => (
        <span
          key={k}
          className={cn("w-1 rounded-pill bg-current transition-[height] duration-(--duration-base)", active && "animate-pulse")}
          style={{ height: active ? `${[55, 100, 70, 90, 45][k]}%` : "20%", animationDelay: `${k * 120}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

/**
 * Incoming-call screen. `status` replaces the "Incoming call" line (a call in progress) and
 * `talking` shows the voice bars under the caller while the line is narrated.
 */
export function CallView({ a, status, talking }: { a: CallArtifact; status?: string; talking?: boolean }) {
  const t = useTranslations("player");
  const lang = useContentLang();
  const brand = useBrand(a.brandRef);
  const live = status !== undefined;
  return (
    <PhoneFrame dark>
      <div className="flex min-h-[23rem] flex-col items-center px-6 pt-10 pb-8 text-center">
        <p className="text-tab text-white/70">{status ?? t("simulation.incoming")}</p>
        <BrandAvatar brand={brand} name={plain(a.caller)} size="lg" className={cn("mt-6 size-20 text-title ring-4 transition-shadow", talking ? "ring-safe-500/70" : "ring-white/10")} />
        <RichText value={a.caller} className="mt-4 text-title-sm font-semibold" />
        <RichText value={a.number} className="mt-1 text-caption text-white/70" ltr />
        {a.label ? (
          <p className="text-tab text-white/50" {...langProps(lang)}>
            {a.label}
          </p>
        ) : null}
        {talking !== undefined ? <SpeakingBars active={talking} className="mt-3 text-safe-500" /> : null}
        <div className="mt-auto flex w-full justify-around pt-10">
          <span className="grid size-14 place-items-center rounded-full bg-risk-500">
            <PhoneOff className="size-6" />
          </span>
          {live ? null : (
            <span className="grid size-14 animate-pulse place-items-center rounded-full bg-safe-500">
              <Phone className="size-6" />
            </span>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

const FILE_ICONS: Record<string, typeof FileIcon> = {
  zip: FileArchive, rar: FileArchive, "7z": FileArchive, iso: FileArchive, img: FileArchive,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, xlsm: FileSpreadsheet, csv: FileSpreadsheet,
  js: FileCode2, vbs: FileCode2, ps1: FileCode2, hta: FileCode2, exe: FileCode2, scr: FileCode2, lnk: FileCode2, bat: FileCode2, html: FileCode2, htm: FileCode2,
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText,
};

function FileView({ a }: { a: FileArtifact }) {
  const t = useTranslations("player.artifact");
  const lang = useContentLang();
  const name = plain(a.name);
  const Icon = FILE_ICONS[name.toLowerCase().split(".").pop() ?? ""] ?? FileIcon;
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-surface p-5 text-start shadow-raised">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <RichText value={a.name} className="text-body-sm font-semibold break-all" />
          <p className="text-tab text-ink-subtle" {...langProps(lang)}>
            {[a.type, a.size].filter(Boolean).join(" · ")}
          </p>
          {a.source ? (
            <p className="mt-1 text-tab text-ink-muted">
              {t("fileSource")} <RichText value={a.source} as="span" />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QrView({ a }: { a: QrArtifact }) {
  const t = useTranslations("player.artifact");
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-line bg-surface p-5 text-center shadow-raised">
      <div className="mx-auto grid size-40 place-items-center rounded-lg border-4 border-ink bg-white">
        <QrCode className="size-32 text-ink" strokeWidth={1.2} />
      </div>
      <RichText value={a.caption} className="mt-4 text-body-sm font-semibold" />
      {a.destination ? (
        <div className="mt-3 rounded-md bg-sunken px-3 py-2 text-caption">
          <span className="text-tab-sm font-semibold text-ink-subtle uppercase">{t("scanToOpen")}</span>
          <RichText value={a.destination} className="font-mono text-tab break-all" ltr />
        </div>
      ) : null}
    </div>
  );
}

function WifiView({ a }: { a: WifiArtifact }) {
  const t = useTranslations("player.artifact");
  return (
    <PhoneFrame>
      <div className="px-4 py-4">
        <p className="mb-3 text-body-sm font-bold">{t("networks")}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-xs">
          {a.networks.map((n, i) => (
            <li key={i} className="flex items-center gap-3 px-3.5 py-3 text-caption">
              {n.signal > 0 ? <Wifi className={cn("size-4.5", n.signal >= 3 ? "text-ink" : "text-ink-subtle")} /> : <WifiOff className="size-4.5 text-ink-disabled" />}
              <RichText value={n.ssid} className="min-w-0 flex-1 font-semibold" as="span" />
              {n.secured ? (
                <span className="inline-flex items-center gap-1 text-tab-sm text-ink-subtle">
                  <Lock className="size-3.5" />
                  {t("secured")}
                </span>
              ) : (
                <span className="text-tab-sm font-semibold text-warn-700">{t("open_network")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </PhoneFrame>
  );
}

/** `onBack` turns an email's "‹ Inbox" row into a back button; `inbox` marks the mailbox simulation. */
export function ArtifactView({ artifact, onBack, inbox }: { artifact: Artifact; onBack?: () => void; inbox?: boolean }) {
  switch (artifact.kind) {
    case "email":
      return <EmailView a={artifact as EmailArtifact} onBack={onBack} inbox={inbox} />;
    case "chat":
      return <ChatView a={artifact as ChatArtifact} />;
    case "sms":
      return <SmsView a={artifact as SmsArtifact} />;
    case "dialog":
      return <DialogView a={artifact as DialogArtifact} />;
    case "login":
      return <LoginView a={artifact as LoginArtifact} />;
    case "url":
      return <UrlView a={artifact as UrlArtifact} />;
    case "notification":
      return <NotificationView a={artifact as NotificationArtifact} />;
    case "permission":
      return <PermissionView a={artifact as PermissionArtifact} />;
    case "call":
      return <CallView a={artifact as CallArtifact} />;
    case "file":
      return <FileView a={artifact as FileArtifact} />;
    case "qr":
      return <QrView a={artifact as QrArtifact} />;
    case "wifi":
      return <WifiView a={artifact as WifiArtifact} />;
    default:
      return null;
  }
}

/** Small list row used by the inbox simulation. */
export function EmailListItem({ a, active, done, onClick }: { a: EmailArtifact; active: boolean; done: boolean; onClick?: () => void }) {
  const lang = useContentLang();
  const brand = useBrand(a.brandRef);
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={cn("flex w-full items-start gap-3 border-b border-line px-3 py-3 text-start transition-colors", active ? "bg-brand-50" : "hover:bg-sunken", !onClick && "cursor-default")}>
      <span className={cn("mt-2 size-2 shrink-0 rounded-full", done ? "bg-transparent" : "bg-brand-600")} />
      <BrandAvatar brand={brand} name={plain(a.from?.name)} size="sm" />
      <span className="min-w-0 flex-1" {...langProps(lang)}>
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-caption", done ? "text-ink-muted" : "font-semibold text-ink")}>{plain(a.from?.name)}</span>
          <span className="shrink-0 text-tab-sm text-ink-subtle">{a.time}</span>
        </span>
        <span className="block truncate text-tab font-semibold text-ink">{plain(a.subject)}</span>
        <span className="block truncate text-tab text-ink-subtle">{plain(a.body).slice(0, 80)}</span>
      </span>
      <Star className="mt-1 size-3.5 shrink-0 text-ink-disabled" />
    </button>
  );
}

