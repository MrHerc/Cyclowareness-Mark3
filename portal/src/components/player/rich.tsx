"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { paragraphs, type Rich, type Span } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/**
 * How an artifact is being shown: plain view, as a "find the signs" hotspot exercise, with a
 * highlighted spot synced to narration, and with the Lens pointing at one hidden detail.
 * `onLink` / `onAttachment` make links and attachment chips clickable (mailbox simulation actions).
 */
export type ArtifactMode = {
  hotspot?: { found: Set<string>; onSpot: (id: string) => void; validSpots: Set<string> };
  highlight?: string | null;
  lens?: { text: string; reveal: string } | null;
  onLink?: () => void;
  onAttachment?: () => void;
};

const Ctx = createContext<ArtifactMode>({});

export function ArtifactModeProvider({ value, children }: { value: ArtifactMode; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useArtifactMode() {
  return useContext(Ctx);
}

/**
 * The language of the lesson text when it is not the interface language (an English lesson shown
 * while its az/ru translation is missing), for `lang` on lesson text; undefined when they match.
 */
const ContentLangCtx = createContext<string | undefined>(undefined);
export const ContentLangProvider = ContentLangCtx.Provider;

export function useContentLang() {
  return useContext(ContentLangCtx);
}

/** `boldFrom`: the part of the text from this index on is bold (an email address after its "@"). */
function SpanView({ span, boldFrom }: { span: Span; boldFrom?: number }) {
  const mode = useArtifactMode();
  const t = useTranslations("player");
  const locale = useLocale();
  const contentLang = useContentLang();
  const spot = span.spot;
  const isHighlight = !!spot && mode.highlight === spot;
  const isFound = !!spot && !!mode.hotspot?.found.has(spot);
  const lensHere = !!mode.lens && mode.lens.text === span.text && (span.reveal ?? span.link?.href) === mode.lens.reveal;
  const text =
    boldFrom === undefined ? (
      span.text
    ) : (
      <>
        {span.text.slice(0, boldFrom)}
        <span className={cn("font-semibold", !isHighlight && !isFound && "text-ink")}>{span.text.slice(boldFrom)}</span>
      </>
    );
  const linkClass = "cursor-pointer font-semibold text-brand-600 underline decoration-1 underline-offset-2";
  const body = span.link ? (
    mode.onLink ? (
      <button type="button" onClick={mode.onLink} className={linkClass} title={span.link.href}>
        {text}
      </button>
    ) : (
      <span className={linkClass} title={span.link.href}>
        {text}
      </span>
    )
  ) : (
    text
  );
  const content = (
    <span
      data-spot={spot}
      className={cn(
        "rounded-[4px] transition-colors duration-(--duration-base)",
        isHighlight && "bg-risk-100 text-risk-700 ring-2 ring-risk-500/40",
        isFound && "bg-risk-100 text-risk-700 ring-2 ring-risk-500",
        lensHere && "relative",
      )}
    >
      {body}
      {lensHere ? (
        <>
          <span aria-hidden className="pointer-events-none absolute -top-3 left-0 z-20 size-11 animate-rise rounded-full border-[3px] border-brand-600 bg-white/30">
            <span className="absolute -right-3 -bottom-2 h-1.5 w-5 rotate-45 rounded-pill bg-ink" />
          </span>
          <span role="tooltip" className="absolute top-full left-0 z-30 mt-2 block w-max max-w-72 animate-rise rounded-md bg-ink px-3 py-2 text-left text-caption leading-snug font-normal text-white shadow-overlay">
            <span className="block text-tab-sm font-semibold text-white/70" lang={contentLang ? locale : undefined}>
              {t("lensActually")}
            </span>
            <span className="font-bold text-white">{mode.lens!.reveal}</span>
          </span>
        </>
      ) : null}
    </span>
  );
  if (mode.hotspot && spot) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          mode.hotspot!.onSpot(spot);
        }}
        className="rounded-[4px] text-left hover:bg-warn-50 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {content}
      </button>
    );
  }
  return content;
}

/** Where each span's bold part starts when everything after the first "@" is bold (see SpanView). */
function boldOffsets(paras: Span[][], on: boolean): (number | undefined)[][] {
  let seenAt = false;
  return paras.map((p) =>
    p.map((s) => {
      if (!on) return undefined;
      if (seenAt) return 0;
      const at = s.text.indexOf("@");
      if (at < 0) return undefined;
      seenAt = true;
      return at + 1;
    }),
  );
}

/** Renders rich text (string, a line of spans or paragraphs of spans). `boldAfterAt` bolds an address's domain. */
export function RichText({ value, className, as: Tag = "div", boldAfterAt = false }: { value: Rich | undefined | null; className?: string; as?: "div" | "span"; boldAfterAt?: boolean }) {
  const lang = useContentLang();
  const paras = paragraphs(value);
  if (!paras.length) return null;
  const bold = boldOffsets(paras, boldAfterAt);
  if (Tag === "span" || paras.length === 1) {
    return (
      <Tag className={className} lang={lang}>
        {paras[0].map((s, i) => (
          <SpanView key={i} span={s} boldFrom={bold[0][i]} />
        ))}
      </Tag>
    );
  }
  return (
    <div className={cn("grid gap-2.5", className)} lang={lang}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.map((s, j) => (
            <SpanView key={j} span={s} boldFrom={bold[i][j]} />
          ))}
        </p>
      ))}
    </div>
  );
}

/** Whether an artifact shows a link the learner can click. */
export function hasLink(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasLink);
  const o = value as Record<string, unknown>;
  if (typeof o.text === "string" && o.link && typeof (o.link as { href?: unknown }).href === "string") return true;
  return Object.values(o).some(hasLink);
}

/** Every detail the Lens can explain in an artifact: spans with a "reveal" or a real link target. */
export function lensTargets(value: unknown): { text: string; reveal: string }[] {
  const out: { text: string; reveal: string }[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.text === "string" && (typeof o.reveal === "string" || (o.link && typeof (o.link as { href?: unknown }).href === "string"))) {
        out.push({ text: o.text, reveal: (o.reveal as string) ?? (o.link as { href: string }).href });
        return;
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.text}|${x.reveal}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Removes TTS stage directions such as <breath> or <short pause> for display. */
export function cleanSpeech(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}
