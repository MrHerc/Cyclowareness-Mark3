import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "brand" | "safe" | "risk" | "warn" | "reward" | "ink" | "violet" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-muted",
  brand: "bg-brand-100 text-brand-700",
  safe: "bg-safe-50 text-safe-700",
  risk: "bg-risk-50 text-risk-700",
  warn: "bg-warn-50 text-warn-700",
  reward: "bg-reward-100 text-reward-ink",
  ink: "bg-ink text-white",
  violet: "bg-[#f3eefe] text-[#5b2bb5]",
  cyan: "bg-[#e6f6fa] text-[#0b6a80]",
};

export function Pill({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-tab-sm font-semibold whitespace-nowrap [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    neutral: "bg-ink-disabled",
    brand: "bg-brand-600",
    safe: "bg-safe-500",
    risk: "bg-risk-500",
    warn: "bg-warn-500",
    reward: "bg-reward-500",
    ink: "bg-ink",
    violet: "bg-[#7c3aed]",
    cyan: "bg-[#0891b2]",
  };
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color[tone], className)} />;
}
