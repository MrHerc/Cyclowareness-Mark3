import Link from "next/link";
import { BarChart3, ClipboardList, Megaphone, Sparkles, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";

export type QuickActionKey = "addPerson" | "assign" | "aiTraining" | "campaign" | "reports";

const ACTIONS: Record<QuickActionKey, { href: string; icon: typeof UserPlus }> = {
  addPerson: { href: "/admin/users", icon: UserPlus },
  assign: { href: "/admin/assignments", icon: ClipboardList },
  aiTraining: { href: "/admin/studio#ai", icon: Sparkles },
  campaign: { href: "/admin/campaigns/new", icon: Megaphone },
  reports: { href: "/admin/reports", icon: BarChart3 },
};

/** The everyday console tasks in one row on the overview; the page passes only the ones the viewer may do. */
export function QuickActions({ title, actions }: { title: string; actions: { key: QuickActionKey; label: string }[] }) {
  if (!actions.length) return null;
  return (
    <section aria-labelledby="quick-actions-title" data-tour="admin-quick">
      <h2 id="quick-actions-title" className="mb-2 text-tab-sm font-bold tracking-wider text-ink-subtle uppercase">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map(({ key, label }) => {
          const { href, icon: Icon } = ACTIONS[key];
          const ai = key === "aiTraining";
          return (
            <li key={key} className={cn(ai && "col-span-2 sm:col-span-1")}>
              <Link
                href={href}
                className={cn(
                  "flex h-full min-h-14 items-center gap-3 rounded-xl border px-3.5 py-3 text-body-sm font-semibold shadow-xs transition-colors",
                  ai ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-line bg-surface text-ink hover:bg-sunken",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ai ? "bg-brand-600 text-brand-on" : "bg-sunken text-ink-muted")}>
                  <Icon aria-hidden className="size-[1.15rem]" />
                </span>
                <span className="min-w-0 text-balance">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
