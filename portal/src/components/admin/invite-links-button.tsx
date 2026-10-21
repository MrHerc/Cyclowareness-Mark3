"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Bulk invite links as a CSV. Generating links creates tokens, so it is a POST that the browser
 * cannot be made to issue by a plain link or a prefetch; the file is saved from the response.
 */
export function InviteLinksButton({ label }: { label: string }) {
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const download = () =>
    start(async () => {
      const res = await fetch("/api/admin/people/invite-links", { method: "POST" });
      if (!res.ok) {
        toast(tc("errors.generic"), "error");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "invite-links.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
    });
  return (
    // The long translated label ("Скачать ссылки-приглашения (CSV)") wraps inside the button on narrow phones instead of widening the page.
    <Button variant="secondary" icon={<Link2 />} disabled={pending} onClick={download} className="h-auto min-h-11 max-w-full shrink py-2.5 text-start whitespace-normal">
      {label}
    </Button>
  );
}
