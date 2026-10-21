import { LOOP_STAGES, type LoopStage } from "@/server/db/schema";
import { cn } from "@/lib/cn";

/**
 * Seven-step progress track of a closed loop (done · current · ahead). With `size="lg"` every step is
 * labelled from `sm` up; on a phone seven labels cannot fit side by side, so the step labels are kept
 * for screen readers only and the current stage is named once under the track.
 */
export function StageTrack({ stage, closed, labels, size = "sm" }: { stage: LoopStage; closed: boolean; labels: Record<LoopStage, string>; size?: "sm" | "lg" }) {
  const at = LOOP_STAGES.indexOf(stage);
  const track = (
    <ol className={cn("flex w-full min-w-0 items-start", size === "lg" ? "gap-1.5" : "gap-1")} aria-label={labels[stage]}>
      {LOOP_STAGES.map((s, i) => {
        const done = i < at || (closed && i === at);
        const current = i === at && !closed;
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <span className={cn("block rounded-pill", size === "lg" ? "h-2" : "h-1.5", done ? "bg-safe-500" : current ? "bg-brand-500" : "bg-sunken")} />
            {size === "lg" ? (
              <span className={cn("sr-only text-tab-sm leading-tight font-semibold hyphens-auto wrap-break-word sm:not-sr-only", current ? "text-brand-700" : done ? "text-ink-muted" : "text-ink-subtle")}>{labels[s]}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
  if (size !== "lg") return track;
  return (
    <div className="grid min-w-0 gap-2">
      {track}
      <p aria-hidden className={cn("text-tab-sm leading-tight font-semibold sm:hidden", closed ? "text-ink-muted" : "text-brand-700")}>
        {at + 1}/{LOOP_STAGES.length} · {labels[stage]}
      </p>
    </div>
  );
}
