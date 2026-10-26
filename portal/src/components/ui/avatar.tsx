import { cn } from "@/lib/cn";

const PALETTE = [
  "bg-safe-50 text-safe-700",
  "bg-brand-100 text-brand-700",
  "bg-reward-100 text-reward-ink",
  "bg-[#e6f6fa] text-[#0b6a80]",
  "bg-[#f3eefe] text-[#5b2bb5]",
  "bg-risk-50 text-risk-700",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  // Not toLocaleUpperCase(): its result follows the runtime's locale, so server and browser could disagree.
  return (first + last).toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"; className?: string }) {
  const dim = { xs: "size-7 text-[0.65rem]", sm: "size-9 text-tab-sm", md: "size-10 text-tab", lg: "size-14 text-body", xl: "size-20 text-title", "2xl": "size-24 text-headline" }[size];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", dim, className)} />;
  }
  return (
    <span aria-hidden className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold tracking-wide", dim, PALETTE[hash(name) % PALETTE.length], className)}>
      {initials(name)}
    </span>
  );
}
