import type { RiskBand } from "@/lib/domain/risk";
import { cn } from "@/lib/cn";

const STROKE: Record<RiskBand, string> = { low: "stroke-safe-500", medium: "stroke-warn-500", high: "stroke-risk-500" };
const TEXT: Record<RiskBand, string> = { low: "text-safe-700", medium: "text-warn-700", high: "text-risk-700" };

/**
 * Risk score as a three-quarter gauge (0 at the lower left, 100 at the lower right). Static SVG, so it needs no
 * motion handling; the number in the middle is the visible value and `label` names the image for assistive tech.
 */
export function ScoreGauge({ score, band, label, caption, className }: { score: number; band: RiskBand; label: string; caption: string; className?: string }) {
  const size = 176;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const v = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div role="img" aria-label={label} className={cn("relative grid size-44 shrink-0 place-items-center", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full rotate-[135deg]" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} className="stroke-sunken" />
        {score > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * v} ${c}`}
            className={STROKE[band]}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden>
        <span className={cn("text-[3rem] leading-none font-bold tabular-nums", TEXT[band])}>{score}</span>
        <span className="mt-1 text-caption text-ink-muted">{caption}</span>
      </div>
    </div>
  );
}

/** The three bands as one scale with a marker at the score, so "low / medium / high" reads as a position. */
export function BandScale({ score, labels }: { score: number; labels: Record<RiskBand, string> }) {
  const pos = Math.max(0, Math.min(100, score));
  return (
    <div aria-hidden className="w-full max-w-sm">
      <div className="relative h-2.5">
        <div className="flex h-full gap-1 overflow-hidden rounded-pill">
          <span className="h-full basis-[33%] bg-safe-500/80" />
          <span className="h-full basis-[33%] bg-warn-500/80" />
          <span className="h-full basis-[34%] bg-risk-500/80" />
        </div>
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill border-[3px] border-surface bg-ink shadow-raised rtl:translate-x-1/2" style={{ insetInlineStart: `${pos}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 text-tab-sm text-ink-muted">
        <span>{labels.low}</span>
        <span className="text-center">{labels.medium}</span>
        <span className="text-end">{labels.high}</span>
      </div>
    </div>
  );
}
