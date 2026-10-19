"use client";

import { Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

/** TV / office-screen mode for the league board. */
export function FullscreenButton({ label, target }: { label: string; target: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={<Maximize />}
      onClick={() => {
        const el = document.getElementById(target);
        if (!el) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void el.requestFullscreen().then(() => el.classList.add("p-10"));
        document.addEventListener("fullscreenchange", () => !document.fullscreenElement && el.classList.remove("p-10"), { once: true });
      }}
    >
      {label}
    </Button>
  );
}
