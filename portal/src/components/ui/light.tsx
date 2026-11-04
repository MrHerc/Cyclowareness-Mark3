"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { readMotion, useMotion } from "@/lib/motion";

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

/**
 * Flies a copy of `source` (an XP pill) into the header XP pill ([data-tour="xp"]), which then bumps.
 * A no-op under Calm or Still, and where no XP pill is on screen (the lesson player has no header).
 */
export function flyToXp(source: HTMLElement | null): Animation | undefined {
  if (!source || typeof source.animate !== "function" || readMotion() !== "full") return;
  const target = document.querySelector<HTMLElement>('[data-tour="xp"]');
  const a = source.getBoundingClientRect();
  const b = target?.getBoundingClientRect();
  if (!target || !b?.width || !a.width) return;
  const ghost = source.cloneNode(true) as HTMLElement;
  for (const el of [ghost, ...ghost.querySelectorAll("[id]")]) el.removeAttribute("id");
  ghost.inert = true;
  // Physical on purpose: rects are viewport coordinates. Below the watermark and the shield (z-80, z-90).
  ghost.style.cssText = `position:fixed;top:${a.top}px;left:${a.left}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:75;pointer-events:none`;
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = Math.min(1, b.height / a.height);
  const fly = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 48}px) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.3 },
    ],
    { duration: 750, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
  );
  fly.oncancel = () => ghost.remove();
  fly.onfinish = () => {
    ghost.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 360, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  };
  return fly;
}
