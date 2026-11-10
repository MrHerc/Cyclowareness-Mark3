"use client";

import { useEffect, useId, useMemo, useRef, useSyncExternalStore, type ComponentProps } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Maximize, Minimize, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import type { Scene } from "@/lib/content/types";
import { Select } from "@/components/ui/field";
import { LOCALE_NAMES, dirOf, isLocale, langAttrs } from "@/i18n/config";
import type { SubtitleLanguageOption } from "@/lib/content/subtitle-languages";
import { useClientFormat } from "@/lib/client-format";
import { cn } from "@/lib/cn";
import { speechText } from "@/lib/tts/text";
import { SPEEDS, type Shortcut, type TranscriptLine } from "./controls";
import { useLine, type Captions, type CaptionLoad } from "./captions";
import { volumeIsFixed } from "./narrator";

/** A round icon button of the player header. */
export function HeaderButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn("grid size-10 shrink-0 place-items-center pointer-coarse:size-11 rounded-full text-ink hover:bg-sunken aria-pressed:bg-brand-50 aria-pressed:text-brand-700 [&_svg]:size-4.5", className)} {...props} />;
}

const noSubscribe = () => () => {};
let fixedVolume: boolean | undefined;
const readFixedVolume = () => (fixedVolume ??= volumeIsFixed(new Audio()));

/** Mute (the sound switch) and the narration volume slider; no slider where the volume cannot be set (iOS: the device buttons set it). */
export function VolumeControl({ volume, onVolume, soundOn, onToggleSound, className }: { volume: number; onVolume: (v: number) => void; soundOn: boolean; onToggleSound: () => void; className?: string }) {
  const t = useTranslations("player");
  const format = useClientFormat();
  const fixed = useSyncExternalStore(noSubscribe, readFixedVolume, () => false);
  const Icon = !soundOn || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <HeaderButton onClick={onToggleSound} aria-label={soundOn ? t("soundOff") : t("soundOn")}>
        <Icon className={cn(!soundOn && "text-ink-subtle")} />
      </HeaderButton>
      <input
        hidden={fixed}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={!soundOn}
        onChange={(e) => onVolume(Number(e.target.value))}
        aria-label={t("volume")}
        aria-valuetext={format.number(volume, { style: "percent" })}
        className="h-10 w-full min-w-16 cursor-pointer accent-(--brand) disabled:cursor-default disabled:opacity-50"
      />
    </div>
  );
}

/** Narration speed, 0.75–2, labelled in the interface language's numbers ("1,25×" in az). */
export function SpeedSelect({ value, onChange, className, labelled = false }: { value: number; onChange: (v: number) => void; className?: string; labelled?: boolean }) {
  const t = useTranslations("player");
  const format = useClientFormat();
  const id = useId();
  return (
    <>
      {labelled ? (
        <label htmlFor={id} className="text-caption font-semibold text-ink-muted">
          {t("speedLabel")}
        </label>
      ) : null}
      <Select id={id} value={String(value)} onChange={(e) => onChange(Number(e.target.value))} aria-label={labelled ? undefined : t("speed", { speed: format.number(value) })} className={className}>
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {/* Left-to-right marks, so a right-to-left page does not reorder it to "×1". */}
            {`\u200e${format.number(s)}×\u200e`}
          </option>
        ))}
      </Select>
    </>
  );
}

/**
 * The subtitle language: the narration's own, a stored translation of the lesson, or (with AI Sel on) a
 * language the library does not ship, translated by AI.
 */
export function SubtitleSelect({ value, onChange, stored, more, load }: { value: string; onChange: (v: string) => void; stored: readonly string[]; more: readonly SubtitleLanguageOption[]; load: CaptionLoad }) {
  const t = useTranslations("player");
  const id = useId();
  const statusId = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold text-ink-muted">
        {t("captionLanguage")}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={statusId}>
        <option value="">{t("captionSame")}</option>
        {stored.length ? (
          <optgroup label={t("captionStored")}>
            {stored.map((l) => (
              <option key={l} value={l}>
                {isLocale(l) ? LOCALE_NAMES[l] : l}
              </option>
            ))}
          </optgroup>
        ) : null}
        {more.length ? (
          <optgroup label={t("captionMore")}>
            {more.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name === o.native ? o.name : `${o.name} · ${o.native}`}
              </option>
            ))}
          </optgroup>
        ) : null}
      </Select>
      <p id={statusId} role="status" className={cn("text-caption", load.state === "loading" ? "text-ink-muted" : "text-risk-700", (load.state === "idle" || load.state === "ready") && "sr-only")}>
        {load.state === "loading" ? t("captionLoading") : load.state === "limited" ? t("captionLimited") : load.state === "unavailable" ? t("captionUnavailable") : load.state === "error" ? t("captionError") : null}
        {load.state === "error" || load.state === "limited" ? (
          <button type="button" onClick={load.retry} className="ms-2 font-semibold text-brand-700 underline underline-offset-2">
            {t("captionRetry")}
          </button>
        ) : null}
      </p>
      {value && !stored.includes(value) && load.state === "ready" ? <p className="text-caption text-ink-muted">{t("captionAiNote")}</p> : null}
    </div>
  );
}

