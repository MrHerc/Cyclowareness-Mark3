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
}: {
  value: number;
  tone?: "brand" | "reward" | "safe" | "risk" | "warn" | "white";
  className?: string;
  size?: "sm" | "md" | "lg";
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
  const track = tone === "white" ? "bg-white/25" : "bg-sunken";
  return (
    <div
      {...(decorative ? { "aria-hidden": true } : { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v), "aria-label": label })}
      className={cn("w-full overflow-hidden rounded-pill", track, size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}
    >
      <div className={cn("h-full rounded-pill transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)", fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Circular progress (daily goal, level, setup guide). */
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
          className="transition-[stroke-dashoffset] duration-(--duration-reveal) ease-(--ease-out-expo)"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
