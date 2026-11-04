"use client";

import { useSyncExternalStore } from "react";
import { bakuParts } from "@/lib/baku-clock";
import { useMotion } from "@/lib/motion";

/** A media query as a value; false on the server, where the lab shows its boot screen anyway. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Still motion: the learner's Still preference or the OS reduced-motion setting (animations.md §3). */
export function useStill(): boolean {
  return useMotion() === "still";
}

function subscribeTick(cb: () => void) {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
}

/** Whole seconds since the epoch, ticking once a second; 0 on the server. */
export function useSeconds(): number {
  return useSyncExternalStore(subscribeTick, () => Math.floor(Date.now() / 1000), () => 0);
}

/** Baku wall-clock time for the taskbar, by fixed-offset arithmetic (no Intl on the client). */
export function bakuClock(seconds: number): { time: string } {
  return { time: bakuParts(seconds * 1000).time };
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  return `${String(mm).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