const subscribeFullscreen = (fn: () => void) => {
  document.addEventListener("fullscreenchange", fn);
  return () => document.removeEventListener("fullscreenchange", fn);
};

/** The whole page goes full screen (the watermark and protection layers included); hidden where the browser cannot (iPhone). */
export function FullscreenToggle({ className }: { className?: string }) {
  const t = useTranslations("player");
  const state = useSyncExternalStore(subscribeFullscreen, () => (document.fullscreenEnabled ? (document.fullscreenElement ? "on" : "off") : "none"), () => "none");
  if (state === "none") return null;
  return (
    <HeaderButton
      className={className}
      aria-label={state === "on" ? t("exitFullscreen") : t("fullscreen")}
      onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
    >
      {state === "on" ? <Minimize /> : <Maximize />}
    </HeaderButton>
  );
}

const SHORTCUT_KEYS: [Shortcut, string[]][] = [
  ["toggle", ["Space"]],
  ["previous", ["←"]],
  ["next", ["→"]],
  ["mute", ["M"]],
  ["captions", ["C"]],
  ["transcript", ["T"]],
  ["syllabus", ["S"]],
  ["help", ["?"]],
];

/** The shortcut list for the "?" dialog; in a right-to-left page the arrows swap meaning, so they swap rows' keys too. */
export function ShortcutList() {
  const t = useTranslations("player");
  const rtl = dirOf(useLocale()) === "rtl";
  return (
    <dl className="grid gap-2.5">
      {SHORTCUT_KEYS.map(([action, keys]) => (
        <div key={action} className="flex items-center justify-between gap-4">
          <dt className="text-body-sm">{t(`keys.${action}`)}</dt>
          <dd className="flex shrink-0 gap-1">
            {keys.map((k) => (
              <kbd key={k} dir="ltr" className="min-w-8 rounded-md border border-line-strong bg-sunken px-2 py-1 text-center font-mono text-caption font-semibold shadow-xs">
                {k === "Space" ? t("keySpace") : rtl && (k === "←" || k === "→") ? (k === "←" ? "→" : "←") : k}
              </kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Every line read so far in this lesson, grouped by part, in the narration's language with the subtitle language
 * under it; the line being read is marked, and a click reads a line again (plain text when nothing can read it).
 */
export function Transcript({ lines, scenes, contentLocale, captions, onReplay }: { lines: TranscriptLine[]; scenes: Scene[]; contentLocale: string; captions: Captions; onReplay?: (text: string) => void }) {
  const t = useTranslations("player");
  const line = useLine(captions.store);
  const list = useRef<HTMLOListElement>(null);
  const groups = useMemo(() => {
    const by = new Map<number, TranscriptLine[]>();
    for (const l of lines) by.set(l.scene, [...(by.get(l.scene) ?? []), l]);
    return [...by];
  }, [lines]);

  useEffect(() => {
    list.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
  }, [line?.text]);

  if (!lines.length) return <p className="text-body-sm text-ink-muted">{t("transcriptEmpty")}</p>;
  return (
    <ol ref={list} className="grid gap-5">
      {groups.map(([scene, group]) => (
        <li key={scene}>
          <p className="text-tab-sm font-bold tracking-wide text-ink-subtle uppercase">
            {t("step", { current: scene + 1, total: scenes.length })} · {t(`sceneType.${scenes[scene].type}`)}
          </p>
          <ul className="mt-1.5 grid gap-1">
            {group.map((l, k) => {
              const on = line?.text === l.text;
              const translated = captions.lang ? captions.map?.[l.text] : undefined;
              const text = (
                <>
                  <span {...langAttrs(contentLocale)} className="block">
                    {speechText(l.text)}
                  </span>
                  {translated && captions.lang ? (
                    <span {...langAttrs(captions.lang)} className="mt-1 block text-ink-muted">
                      {translated}
                    </span>
                  ) : null}
                </>
              );
              const box = "w-full rounded-lg px-3 py-2 text-start text-body-sm aria-current:bg-brand-50 aria-current:ring-1 aria-current:ring-brand-200";
              return (
                <li key={k}>
                  {onReplay ? (
                    <button type="button" aria-current={on || undefined} onClick={() => onReplay(l.text)} className={cn(box, "group flex items-start gap-2 hover:bg-sunken")}>
                      <span className="sr-only">{t("replay")}: </span>
                      <span className="min-w-0 flex-1">{text}</span>
                      <Play aria-hidden className="mt-0.5 size-3.5 shrink-0 fill-current text-brand-600 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </button>
                  ) : (
                    <p aria-current={on || undefined} className={box}>
                      {text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
