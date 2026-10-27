"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight, Lock, ShieldAlert } from "lucide-react";
import { simulationSubmitAction } from "@/server/actions/campaigns";
import { Mascot } from "@/components/mascot/mascot";
import { buttonClass } from "@/components/ui/button";

/**
 * Teachable moment after a simulated phishing click: for credential-harvest templates a
 * look-alike sign-in form comes first. Its inputs have no names, so nothing typed ever leaves
 * the browser; only the fact that the form was submitted is recorded.
 */
export function TeachableMoment({
  token,
  org,
  flags,
  moduleSlug,
  harvest,
  alreadySubmitted,
  brandName,
  qr,
}: {
  token: string;
  org: string;
  flags: string[];
  moduleSlug: string;
  harvest: boolean;
  alreadySubmitted: boolean;
  brandName: string;
  qr: boolean;
}) {
  const t = useTranslations("site.teach");
  const [stage, setStage] = useState<"login" | "teach">(harvest && !alreadySubmitted ? "login" : "teach");
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [pending, start] = useTransition();

  if (stage === "login") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f3f2f1] px-4">
        <form
          className="w-full max-w-sm rounded-md bg-white p-8 shadow-[0_2px_6px_rgba(0,0,0,.2)]"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await simulationSubmitAction(token);
              setSubmitted(true);
              setStage("teach");
            });
          }}
        >
          <p className="text-title-sm font-semibold text-[#1b1b1b]">{brandName}</p>
          <p className="mt-4 text-body text-[#1b1b1b]">{t("fakeLogin")}</p>
          <input aria-label={t("fakeEmail")} placeholder={t("fakeEmail")} autoComplete="off" dir="ltr" className="mt-5 w-full border-b border-[#666] py-2 text-body-sm outline-none focus:border-[#0067b8]" />
          <input aria-label={t("fakePassword")} placeholder={t("fakePassword")} type="password" autoComplete="new-password" dir="ltr" className="mt-4 w-full border-b border-[#666] py-2 text-body-sm outline-none focus:border-[#0067b8]" />
          <button type="submit" disabled={pending} className="mt-7 ms-auto block bg-[#0067b8] px-8 py-2 text-body-sm text-white">
            {t("fakeButton")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas px-4 py-10">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex items-center gap-4">
          <Mascot mood="alert" gesture="shield-up" gestureKey="teach" className="size-28 shrink-0" />
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-pill bg-reward-100 px-3 py-1 text-caption font-semibold text-reward-ink">
              <ShieldAlert className="size-4" />
              {qr ? t("qr") : t("badge")}
            </p>
            <h1 className="mt-2 text-headline font-bold text-balance">{t("title")}</h1>
            <p className="mt-1 text-body text-ink-muted">{t("sub", { org })}</p>
          </div>
        </div>
        {submitted ? (
          <div className="flex items-start gap-3 rounded-xl border border-risk-100 bg-risk-50 p-4 text-body-sm text-risk-700">
            <Lock className="mt-0.5 size-5 shrink-0" />
            {t("submittedNote")}
          </div>
        ) : null}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-raised">
          <h2 className="text-title-sm font-bold">{t("flags")}</h2>
          <ul className="mt-4 grid gap-3">
            {flags.map((f) => (
              <li key={f} className="flex items-start gap-3 text-body">
                <AlertTriangle className="mt-1 size-5 shrink-0 text-reward-600" />
                {f}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-brand-600 p-6 text-brand-on shadow-raised">
          <p className="text-title-sm font-bold">{t("learn")}</p>
          <p className="mt-1 opacity-90">{t("learnBody")}</p>
          <Link href={`/learn/${moduleSlug}`} className={buttonClass("accent", "lg", "mt-5")}>
            {t("learnCta")}
            <ChevronRight />
          </Link>
        </section>
        <p className="text-center text-caption text-ink-muted">{t(qr ? "reportQr" : "report")}</p>
      </div>
    </div>
  );
}
