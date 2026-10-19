"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Mascot, angleBetween } from "@/components/mascot/mascot";
import type { MascotGesture } from "@/components/mascot/mapping";
import { CHAPTERS, type Chapter, type GuideTiming, type LandingCopy, type Line } from "@/lib/landing";
import { cn } from "@/lib/cn";
import { GuideProvider, useGuide } from "./guide";
import { unmark } from "./marked";
import { AdminDemo, DemoForm, DeployDemo, InboxGame, LanguagesDemo, PhoneCall, TutorDemo } from "./scenes";

type Countries = { priority: { code: string; name: string }[]; all: { code: string; name: string }[] };

export function LandingTour(props: { copy: LandingCopy; guide: GuideTiming; lang: string; countries: Countries; privacyLabel: string }) {
  return (
    <GuideProvider lang={props.lang} memoryDays={props.guide.memoryDays}>
      <Tour {...props} />
    </GuideProvider>
  );
}

// Attract moves that stay gestures; look, knock, whisper and hop use the mascot's native inputs (see `sayMove`).
const MOVE_GESTURE: Record<string, MascotGesture> = { "lean-in": "lean-in", ponder: "ponder", wave: "wave" };
const NAP_MS = 120_000; // idle on the hero before the guide naps
const TRAVEL_MS = 700; // the walk between chapters

function timeOfDay(): "morning" | "day" | "evening" | "night" {
  const h = new Date().getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "day" : h < 23 ? "evening" : "night";
}

