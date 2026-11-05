"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { useMotion, type Motion } from "@/lib/motion";

/** Length of the count: Calm shortens it, Still shows the value in one frame. */
export const COUNT_MS: Record<Motion, number> = { full: 900, calm: 300, still: 0 };

/**
 * Numbers count up from 0 like the original KPI tiles (shorter under Calm, a single frame under Still), grouped in the UI
 * language; `percent` places the sign as the language does ("42%", "%42", "42 %"). At the end it marks its tile
 * (the nearest .isolate) data-counted, which starts the tile's light pass.
 */
export function CountUp({ value, percent = false }: { value: number; percent?: boolean }) {
  const format = useClientFormat();
  const tc = useTranslations("common");
  // The server and the first client render print the real value (no-JS, slow hydration); the count-up starts after.
  const [n, setN] = useState(value);
  const raf = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const motion = useMotion();
  useEffect(() => {
    const duration = COUNT_MS[motion];
    const start = performance.now();
    const tick = (now: number) => {
      const p = duration ? Math.min(1, (now - start) / duration) : 1;
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else ref.current?.closest(".isolate")?.setAttribute("data-counted", "");
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, motion]);
  return (
    <span ref={ref}>{percent ? tc("units.percent", { value: format.number(n) }) : format.number(n)}</span>
  );
}
