import { cn } from "@/lib/cn";

/** Loading placeholder: a sunken radius-xl block with a shimmer sweep, as in the original. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-sunken before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}