function Tour({ copy, guide: timing, lang, countries, privacyLabel }: { copy: LandingCopy; guide: GuideTiming; lang: string; countries: Countries; privacyLabel: string }) {
  const guide = useGuide();
  const [current, setCurrent] = useState<Chapter>("hero");
  const [seen, setSeen] = useState<Set<Chapter>>(new Set(["hero"]));
  const [you, setYou] = useState<{ clicked: number; reported: number; learned: number } | null>(null);
  const sections = useRef<Map<Chapter, HTMLElement>>(new Map());
  const interacted = useRef(false);
  const introduced = useRef<Set<Chapter>>(new Set());
  const [inbox, phone, tutor, languages, admin, deploy, demo] = copy.scenes;
  const index = CHAPTERS.indexOf(current);
  const guideRef = useRef(guide);
  const currentRef = useRef(current);
  const lastActivity = useRef(0);
  const nudged = useRef(false);
  const nudgeTimer = useRef<number | null>(null);
  const heroMascot = useRef<HTMLButtonElement>(null);
  // Set by the activity effect below, so hovering the mascot counts as activity too.
  const activity = useRef<() => void>(() => {});

  useEffect(() => {
    guideRef.current = guide;
    currentRef.current = current;
  });

  /** Where the hero phone is from the hero mascot, for the "look" move. */
  const aimAtPhone = (): { angle: number } | null => {
    const phone = sections.current.get("hero")?.querySelector('[data-spot="hero-phone"]');
    return heroMascot.current && phone ? { angle: angleBetween(heroMascot.current, phone) } : null;
  };

  // Attract moves from the content on the mascot's native inputs where it has them; the rest stay gestures.
  const sayMove = (move: string, line: Line) => {
    const g = guideRef.current;
    if (move === "look") g.say(line, { aim: aimAtPhone() });
    else if (move === "knock") g.say(line, { move: "knock" });
    else if (move === "whisper") g.say(line, { whisper: true });
    else if (move === "hop") g.say(line, { move: "bounce" });
    else g.say(line, { gesture: MOVE_GESTURE[move] ?? "wave" });
  };

  // The nudge comes after `nudgeSeconds` without any activity, and never over a line that is still playing.
  const arm = useCallback(
    function arm() {
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      const check = () => {
        const g = guideRef.current;
        if (nudged.current || currentRef.current === "demo") return;
        if (Date.now() - lastActivity.current < timing.nudgeSeconds * 1000 - 50) return arm();
        if (g.busy()) {
          nudgeTimer.current = window.setTimeout(check, 2000);
          return;
        }
        nudged.current = true;
        g.say(copy.attract.nudge, { move: "tap" });
      };
      nudgeTimer.current = window.setTimeout(check, timing.nudgeSeconds * 1000);
    },
    [timing.nudgeSeconds, copy.attract.nudge],
  );

  // Activity re-arms the nudge and the nap (the guide naps after a while idle on the hero; any activity wakes it).
  useEffect(() => {
    lastActivity.current = Date.now();
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    let napTimer: number | null = null;
    const armNap = () => {
      if (napTimer !== null) window.clearTimeout(napTimer);
      napTimer = window.setTimeout(() => {
        if (currentRef.current === "hero") guideRef.current.setAct("nap");
      }, NAP_MS);
    };
    const onActivity = () => {
      lastActivity.current = Date.now();
      nudged.current = false;
      arm();
      guideRef.current.setAct("rest");
      armNap();
    };
    activity.current = onActivity;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    armNap();
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      if (napTimer !== null) window.clearTimeout(napTimer);
    };
  }, [arm]);

  // Reaching another chapter sends the guide walking the way the page scrolled, with its depart and arrive.
  const lastIndex = useRef(index);
  useEffect(() => {
    const from = lastIndex.current;
    lastIndex.current = index;
    if (from === index) return;
    const g = guideRef.current;
    g.setTravel(index > from ? "right" : "left");
    const id = window.setTimeout(() => g.setTravel(null), TRAVEL_MS);
    return () => window.clearTimeout(id);
  }, [index]);

  const scrollTo = useCallback((c: Chapter) => {
    sections.current.get(c)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);

  // Which chapter is on screen; entering one for the first time plays its bridge, intro and prompt.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const c = (visible.target as HTMLElement).dataset.chapter as Chapter;
        setCurrent(c);
        setSeen((s) => (s.has(c) ? s : new Set(s).add(c)));
      },
      { threshold: [0.35, 0.6] },
    );
    sections.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (current === "hero" || introduced.current.has(current)) return;
    introduced.current.add(current);
    interacted.current = true;
    const b = copy.tour.beats[current];
    const entry = current === "phone" ? phone.ring : current === "demo" ? demo.invite : undefined;
    guide.say([b.bridge, b.intro, entry, b.prompt].filter((x): x is Line => !!x), { gesture: "present" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Attract mode on the hero: greeting and the hero beats, then a few idle lines with gestures; the nudge is armed once the opening has played.
  useEffect(() => {
    const m = guide.memory();
    guide.remember({ visits: (m?.visits ?? 0) + 1 });
    const greeting = m ? copy.rapport.returning[m.score === null ? "none" : m.score / Math.max(1, m.total) >= 0.99 ? "high" : m.score / Math.max(1, m.total) >= 0.6 ? "mid" : "low"] : (copy.attract.greetings[timeOfDay()] ?? copy.attract.greeting);
    const timers: number[] = [];
    let said = 0;
    const idle = () => {
      if (interacted.current || said >= timing.attractMaxLines) return;
      const pick = copy.attract.idle[said % copy.attract.idle.length];
      said++;
      sayMove(pick.move, pick.line);
      const gap = (timing.attractMinGapSeconds + Math.random() * (timing.attractMaxGapSeconds - timing.attractMinGapSeconds)) * 1000;
      timers.push(window.setTimeout(idle, gap));
    };
    timers.push(
      window.setTimeout(() => {
        if (interacted.current) return;
        guide.say([...copy.tour.frame, greeting, copy.tour.beats.hero.intro, inbox.arrived, copy.tour.beats.hero.prompt].filter((x): x is Line => !!x), {
          gesture: "wave",
          then: () => {
            timers.push(window.setTimeout(idle, timing.attractMinGapSeconds * 1000));
            arm();
          },
        });
      }, timing.attractFirstSeconds * 1000),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markInteracted = () => {
    interacted.current = true;
  };

  const chapterSection = (c: Chapter, headline: string | null, line: string | null, body: React.ReactNode, tone: "plain" | "tint" = "plain") => (
    <section
      key={c}
      id={c}
      data-chapter={c}
      ref={(el) => {
        if (el) sections.current.set(c, el);
      }}
      aria-labelledby={headline ? `${c}-title` : undefined}
      className={cn("relative scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28", tone === "tint" && "bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--brand)_5%,transparent))]")}
    >
      <div className="mx-auto grid max-w-6xl gap-10">
        {headline ? (
          <header className="mx-auto max-w-2xl text-center">
            <p className="text-tab font-bold tracking-[0.2em] text-brand-600 uppercase">
              {CHAPTERS.indexOf(c) + 1} · {copy.tour.chapters[c]}
            </p>
            <h2 id={`${c}-title`} className="mt-3 font-display text-headline font-bold text-balance">
              {headline}
            </h2>
            {line ? <p className="mt-3 text-lead text-ink-muted">{line}</p> : null}
          </header>
        ) : null}
        {body}
      </div>
    </section>
  );

  return (
    <div onPointerDownCapture={markInteracted} onKeyDownCapture={markInteracted}>
      {/* 1 · Hero: the phone with the message */}
      <section
        id="hero"
        data-chapter="hero"
        ref={(el) => {
          if (el) sections.current.set("hero", el);
        }}
        aria-label={copy.tour.chapters.hero}
        className="relative overflow-hidden px-4 pt-6 pb-20 sm:px-8"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_60%,black,transparent_70%)] opacity-60" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 origin-bottom [transform:perspective(600px)_rotateX(60deg)] [background-image:linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_top,black,transparent)] opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 grid gap-6 lg:order-1">
            <h1 className="sr-only">{copy.hero.question}</h1>
            <p className="max-w-md text-lead text-ink-muted">{copy.hero.sub}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => scrollTo("demo")} className="h-12 rounded-pill bg-brand-600 px-6 font-bold text-brand-on shadow-raised hover:bg-brand-700">
                {copy.hero.demo}
              </button>
              <button type="button" onClick={() => scrollTo("phone")} className="inline-flex h-12 items-center gap-2 rounded-pill px-5 font-semibold text-ink-muted ring-1 ring-line hover:bg-sunken hover:text-ink">
                {copy.ui.next}
                <ArrowDown className="size-4" />
              </button>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <InboxGame
              scene={inbox}
              beats={copy.tour.beats.hero}
              fastSeconds={timing.fastSeconds}
              question={copy.hero.question}
              rapport={{ score: copy.rapport.score, fast: copy.rapport.fast }}
              screenLabel={copy.ui.screenLabel}
              mascot={
                <button
                  ref={heroMascot}
                  type="button"
                  onClick={() => guide.say(guide.caption ? guide.caption.line : [...copy.tour.frame, copy.attract.greeting], { gesture: "wave" })}
                  onPointerEnter={() => {
                    activity.current();
                    guide.move("touch");
                  }}
                  aria-label={copy.attract.tapPrompt}
                  className="absolute top-[48%] -right-3 z-10 size-20 sm:-right-12 sm:size-28"
                >
                  <Mascot
                    mood={guide.mood}
                    talking={guide.talking}
                    gesture={guide.gesture?.name}
                    gestureKey={guide.gesture?.key}
                    guide={guide.pose}
                    aim={guide.aim}
                    fire={guide.fire ?? undefined}
                    act={guide.act}
                    label={copy.ui.captionLabel}
                    className="size-full"
                  />
                </button>
              }
              onDone={(score, total) => setYou({ clicked: Math.round(((total - score) / total) * 100), reported: Math.round((score / total) * 100), learned: 100 })}
              onRole={(role) => {
                const next: Chapter = role === "security" ? "deploy" : role === "people" ? "phone" : role === "leader" ? "admin" : "phone";
                guide.say(copy.rapport.role[role as "security"], { gesture: "point-down", then: () => scrollTo(next) });
              }}
            />
          </div>
        </div>
      </section>

      {chapterSection("phone", phone.headline, phone.line, <PhoneCall scene={phone} beats={copy.tour.beats.phone} clock={inbox.clock} screenLabel={copy.ui.screenLabel} />, "tint")}
      {chapterSection("tutor", tutor.headline, tutor.line, <TutorDemo scene={tutor} beats={copy.tour.beats.tutor} />)}
      {chapterSection("languages", languages.headline, languages.line, <LanguagesDemo scene={languages} beats={copy.tour.beats.languages} />, "tint")}
      {chapterSection("admin", admin.headline, admin.line, <AdminDemo scene={admin} beats={copy.tour.beats.admin} you={you} />)}
      {chapterSection("deploy", deploy.headline, deploy.line, <DeployDemo scene={deploy} beats={copy.tour.beats.deploy} />, "tint")}
      {chapterSection("demo", demo.headline, demo.line, <DemoForm scene={demo} lang={lang} countries={countries} privacyLabel={privacyLabel} />)}

      <GuideDock copy={copy} current={current} index={index} seen={seen} showMascot={current !== "hero"} onNext={() => scrollTo(CHAPTERS[Math.min(index + 1, CHAPTERS.length - 1)])} onSkip={() => scrollTo("demo")} />
    </div>
  );
}

/** Floating guide: mascot + caption (karaoke) + the tour control pill. */
function GuideDock({
  copy,
  current,
  index,
  seen,
  showMascot,
  onNext,
  onSkip,
}: {
  copy: LandingCopy;
  current: Chapter;
  index: number;
  seen: Set<Chapter>;
  /** False on the hero, where the guide peeks from the phone instead. */
  showMascot: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const guide = useGuide();
  const words = useMemo(() => (guide.caption ? unmark(guide.caption.line.text).split(/\s+/) : []), [guide.caption]);
  const last = index === CHAPTERS.length - 1;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
      {guide.caption ? (
        <div className="pointer-events-auto flex w-full max-w-xl items-end gap-2" aria-live="polite">
          {showMascot ? (
            <button
              type="button"
              onClick={() => guide.say(guide.caption!.line)}
              onPointerEnter={() => guide.move("touch")}
              aria-label={copy.attract.tapPrompt}
              className="relative -mb-1 size-20 shrink-0 sm:size-24"
            >
              <Mascot
                mood={guide.mood}
                talking={guide.talking}
                gesture={guide.gesture?.name}
                gestureKey={guide.gesture?.key}
                guide={guide.pose}
                aim={guide.aim}
                fire={guide.fire ?? undefined}
                act={guide.act}
                className="size-full"
                label={copy.ui.captionLabel}
              />
            </button>
          ) : null}
          <div className="mb-2 min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 shadow-overlay ring-1 ring-line">
            <p className="text-tab-sm font-bold tracking-wider text-ink-subtle uppercase">{guide.caption.line.voice === "caller" ? copy.scenes[1].callerLabel : copy.ui.captionLabel}</p>
            <p className="mt-0.5 text-body-sm">
              {words.map((w, i) => (
                <span key={i} className={cn("transition-colors", guide.talking && i <= guide.caption!.word ? "text-ink" : guide.talking ? "text-ink-subtle" : "text-ink")}>
                  {w}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : null}
      <nav aria-label={copy.tour.railLabel} className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-pill bg-surface/95 py-2 pr-2 pl-5 shadow-overlay ring-1 ring-line backdrop-blur">
        <ol className="flex min-w-0 flex-1 gap-1" aria-label={copy.tour.railLabel}>
          {CHAPTERS.map((c, i) => (
            <li key={c} className="flex-1">
              <span className={cn("block h-1.5 rounded-pill transition-colors", i === index ? "bg-brand-600" : seen.has(c) ? "bg-brand-200" : "bg-sunken")} aria-label={`${copy.tour.chapters[c]}${seen.has(c) ? ` · ${copy.tour.doneLabel}` : ""}`} />
            </li>
          ))}
        </ol>
        <p className="shrink-0 text-caption font-semibold whitespace-nowrap">
          {copy.tour.chapters[current]} <span className="text-ink-subtle tabular-nums">{index + 1}/7</span>
        </p>
        <button
          type="button"
          onClick={() => {
            const q = !guide.quiet;
            guide.setQuiet(q);
            if (q) guide.say({ id: "quiet-on", text: copy.rapport.quietOn, emotion: "warm", voice: "guide" }, { gesture: "reassure" });
          }}
          aria-pressed={!guide.quiet}
          aria-label={guide.quiet ? copy.ui.quietOff : copy.ui.quiet}
          title={guide.quiet ? copy.ui.quietOff : copy.ui.quiet}
          className={cn("grid size-10 shrink-0 place-items-center rounded-full", guide.quiet ? "bg-sunken text-ink-muted" : "bg-brand-600 text-brand-on")}
        >
          {guide.quiet ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        <button type="button" onClick={onNext} disabled={last} aria-label={copy.ui.next} title={copy.ui.next} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sunken disabled:opacity-40">
          <ArrowDown className="size-5" />
        </button>
        <button type="button" onClick={onSkip} disabled={last} aria-label={copy.ui.skip} title={copy.ui.skip} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sunken disabled:opacity-40">
          <SkipForward className="size-5" />
        </button>
      </nav>
    </div>
  );
}

/** Footer button: clears what this browser remembers about the visitor. */
export function ForgetButton({ label, done }: { label: string; done: string }) {
  const [cleared, setCleared] = useState(false);
  return cleared ? (
    <span role="status" className="text-caption text-safe-700">
      {done}
    </span>
  ) : (
    <button
      type="button"
      onClick={() => {
        try {
          window.localStorage.removeItem("cy-landing");
          window.localStorage.removeItem("cy-landing-quiet");
        } catch {
          /* nothing stored */
        }
        setCleared(true);
      }}
      className="text-caption font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
    >
      {label}
    </button>
  );
}
