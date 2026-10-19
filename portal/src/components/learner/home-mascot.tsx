"use client";

import { useEffect, useState } from "react";
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
  tutor?: { slug: string; lessonKey: string };
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
  useEffect(() => {
    const id = setTimeout(() => setTick(1), 600);
    return () => clearTimeout(id);
  }, []);
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
          if (tutor) setOpen(true);
        }}
        className="group relative size-32 shrink-0 cursor-pointer rounded-full focus-visible:outline-offset-4 sm:size-40"
      >
        <Mascot mood={tick ? r.mood : "idle"} gesture={tick ? r.gesture : undefined} gestureKey={tick} act={act} className="size-full animate-float" still={still} />
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
          speak={(text) => narrator.speak(text)}
          voice={tutorVoice}
        />
      ) : null}
    </>
  );
}
