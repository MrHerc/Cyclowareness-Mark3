"use client";

import { useState } from "react";
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

function CreatedLink({ url }: { url: string }) {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const [status, setStatus] = useState(t("linkNotCopied"));
  return (
    <div className="grid gap-3">
      <Field label={t("linkLabel")} htmlFor="created-link">
        <div className="flex gap-2">
          <Input id="created-link" readOnly value={url} dir="ltr" className="font-mono text-tab" autoFocus onFocus={(e) => e.currentTarget.select()} aria-describedby="created-link-status" />
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
