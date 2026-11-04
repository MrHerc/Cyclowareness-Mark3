"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircleCheck, CirclePlay, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Scene } from "@/lib/content/types";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { sceneTitle } from "./controls";
import { HeaderButton } from "./media-controls";
import { langProps } from "./rich";

export type SyllabusLesson = { key: string; title: string; minutes: number; completed: boolean };

export type SyllabusProps = {
  slug: string;
  moduleTitle: string;
  lessons: SyllabusLesson[];
  currentKey: string;
  scenes: Scene[];
  /** Language of the scene texts when it differs from the interface's. */
  contentLang?: string;
  /** The scene shown, and the furthest one reached: parts up to it can be opened again, later ones cannot. */
  index: number;
  maxIndex: number;
  playing: boolean;
  onJump: (index: number) => void;
  /** A lesson link or a part was chosen (the drawer closes). */
  onNavigate?: () => void;
};

/** The module's lessons with the current lesson's parts. */
export function SyllabusContents(p: SyllabusProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const done = p.lessons.filter((l) => l.completed).length;
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-body-sm font-bold text-balance">{p.moduleTitle}</p>
        <ProgressBar value={(done / Math.max(1, p.lessons.length)) * 100} size="sm" className="mt-2.5" decorative />
        <p className="mt-1.5 text-caption text-ink-muted">{t("syllabus.lessonsDone", { done, total: p.lessons.length })}</p>
      </div>
      <ol className="grid gap-1">
        {p.lessons.map((l, k) => {
          const current = l.key === p.currentKey;
          const Icon = l.completed ? CircleCheck : current ? CirclePlay : null;
          const row = (
            <>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-tab-sm font-bold", l.completed ? "text-safe-600" : current ? "text-brand-600" : "bg-sunken text-ink-muted")}>
                {Icon ? <Icon className="size-5" /> : k + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-body-sm text-pretty", current ? "font-bold" : "font-semibold")}>{l.title}</span>
                <span className="block text-caption text-ink-muted">
                  {tc("units.min", { count: l.minutes })}
                  {l.completed ? ` · ${t("completed")}` : null}
                </span>
              </span>
            </>
          );
          return (
            <li key={l.key}>
              {current ? (
                <div aria-current="page" className="rounded-xl bg-brand-50/70 p-2 ring-1 ring-brand-100">
                  <div className="flex items-start gap-3 p-1">{row}</div>
                  <SceneList {...p} />
                </div>
              ) : (
                <Link href={`/learn/${p.slug}/${l.key}`} onClick={p.onNavigate} className="flex items-start gap-3 rounded-xl p-3 hover:bg-sunken">
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SceneList(p: SyllabusProps) {
  const t = useTranslations("player");
  return (
    <ol aria-label={t("syllabus.parts")} className="mt-1 grid gap-0.5 border-s-2 border-brand-100 ps-2 ms-4">
      {p.scenes.map((s, i) => {
        const current = p.playing && i === p.index;
        const reachable = p.playing && i <= p.maxIndex;
        const title = sceneTitle(s);
        // A locked part dims its title only: the small type label stays readable (4.5:1), and the lock says the rest.
        const locked = i > p.maxIndex;
        const body = (
          <>
            <span className="block text-tab-sm font-bold tracking-wide text-ink-subtle uppercase">{t(`sceneType.${s.type}`)}</span>
            {title ? (
              <span {...langProps(p.contentLang)} className={cn("line-clamp-2 text-caption", locked ? "text-ink-muted" : "text-ink")}>
                {title}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={s.id}>
            {/* The part jumped to stays a button, so the focus stays on it instead of falling back to the page. */}
            {reachable ? (
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={current ? undefined : () => (p.onJump(i), p.onNavigate?.())}
                className={cn("block w-full rounded-lg px-2.5 py-2 text-start", current ? "cursor-default bg-surface shadow-xs ring-1 ring-brand-200" : "hover:bg-surface")}
              >
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg px-2.5 py-2">
                <span className="min-w-0 flex-1">{body}</span>
                {locked ? (
                  <>
                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
                    <span className="sr-only">{t("syllabus.locked")}</span>
                  </>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** From lg up: the syllabus at the inline start, collapsed to a slim rail when the learner wants the room. */
export function SyllabusAside({ open, onToggle, ...p }: SyllabusProps & { open: boolean; onToggle: () => void }) {
  const t = useTranslations("player");
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  return (
    <aside
      aria-label={t("syllabus.title")}
      className={cn(
        "sticky top-[calc(4rem+var(--safe-top))] hidden h-[calc(100dvh-4rem-var(--safe-top))] shrink-0 flex-col border-e border-line/60 bg-surface/50 lg:flex print:hidden",
        open ? "w-80" : "w-16",
      )}
    >
      <div className={cn("flex items-center gap-2 px-3 py-3", !open && "justify-center")}>
        {open ? <h2 className="min-w-0 flex-1 ps-1 text-caption font-bold tracking-wide text-ink-muted uppercase">{t("syllabus.title")}</h2> : null}
        <HeaderButton onClick={onToggle} aria-expanded={open} aria-label={open ? t("syllabus.collapse") : t("syllabus.expand")}>
          <Icon className="rtl:-scale-x-100" />
        </HeaderButton>
      </div>
      {open ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8">
          <SyllabusContents {...p} />
        </div>
      ) : null}
    </aside>
  );
}
