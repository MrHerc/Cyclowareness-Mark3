import type { CSSProperties, ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Lightweight server-rendered SVG charts. Every chart carries a visually hidden data table
 * (as in the original) so screen readers get the numbers. Numbers go through next-intl's
 * formatter (server only: these components are never rendered in the browser).
 */

type Point = { label: string; value: number };

function HiddenTable({ caption, rows, headers }: { caption: string; rows: Point[]; headers: [string, string] }) {
  const format = useFormatter();
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>{headers[0]}</th>
          <th>{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>{format.number(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AreaChart({
  points,
  min = 0,
  max = 100,
  guides = [],
  yTicks,
  riskStrip = false,
  percent = false,
  caption,
  headers,
  height = 168,
  tone = "brand",
}: {
  points: Point[];
  min?: number;
  max?: number;
  guides?: number[];
  /** Y-axis labels shown in the left gutter (default: min, middle, max). */
  yTicks?: number[];
  riskStrip?: boolean;
  /** Axis and latest-value labels are percentages, signed as the UI language writes them. */
  percent?: boolean;
  caption: string;
  headers: [string, string];
  height?: number;
  tone?: "brand" | "safe" | "risk";
}) {
  const format = useFormatter();
  const tc = useTranslations("common");
  const label = (v: number) => (percent ? tc("units.percent", { value: format.number(v) }) : format.number(v));
  const W = 600;
  const H = 200;
  const pad = 6;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => pad + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min || 1)) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${W},${H} L0,${H} Z` : "";
  const last = points[points.length - 1];
  const stroke = { brand: "var(--brand)", safe: "#22a05c", risk: "#e5484d" }[tone];
  const gid = `g-${caption.replace(/[^a-z0-9]/gi, "").slice(0, 24)}-${tone}`;
  const ticks = yTicks ?? [min, (min + max) / 2, max];
  const midIndex = Math.floor((points.length - 1) / 2);
  const xLabels = points.length ? [points[0], ...(midIndex > 0 && midIndex < points.length - 1 ? [points[midIndex]] : []), ...(points.length > 1 ? [points[points.length - 1]] : [])] : [];
  return (
    <figure>
      <div className="relative" style={{ height }}>
        <div aria-hidden className="absolute inset-y-0 start-0 w-8">
          {ticks.map((v) => (
            <span key={v} className="absolute end-1.5 -translate-y-1/2 text-end text-tab-sm text-ink-subtle tabular-nums" style={{ top: `${(y(v) / H) * 100}%` }}>
              {label(v)}
            </span>
          ))}
        </div>
        <div className={cn("absolute inset-y-0 end-0", riskStrip ? "start-11" : "start-8")}>
          {/* Time runs in the reading direction: the plot mirrors with the axis and labels around it. */}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible rtl:-scale-x-100" aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
              {/* Draw-in: the line and its area unroll along the time axis once, from the SVG's own origin (x 0);
                  the server markup is the final chart, and Still makes the transition a single frame. A clip repaints
                  each frame: a deliberate exception to transform/opacity for this one run (animations.md §5). */}
              <clipPath id={`${gid}-draw`}>
                <rect x="-8" y="-8" width={W + 16} height={H + 16} className="transition-[scale] duration-[1.1s] ease-(--ease-in-out-smooth) starting:scale-x-0" />
              </clipPath>
            </defs>
            {guides.map((g) => (
              <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="var(--color-line-strong)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
            ))}
            <g clipPath={`url(#${gid}-draw)`}>
              <path d={area} fill={`url(#${gid})`} />
              <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          </svg>
          {last ? (
            // The latest point glows: an HTML dot (the stretched SVG would draw an ellipse) centred on the axis end,
            // flashing once as the line reaches it.
            <span
              aria-hidden
              className="absolute end-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--color-surface),0_0_0_6px_color-mix(in_oklab,var(--glow)_16%,transparent),0_0_14px_2px_color-mix(in_oklab,var(--glow)_40%,transparent)] rtl:-translate-x-1/2"
              style={{ top: `${(y(last.value) / H) * 100}%`, background: stroke, "--glow": stroke, "--light": stroke } as CSSProperties}
            >
              <span className="glow-ring animate-glow" style={{ animationDelay: "0.9s" }} />
            </span>
          ) : null}
          {last ? (
            // Above the latest point, clear of the line's last segment; below it when the point is near the top.
            <span
              className={cn("absolute end-0 rounded-pill bg-ink px-2 py-0.5 text-tab-sm font-bold text-white tabular-nums", y(last.value) / H < 0.15 ? "translate-y-3" : "-translate-y-[calc(100%+0.5rem)]")}
              style={{ top: `${(y(last.value) / H) * 100}%` }}
            >
              {label(last.value)}
            </span>
          ) : null}
        </div>
        {riskStrip ? (
          <div aria-hidden className="absolute top-0 bottom-0 start-8 w-1.5 overflow-hidden rounded-pill">
            <div className="h-1/3 bg-risk-500" />
            <div className="h-1/3 bg-warn-500" />
            <div className="h-1/3 bg-safe-500" />
          </div>
        ) : null}
      </div>
      {xLabels.length ? (
        <div aria-hidden className={cn("mt-1.5 flex justify-between text-tab-sm text-ink-subtle", riskStrip ? "ms-11" : "ms-8")}>
          {xLabels.map((p, i) => (
            <span key={i}>{p.label}</span>
          ))}
        </div>
      ) : null}
      <HiddenTable caption={caption} rows={points} headers={headers} />
    </figure>
  );
}

export function BarChart({ points, caption, headers, height = 120, tone = "reward" }: { points: Point[]; caption: string; headers: [string, string]; height?: number; tone?: "reward" | "brand" }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure>
      <div aria-hidden className="flex items-end gap-[3px]" style={{ height }}>
        {points.map((p) => (
          <div key={p.label} className="group relative flex-1" style={{ height: "100%" }}>
            <div
              className={cn("absolute bottom-0 w-full rounded-t-[3px]", p.value ? (tone === "reward" ? "bg-reward-400" : "bg-brand-400") : "bg-sunken")}
              style={{ height: `${Math.max(p.value ? 6 : 3, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <HiddenTable caption={caption} rows={points} headers={headers} />
    </figure>
  );
}

/**
 * Tiny trend line. With `points` (and a caption) it renders as a figure with the hidden data table,
 * like the other charts; with bare `values` it stays decorative.
 */
export function Sparkline({
  values,
  points,
  caption,
  headers,
  className,
  tone = "brand",
}: {
  values?: number[];
  points?: Point[];
  caption?: string;
  headers?: [string, string];
  className?: string;
  tone?: "brand" | "risk" | "safe" | "warn";
}) {
  const series = values ?? points?.map((p) => p.value) ?? [];
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const W = 120;
  const H = 32;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  const d = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const stroke = { brand: "var(--brand)", risk: "#e5484d", safe: "#22a05c", warn: "#d97706" }[tone];
  const last = series[series.length - 1];
  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-8 w-28 overflow-visible rtl:-scale-x-100", className)} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(series.length - 1)} cy={y(last)} r="2.5" fill={stroke} />
    </svg>
  );
  if (!points || !caption || !headers) return svg;
  return (
    <figure>
      {svg}
      <HiddenTable caption={caption} rows={points} headers={headers} />
    </figure>
  );
}

/** 30-day activity heatmap (one square per day). */
export function Heatmap({ days, caption, headers }: { days: { label: string; value: number }[]; caption: string; headers: [string, string] }) {
  const format = useFormatter();
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <figure>
      <div aria-hidden className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <span
            key={d.label}
            title={`${d.label}: ${format.number(d.value)}`}
            className="aspect-square rounded-[5px]"
            style={{ background: d.value ? `color-mix(in oklab, var(--brand) ${20 + (d.value / max) * 80}%, white)` : "var(--color-sunken)" }}
          />
        ))}
      </div>
      <HiddenTable caption={caption} rows={days} headers={headers} />
    </figure>
  );
}

/** Horizontal stacked share bar (people by risk level). */
export function StackBar({ parts, className }: { parts: { value: number; className: string; label: string }[]; className?: string }) {
  const format = useFormatter();
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={cn("flex h-3 w-full overflow-hidden rounded-pill bg-sunken", className)} role="img" aria-label={parts.map((p) => `${p.label}: ${format.number(p.value)}`).join(", ")}>
      {parts.map((p) => (p.value ? <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
    </div>
  );
}

/** Campaign funnel: Sent → Opened → Clicked → Reported. */
export function Funnel({ steps }: { steps: { label: ReactNode; value: number; share?: number; tone: "brand" | "risk" | "safe" | "neutral" }[] }) {
  const format = useFormatter();
  const tc = useTranslations("common");
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="grid gap-2.5">
      {steps.map((s, i) => (
        <li key={i} className={cn("rounded-md px-3 py-2", s.tone === "safe" && "bg-safe-50")}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-caption">
            <span className={cn("font-semibold", s.tone === "risk" ? "text-risk-600" : s.tone === "safe" ? "text-safe-700" : "text-ink")}>{s.label}</span>
            <span className="tabular-nums text-ink-muted">
              <b className="text-ink">{format.number(s.value)}</b>
              {s.share !== undefined ? ` · ${tc("units.percent", { value: format.number(s.share) })}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-pill bg-sunken">
            <div
              className={cn("h-full rounded-pill", { brand: "bg-brand-500", risk: "bg-risk-500", safe: "bg-safe-500", neutral: "bg-ink-disabled" }[s.tone])}
              style={{ width: `${(s.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
