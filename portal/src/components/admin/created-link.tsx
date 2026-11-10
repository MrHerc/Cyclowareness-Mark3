"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";

/** Clipboard write that reports a refusal instead of throwing: embedded and sandboxed browsers block it (or have no clipboard). */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies a created link, or hands it to `show` when the clipboard refuses, so it is never lost. */
export async function copyOrShow(url: string, copied: () => void, show: (url: string) => void) {
  if (await writeClipboard(url)) copied();
  else show(url);
}

function CreatedLink({ url }: { url: string }) {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const [status, setStatus] = useState(t("linkNotCopied"));
  const ref = useRef<HTMLInputElement>(null);
  // The parent dialog's showModal runs after this effect and would focus its Close button; focusing the
  // field afterwards selects the link and reads the instruction it is described by.
  useEffect(() => queueMicrotask(() => ref.current?.focus()), []);
  return (
    <div className="grid gap-3">
      <Field label={t("linkLabel")} htmlFor="created-link">
        <div className="flex gap-2">
          <Input id="created-link" readOnly value={url} dir="ltr" className="font-mono text-tab" ref={ref} onFocus={(e) => e.currentTarget.select()} aria-describedby="created-link-status" />
          <Button variant="secondary" size="icon" aria-label={tc("copy")} onClick={async () => setStatus((await writeClipboard(url)) ? t("linkCopied") : t("linkNotCopied"))}>
            <Copy />
          </Button>
        </div>
      </Field>
      <p id="created-link-status" role="status" className="text-caption text-ink-muted">
        {status}
      </p>
    </div>
  );
}

/**
 * An invite or reset link the clipboard refused, shown so it is not lost: a new one would need the
 * administrator's password again. Open while `url` is set.
 */
export function CreatedLinkDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const t = useTranslations("admin.people");
  return (
    <Dialog open={!!url} onClose={onClose} title={t("linkReadyTitle")} size="sm">
      {url ? <CreatedLink url={url} /> : null}
    </Dialog>
  );
}
