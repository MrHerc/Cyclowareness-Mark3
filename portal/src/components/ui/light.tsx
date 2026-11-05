"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useMotion } from "@/lib/motion";

// Fixed directions (no Math.random in render), rounded so server and browser print the same style.
const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * 2 * Math.PI;
  const r = i % 2 ? 3 : 4.5;
  return { "--bx": `${(Math.cos(a) * r).toFixed(2)}rem`, "--by": `${(Math.sin(a) * r).toFixed(2)}rem`, animationDelay: `${(i % 3) * 40}ms` } as CSSProperties;
});

/**
 * A one-shot burst of brand and accent particles from the centre of the nearest positioned box; a new `key`
 * replays it. Renders nothing under Calm or Still (or the OS reduced-motion setting).
 */
export function Burst({ className }: { className?: string }) {
  const motion = useMotion();
  if (motion !== "full") return null;
  return (
    <span aria-hidden className={cn("burst", className)}>
      {PARTICLES.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </span>
  );
}

/**
 * The .spotlight layer plus the pointer tracking it needs: place it as the first child of a `relative isolate`
 * card (a server component is fine). Mouse and pen only; touch screens get no listener.
 */
export function Spotlight() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const layer = ref.current;
    const host = layer?.parentElement;
    if (!layer || !host || !window.matchMedia("(pointer: fine)").matches) return;
    // The card's rect is read once per hover (and again after a scroll), not on every move.
    let rect: DOMRect | null = null;
    const forget = () => void (rect = null);
    const move = (e: PointerEvent) => {
      rect ??= host.getBoundingClientRect();
      layer.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      layer.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    host.addEventListener("pointerenter", forget);
    host.addEventListener("pointermove", move);
    window.addEventListener("scroll", forget, { capture: true, passive: true });
    return () => {
      host.removeEventListener("pointerenter", forget);
      host.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", forget, { capture: true });
    };
  }, []);
  return <span ref={ref} aria-hidden className="spotlight" />;
}
