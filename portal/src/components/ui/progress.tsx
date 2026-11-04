import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Every bar needs an accessible name: pass `label`, or `decorative` when visible text right next to it
 * already states the value (the bar is then hidden from assistive tech instead of announced twice).
 */
type BarName = { label: string; decorative?: never } | { decorative: true; label?: never };

export function ProgressBar({
  value,
  tone = "brand",
  className,
  label,
  decorative,
  size = "md",
  shimmer,
}: {
  value: number;
  tone?: "brand" | "reward" | "safe" | "risk" | "warn" | "white";
  className?: string;
  size?: "sm" | "md" | "lg";
  /** A band of light crossing the fill on a loop (Full motion only), for the one bar that matters on a page. Not on an empty or full bar, nor on white (nothing reads as light on it). */
  shimmer?: boolean;
} & BarName) {
  const v = Math.max(0, Math.min(100, value));
  const fill = {
    brand: "bg-brand-600",
    reward: "bg-reward-500",
    safe: "bg-safe-500",
    risk: "bg-risk-500",
    warn: "bg-warn-500",
    white: "bg-white",
  }[tone];
  // A lighter tint of the fill, so the band reads as light on any tenant colour.
  const sheen = {
    brand: "after:via-brand-200/70",
    reward: "after:via-reward-100/70",
    safe: "after:via-safe-50/70",
    risk: "after:via-risk-50/70",
    warn: "after:via-warn-50/70",
    white: "",
  }[tone];
  const track = tone === "white" ? "bg-white/25" : "bg-sunken";
  const lit = shimmer && tone !== "white" && v > 0 && v < 100;
  return (
    <div
      {...(decorative ? { "aria-hidden": true } : { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v), "aria-label": label })}
      className={cn("w-full overflow-hidden rounded-pill", track, size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}
    >
      <div
        className={cn(
          "h-full rounded-pill transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)",
          fill,
          // Resting at opacity 0: Calm and Still never start the loop, so the band stays invisible there.
          lit && ["relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:to-transparent after:opacity-0 motion-full:after:animate-sheen print:after:hidden", sheen],
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Circular progress (daily goal, level, setup guide): fills from empty on mount, and glows once full. */
export function Ring({
  value,
  size = 72,
  stroke = 8,
  tone = "reward",
  children,
  className,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "reward" | "brand" | "white" | "safe";
  children?: React.ReactNode;
  className?: string;
  /** Required: the ring is an image (role="img") and must be named. */
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = { reward: "var(--accent)", brand: "var(--brand)", white: "#fff", safe: "#22a05c" }[tone];
  const track = tone === "white" ? "rgba(255,255,255,.25)" : tone === "reward" ? "var(--color-reward-100)" : "var(--color-sunken)";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      {v >= 1 ? <span aria-hidden className="glow-ring rounded-full" style={{ "--light": tone === "white" ? "var(--brand-on)" : color } as CSSProperties} /> : null}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          // @starting-style: the first render starts empty, so the arc fills on load (instantly under Still). A paint
          // property, accepted for this one-shot fill as for value changes (animations.md §5).
          style={{ "--ring-empty": c } as CSSProperties}
          className="transition-[stroke-dashoffset] duration-(--duration-reveal) ease-(--ease-out-expo) starting:[stroke-dashoffset:var(--ring-empty)]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
