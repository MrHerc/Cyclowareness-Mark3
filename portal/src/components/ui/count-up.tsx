"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { readMotion } from "@/lib/motion";

/**
 * Numbers count up from 0 like the original KPI tiles (a single frame when motion is reduced), grouped in the UI
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
  useEffect(() => {
    const still = readMotion() === "still";
    const start = performance.now();
    const tick = (now: number) => {
      const p = still ? 1 : Math.min(1, (now - start) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else ref.current?.closest(".isolate")?.setAttribute("data-counted", "");
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return (
    <span ref={ref}>{percent ? tc("units.percent", { value: format.number(n) }) : format.number(n)}</span>
  );
}
