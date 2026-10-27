"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpenCheck, ChevronsUpDown, LogOut, User } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

/** The ⌃⌄ trigger on the sidebar user card: Profile, Learner view, Sign out. Opens upward, the card sits at the bottom. */
export function AccountMenu() {
  const t = useTranslations("admin.nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex h-10 w-full items-center gap-3 px-3 text-body-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("accountMenu")}
        className="grid size-8 place-items-center rounded-full text-ink-subtle hover:bg-sunken hover:text-ink"
      >
        <ChevronsUpDown className="size-4" />
      </button>
      {open ? (
        <div role="menu" aria-label={t("accountMenu")} className="absolute end-0 bottom-full z-50 mb-2 w-56 animate-rise overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-overlay">
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <User className="size-[1.15rem] shrink-0 text-ink-subtle" />
            {t("profile")}
          </Link>
          <Link href="/app" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <BookOpenCheck className="size-[1.15rem] shrink-0 text-ink-subtle" />
            {t("learnerView")}
          </Link>
          <form action={signOutAction} className="mt-1 border-t border-line pt-1">
            <button type="submit" role="menuitem" className={cn(item, "hover:text-risk-600")}>
              <LogOut className="size-[1.15rem] shrink-0 text-ink-subtle" />
              {t("signOut")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
