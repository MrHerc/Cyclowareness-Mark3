import { LOOP_STAGES, type LoopStage } from "@/server/db/schema";
import { cn } from "@/lib/cn";

/** Seven-step progress track of a closed loop (done · current · ahead). */
export function StageTrack({ stage, closed, labels, size = "sm" }: { stage: LoopStage; closed: boolean; labels: Record<LoopStage, string>; size?: "sm" | "lg" }) {
  const at = LOOP_STAGES.indexOf(stage);
  return (
    <ol className={cn("flex w-full items-center", size === "lg" ? "gap-1.5" : "gap-1")} aria-label={labels[stage]}>
      {LOOP_STAGES.map((s, i) => {
        const done = i < at || (closed && i === at);
        const current = i === at && !closed;
        return (
          <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <span className={cn("block rounded-pill", size === "lg" ? "h-2" : "h-1.5", done ? "bg-safe-500" : current ? "bg-brand-500" : "bg-sunken")} />
            {size === "lg" ? <span className={cn("text-tab-sm leading-tight font-semibold", current ? "text-brand-700" : done ? "text-ink-muted" : "text-ink-subtle")}>{labels[s]}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
