import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LeagueTrend } from "@/lib/domain/league";
import { cn } from "@/lib/cn";

/** ↑ / ↓ / – next to a league place: movement since last week, read out through `label`. */
export function TrendMark({ trend, label, className }: { trend: LeagueTrend; label: string; className?: string }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-grid size-5 shrink-0 place-items-center", trend === "up" ? "text-safe-600" : trend === "down" ? "text-risk-600" : "text-ink-subtle", className)}
    >
      <Icon className="size-4" strokeWidth={2.5} aria-hidden />
    </span>
  );
}
