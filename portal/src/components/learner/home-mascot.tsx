"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import { TutorPanel } from "@/components/player/tutor-panel";
import { useNarrator } from "@/components/player/narrator";

const REACTIONS: { mood: MascotMood; gesture: MascotGesture }[] = [
  { mood: "happy", gesture: "wave" },
  { mood: "excited", gesture: "hop" },
  { mood: "proud", gesture: "shield-up" },
  { mood: "laughing", gesture: "cheer" },
  { mood: "curious", gesture: "ponder" },
];

// Left alone, the mascot eats an apple, then naps; a hover or click wakes it and the wait starts over.
const APPLE_MS = 45_000;
const NAP_MS = 180_000;
// The tap reaction plays before the tutor dialog (and its backdrop) covers the mascot.
const OPEN_DELAY_MS = 600;

/** Home greeting mascot: waves on arrival, reacts when tapped and opens the voice tutor. */
export function HomeMascot({
  label,
  still,
  tutor,
  soundOn,
  tutorVoice = true,
}: {
  label: string;
  still?: boolean;
  /** The lesson the tutor answers about; `contentLocale` is the language of its text when known (default: the interface's). */
  tutor?: { slug: string; lessonKey: string; contentLocale?: string };
  soundOn?: boolean;
  /** The tenant's "tutor_voice" feature: microphone input and spoken answers. */
  tutorVoice?: boolean;
}) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState<"rest" | "apple" | "nap">("rest");
  const [woke, setWoke] = useState(0);
  const locale = useLocale();
  const narrator = useNarrator({ enabled: soundOn ?? true, rate: 1, lang: locale });
  const opening = useRef<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setTick(1), 600);
    return () => {
      clearTimeout(id);
      if (opening.current !== null) window.clearTimeout(opening.current);
    };
  }, []);
  // Without motion there is no reaction to wait for: the dialog opens at once.
  const openTutor = () => {
    if (opening.current !== null) return;
    if (still || document.documentElement.dataset.motion === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setOpen(true);
    opening.current = window.setTimeout(() => {
      opening.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };
  // The idle acts are timed from the last wake; none when motion is off.
  useEffect(() => {
    if (still) return;
    const apple = window.setTimeout(() => setAct("apple"), APPLE_MS);
    const nap = window.setTimeout(() => setAct("nap"), NAP_MS);
    return () => {
      window.clearTimeout(apple);
      window.clearTimeout(nap);
    };
  }, [still, woke]);
  const wake = () => {
    setAct("rest");
    setWoke((x) => x + 1);
  };
  const r = REACTIONS[i % REACTIONS.length];
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup={tutor ? "dialog" : undefined}
        onPointerEnter={wake}
        onClick={() => {
          wake();
          setI((x) => x + 1);
          setTick((x) => x + 1);
          if (tutor) openTutor();
        }}
        className="group relative size-32 shrink-0 cursor-pointer rounded-full focus-visible:outline-offset-4 sm:size-40"
      >
        {/* Behind the open dialog the cat holds still (one animation loop less). */}
        <Mascot mood={tick ? r.mood : "idle"} gesture={tick ? r.gesture : undefined} gestureKey={tick} act={act} className="size-full animate-float" still={still || open} />
      </button>
      {tutor ? (
        <TutorPanel
          open={open}
          onClose={() => {
            narrator.stop();
            setOpen(false);
          }}
          slug={tutor.slug}
          lessonKey={tutor.lessonKey}
          sceneId={null}
          contentLocale={tutor.contentLocale}
          speak={(text, lang) => narrator.speak(text, { lang })}
          speaking={narrator.speaking}
          voice={tutorVoice}
          soundOn={soundOn ?? true}
        />
      ) : null}
    </>
  );
}
