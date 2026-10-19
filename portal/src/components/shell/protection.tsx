"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Content protection (Settings → Protection): no text selection or copying, a blank print,
 * and the content shield that covers the screen whenever the window loses focus.
 */
export function Protection({ enabled }: { enabled: boolean }) {
  const t = useTranslations("common");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.dataset.protect = "on";
    const update = () => setHidden(!document.hasFocus() || document.visibilityState === "hidden");
    const block = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    update();
    return () => {
      delete root.dataset.protect;
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [enabled]);

  if (!enabled || !hidden) return null;
  return (
    <div data-content-shield role="status" aria-label={t("shield")} className="fixed inset-0 z-90 grid place-items-center bg-canvas/80 backdrop-blur-2xl print:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" className="size-20 animate-float" />
    </div>
  );
}

/**
 * Leak check: a per-session code repeated across the screen at an opacity people can't see.
 * Settings → Protection boosts a screenshot's contrast in the browser to read it back.
 */
export function Watermark({ code }: { code: string | null }) {
  if (!code) return null;
  const tile = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='140'><text x='10' y='70' transform='rotate(-18 130 70)' font-family='monospace' font-size='18' font-weight='700' fill='#16123a'>${code}</text></svg>`,
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-80 print:hidden"
      style={{ backgroundImage: `url("data:image/svg+xml,${tile}")`, opacity: 0.011, mixBlendMode: "multiply" }}
    />
  );
}
