"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChevronRight, Eye, EyeOff, Mail, RotateCcw, ShieldAlert, ShieldCheck, XCircle, Zap, Smartphone, Link2 } from "lucide-react";
import { playLabAction, type LabResult } from "@/server/actions/engage";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { checkPassword } from "@/lib/password-strength";
import { cn } from "@/lib/cn";

type Item = { id: string; sender?: string; address?: string; subject?: string; snippet?: string; url?: string; context?: string; situation?: string };

const OPTIONS: Record<string, string[]> = {
  "inbox-triage": ["phishing", "safe"],
  "link-detective": ["safe", "suspicious"],
  "mfa-fatigue": ["approve", "deny", "ignore"],
};

export function GameClient({ game, items, orgName }: { game: string; items: Item[]; orgName: string }) {
  const t = useTranslations("learner.lab");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Extract<LabResult, { score: number }> | null>(null);
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  const submit = (a: Record<string, string>) =>
    start(async () => {
      const res = await playLabAction(game, a);
      if ("score" in res) setResult(res);
    });
  const reset = () => {
    setI(0);
    setAnswers({});
    setResult(null);
    setPw("");
  };
  const label = (v: string) => (v === "phishing" ? t("phishing") : v === "safe" ? t("safe") : v === "suspicious" ? t("suspicious") : t(`mfaActions.${v as "approve" | "deny" | "ignore"}`));

  if (result) {
    return (
      <Card className="mx-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="text-center">
          <p className="text-headline font-bold">{t("resultTitle", { score: result.score, max: result.max })}</p>
          {result.xp ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-reward-100 px-4 py-2 font-bold text-reward-ink">
              <Zap className="size-5 fill-reward-500 text-reward-600" />
              {t("resultXp", { xp: result.xp })}
            </p>
          ) : null}
        </div>
        {game !== "password-forge" ? (
          <ul className="mt-6 grid gap-2.5">
            {result.items.map((r, k) => (
              <li key={r.id} className={cn("flex items-start gap-3 rounded-lg p-3.5", r.correct ? "bg-safe-50" : "bg-risk-50")}>
                {r.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-safe-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-risk-600" />}
                <div className="text-body-sm">
                  <p className="font-semibold">
                    {k + 1}. {items[k]?.subject ?? items[k]?.url ?? items[k]?.situation} → {label(r.answer)}
                  </p>
                  <p className="mt-0.5 text-ink-muted">{r.why}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" icon={<RotateCcw />} onClick={reset}>
            {t("again")}
          </Button>
          <ButtonLink href="/lab">{t("back")}</ButtonLink>
        </div>
      </Card>
    );
  }

  if (game === "password-forge") {
    return <PasswordForge orgName={orgName} value={pw} setValue={setPw} show={show} setShow={setShow} pending={pending} onSubmit={() => submit({ passphrase: pw })} />;
  }

  const item = items[i];
  const chosen = answers[item.id];
  const last = i === items.length - 1;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <div className="flex items-center gap-3">
        <ProgressBar value={((i + (chosen ? 1 : 0)) / items.length) * 100} />
        <span className="shrink-0 text-caption text-ink-muted">{t("progressLabel", { current: i + 1, total: items.length })}</span>
      </div>
      <Card className="p-6">
        {game === "inbox-triage" ? (
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Mail className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-semibold">{item.sender}</p>
              <p className="font-mono text-caption break-all text-ink-muted">{item.address}</p>
              <p className="mt-3 text-body font-bold">{item.subject}</p>
              <p className="mt-1 text-body-sm text-ink-muted">{item.snippet}</p>
            </div>
          </div>
        ) : game === "link-detective" ? (
          <div>
            <p className="text-caption text-ink-muted">{item.context}</p>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-sunken px-4 py-3 font-mono text-body-sm break-all">
              <Link2 className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
              {item.url}
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-reward-100 text-reward-ink">
              <Smartphone className="size-5" />
            </span>
            <p className="text-body font-semibold">{item.situation}</p>
          </div>
        )}
      </Card>
      <div className="grid gap-2.5 sm:grid-flow-col">
        {OPTIONS[game].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setAnswers({ ...answers, [item.id]: o })}
            aria-pressed={chosen === o}
            className={cn(
              "flex items-center justify-center gap-2 rounded-pill border-2 px-5 py-3 text-body-sm font-semibold transition-colors",
              chosen === o ? (o === "phishing" || o === "suspicious" || o === "deny" ? "border-risk-500 bg-risk-50 text-risk-700" : "border-brand-600 bg-brand-50 text-brand-700") : "border-line bg-surface hover:border-brand-300",
            )}
          >
            {o === "phishing" || o === "suspicious" || o === "deny" ? <ShieldAlert className="size-4.5" /> : <ShieldCheck className="size-4.5" />}
            {label(o)}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="lg" disabled={!chosen || pending} iconRight={<ChevronRight />} onClick={() => (last ? submit(answers) : setI(i + 1))}>
          {last ? t("finish") : t("next")}
        </Button>
      </div>
    </div>
  );
}

function PasswordForge({ orgName, value, setValue, show, setShow, pending, onSubmit }: { orgName: string; value: string; setValue: (v: string) => void; show: boolean; setShow: (v: boolean) => void; pending: boolean; onSubmit: () => void }) {
  const t = useTranslations("learner.lab");
  const score = useMemo(() => (value ? checkPassword(value, [orgName]).score : 0), [value, orgName]);
  const words = value.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3);
  const banned = ["password", "parol", "пароль", "qwerty", "123456", orgName.toLowerCase()];
  const rules = [
    { ok: value.length >= 14, label: t("pwRules.length") },
    { ok: words.length >= 3, label: t("pwRules.words") },
    { ok: score >= 4, label: t("pwRules.strong") },
    { ok: !!value && !banned.some((b) => b && value.toLowerCase().includes(b)), label: t("pwRules.noCommon") },
  ];
  return (
    <Card className="mx-auto w-full max-w-xl p-6">
      <label htmlFor="forge" className="text-caption font-semibold">
        {t("pwLabel")}
      </label>
      <div className="relative mt-1.5">
        <input
          id="forge"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("pwPlaceholder")}
          autoComplete="off"
          maxLength={200}
          className="h-13 w-full rounded-md border border-line-strong bg-surface pr-12 pl-4 font-mono text-body focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? t("pwHide") : t("pwShow")} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-sunken">
          {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((k) => (
          <span key={k} className={cn("h-2 rounded-pill", value && k <= score ? (score >= 4 ? "bg-safe-500" : score >= 2 ? "bg-warn-500" : "bg-risk-500") : "bg-sunken")} />
        ))}
      </div>
      <ul className="mt-4 grid gap-1.5">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-2 text-body-sm", r.ok ? "text-safe-700" : "text-ink-muted")}>
            {r.ok ? <CheckCircle2 className="size-4.5" /> : <XCircle className="size-4.5 text-ink-disabled" />}
            {r.label}
          </li>
        ))}
      </ul>
      <Button size="lg" className="mt-6 w-full" disabled={!value || pending} onClick={onSubmit}>
        {t("pwSubmit")}
      </Button>
    </Card>
  );
}
