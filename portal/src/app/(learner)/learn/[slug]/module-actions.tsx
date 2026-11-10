"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Award, Star } from "lucide-react";
import { attestModuleAction, rateModuleAction } from "@/server/actions/learning";
import { Dialog } from "@/components/ui/dialog";
import { Button, textLinkClass } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

/** "Confirm the module" (attestation) dialog. Opens automatically from ?confirm=1; once confirmed it returns to `returnHref` (the page without it). */
export function AttestCard({ slug, moduleTitle, text, autoOpen, returnHref }: { slug: string; moduleTitle: string; text: string; autoOpen: boolean; returnHref: string }) {
  const t = useTranslations("learner");
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [checked, setChecked] = useState(false);
  const { run, pending } = useAction(attestModuleAction, {
    successToast: t("attest.done"),
    onSuccess: () => {
      setOpen(false);
      router.replace(returnHref);
    },
    errorMap: () => t("attest.error"),
  });
  // ?confirm=1 arriving on an already mounted card opens it too (state adjusted during render, no effect).
  const [autoOpened, setAutoOpened] = useState(autoOpen);
  if (autoOpen !== autoOpened) {
    setAutoOpened(autoOpen);
    if (autoOpen) setOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border border-reward-200 bg-reward-100/60 p-4">
        <p className="flex items-center gap-2 text-body-sm font-semibold">
          <Award className="size-5 text-reward-600" />
          {t("module.confirmTitle")}
        </p>
        <p className="mt-1 text-caption text-ink-muted">{t("module.confirmBody")}</p>
        <Button variant="accent" className="mt-3 w-full" onClick={() => setOpen(true)}>
          {t("module.confirmCta")}
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("attest.title")} description={moduleTitle} size="sm">
        <p className="rounded-lg bg-sunken p-4 text-body leading-relaxed">{text}</p>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3.5">
          <input type="checkbox" className="size-5 accent-(--brand)" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span className="text-body-sm font-semibold">{t("attest.checkbox")}</span>
        </label>
        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={!checked || pending}
          onClick={() => run(slug)}
        >
          {t("attest.submit")}
        </Button>
      </Dialog>
    </>
  );
}

export function CertificateLink({ token }: { token: string }) {
  const t = useTranslations("learner.module");
  return (
    // On coarse pointers the hit area's negative margin replaces mt-3, so the 0.75rem is restated there.
    <Link
      href={`/c/${token}`}
      className={textLinkClass("mt-3 inline-flex items-center gap-1.5 text-caption font-semibold text-brand-600 hover:underline pointer-coarse:mt-[calc(0.75rem_-_max(0px,calc((2.75rem_-_1lh)/2)))]")}
    >
      <Award className="size-4" />
      {t("viewCertificate")}
    </Link>
  );
}

/** Anonymous 1–5 rating after finishing a module. */
export function RateModule({ slug }: { slug: string }) {
  const t = useTranslations("learner.module");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const { run, pending } = useAction(rateModuleAction, { onSuccess: () => setSent(true) });
  if (sent) return <p className="text-caption font-semibold text-safe-700">{t("rateThanks")}</p>;
  return (
    <div>
      <p className="text-body-sm font-semibold">{t("rate")}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("rate")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t("stars", { count: n })} onClick={() => setRating(n)} className="rounded-full p-1 hover:bg-sunken pointer-coarse:p-2">
            <Star className={cn("size-7", n <= rating ? "fill-laurel-500 text-laurel-600" : "text-line-strong")} />
          </button>
        ))}
      </div>
      {rating ? (
        <div className="mt-3 grid gap-2">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("rateComment")} className="min-h-20" maxLength={2000} />
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run({ slug, rating, comment })}
          >
            {t("rateSend")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
