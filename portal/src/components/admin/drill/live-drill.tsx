"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, FastForward, GraduationCap, KeyRound, Mail, MailOpen, Megaphone, MessageSquareText, MousePointerClick, RotateCcw, ShieldCheck, Sparkles, Timer, TrendingDown, TrendingUp, Users, Zap } from "lucide-react";
import type { DrillFeedItem, DrillView } from "@/server/services/drill";
import { skipDrillAction } from "@/server/actions/drill";
import { msToSim, percent, simToMs } from "@/lib/drill/plan";
import { useClientFormat } from "@/lib/client-format";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

const POLL_MS = 1_000;

type SelKey = "waiting" | DrillFeedItem["kind"] | "finished";

/** AI Sel reacts to the latest thing that happened. */
const SEL: Record<SelKey, { mood: MascotMood; gesture: MascotGesture }> = {
  waiting: { mood: "curious", gesture: "lean-in" },
  click: { mood: "worried", gesture: "facepalm" },
  submit: { mood: "alert", gesture: "shake" },
  report: { mood: "happy", gesture: "cheer" },
  train: { mood: "proud", gesture: "nod" },
  finished: { mood: "celebrate", gesture: "hop" },
};

const TILE: Record<DrillView["people"][number]["outcome"], string> = {
  pending: "border border-dashed border-line-strong bg-surface text-ink-subtle",
  delivered: "bg-sunken text-ink-muted",
  opened: "bg-brand-100 text-brand-700",
  clicked: "bg-warn-500 text-ink",
  submitted: "bg-risk-600 text-white",
  reported: "bg-safe-600 text-white",
};

const FEED_ICON = { click: MousePointerClick, submit: KeyRound, report: Megaphone, train: GraduationCap } as const;
const FEED_TONE = { click: "bg-warn-50 text-warn-700", submit: "bg-risk-50 text-risk-600", report: "bg-safe-50 text-safe-600", train: "bg-brand-50 text-brand-600" } as const;

export function LiveDrill({ initial, canLeadership }: { initial: DrillView; canLeadership: boolean }) {
  const t = useTranslations("admin.drill");
  const tc = useTranslations("common");
  const format = useClientFormat();
  const [view, setView] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [elapsed, setElapsed] = useState(initial.elapsedMs);
  const [pending, start] = useTransition();
  // Where the server's clock was at the last answer, against this tab's clock, so the dial keeps moving between polls.
  const anchor = useRef<{ server: number; local: number } | null>(null);
  const finished = view.status === "finished";

  useEffect(() => {
    if (finished) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/drill/${view.id}`, { cache: "no-store", headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as DrillView;
        if (stopped) return;
        anchor.current = { server: next.elapsedMs, local: performance.now() };
        setView(next);
        setOffline(false);
        if (next.status === "finished") return;
      } catch {
        if (!stopped) setOffline(true);
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS / 2);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [view.id, finished]);

  useEffect(() => {
    if (finished) return;
    anchor.current ??= { server: initial.elapsedMs, local: performance.now() };
    const id = setInterval(() => {
      const a = anchor.current;
      if (a) setElapsed(Math.min(view.durationMs, a.server + (performance.now() - a.local)));
    }, 200);
    return () => clearInterval(id);
  }, [finished, initial.elapsedMs, view.durationMs]);

  const sim = finished ? view.simNow : Math.max(view.simNow, msToSim(elapsed, view.durationMs, view.simMinutes));
  const latest = view.feed[0];
  const selKey: SelKey = finished ? "finished" : (latest?.kind ?? "waiting");
  const pct = (n: number) => tc("units.percent", { value: format.number(n) });
  const totals = view.totals;

  const skip = () =>
    start(async () => {
      await skipDrillAction(view.id);
      try {
        const res = await fetch(`/api/admin/drill/${view.id}`, { cache: "no-store" });
        if (res.ok) setView((await res.json()) as DrillView);
      } catch {
        setOffline(true);
      }
    });

  return (
    <div className="grid gap-5">
      <Hero view={view} sim={sim} finished={finished} offline={offline} pending={pending} onSkip={skip} />

      {finished && !view.cancelled ? <Summary view={view} canLeadership={canLeadership} pct={pct} /> : null}

      <Funnel view={view} pct={pct} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <People view={view} />
        <div className="grid content-start gap-5">
          <Card className="relative isolate overflow-hidden">
            <CardBody className="flex items-center gap-4">
              <Mascot mood={SEL[selKey].mood} gesture={SEL[selKey].gesture} gestureKey={`${selKey}-${latest?.n ?? -1}`} label={t("selLabel")} className="size-24 shrink-0 sm:size-28" />
              <div className="min-w-0 flex-1">
                <p className="text-tab-sm font-bold tracking-wider text-ink-subtle uppercase">AI Sel</p>
                <p key={selKey + (latest?.n ?? "")} className="mt-1 text-body-sm font-semibold text-balance text-ink motion-ok:animate-reveal">
                  {t(`sel.${selKey}`)}
                </p>
              </div>
            </CardBody>
          </Card>
          <Feed view={view} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Race view={view} />
        <Risk view={view} />
        <Automation totals={totals} />
      </div>
      <p className="text-tab text-ink-subtle">{t("benchmarkSource")}</p>
    </div>
  );
}

function Hero({ view, sim, finished, offline, pending, onSkip }: { view: DrillView; sim: number; finished: boolean; offline: boolean; pending: boolean; onSkip: () => void }) {
  const t = useTranslations("admin.drill");
  const tcmp = useTranslations("admin.campaigns");
  const ChannelIcon = view.template.channel === "sms" ? MessageSquareText : Mail;
  const hours = Math.floor(sim / 60);
  const minutes = Math.floor(sim % 60);
  return (
    <Card className="relative isolate overflow-hidden">
      <span aria-hidden className="light-sweep" />
      <CardBody className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)] md:items-center">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {view.cancelled ? (
              <Pill tone="neutral">{tcmp("status.cancelled")}</Pill>
            ) : finished ? (
              <Pill tone="safe">
                <Check aria-hidden />
                {t("finished")}
              </Pill>
            ) : (
              <Pill tone="risk">
                <span aria-hidden className="relative grid size-2 place-items-center">
                  <span className="absolute hidden size-2 rounded-full bg-risk-500 opacity-60 motion-full:block motion-full:animate-ping" />
                  <span className="size-2 rounded-full bg-risk-600" />
                </span>
                {t("live")}
              </Pill>
            )}
            <Pill tone="neutral">
              <ChannelIcon aria-hidden />
              {t(`channel.${view.template.channel}`)}
            </Pill>
            <Pill tone={view.template.difficulty === "Easy" ? "safe" : view.template.difficulty === "Medium" ? "warn" : "risk"}>{t(`difficulty.${view.template.difficulty}`)}</Pill>
            {offline ? <span className="text-tab text-warn-700">{t("reconnecting")}</span> : null}
          </div>
          <div className="min-w-0 rounded-lg border border-line bg-sunken/60 p-4">
            <p className="text-tab-sm font-bold tracking-wider text-ink-subtle uppercase">{t("lure")}</p>
            <p className="mt-1.5 truncate text-caption text-ink-muted">
              {t("from", { name: view.template.senderName })} · <span dir="ltr">{view.template.senderAddress}</span>
            </p>
            <p className="mt-0.5 text-body font-semibold text-balance text-ink">{view.template.subject}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-caption font-semibold text-ink-muted">
            <Timer aria-hidden className="size-4" />
            {t("clock")}
          </p>
          <p className="text-numeral font-bold text-ink tabular-nums" aria-live="off">
            {t("clockValue", { hours, minutes })}
            <span className="ms-2 text-body-sm font-semibold text-ink-subtle">{t("clockOf", { hours: view.simMinutes / 60 })}</span>
          </p>
          <ProgressBar value={(sim / view.simMinutes) * 100} tone={finished ? "safe" : "brand"} shimmer={!finished} decorative />
          <div className="mt-2 flex flex-wrap gap-2">
            {!finished ? (
              <Button size="sm" variant="secondary" icon={<FastForward />} disabled={pending} onClick={onSkip}>
                {t("skip")}
              </Button>
            ) : null}
            <ButtonLink size="sm" variant="ghost" href={`/admin/campaigns/${view.campaignId}`}>
              {t("openCampaign")}
            </ButtonLink>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Summary({ view, canLeadership, pct }: { view: DrillView; canLeadership: boolean; pct: (n: number) => string }) {
  const t = useTranslations("admin.drill");
  const format = useClientFormat();
  const { totals, risk } = view;
  const ratio = totals.clicked ? totals.reported / totals.clicked : totals.reported;
  return (
    <Card className="relative isolate overflow-hidden border-brand-100 bg-brand-50/60">
      <span aria-hidden className="light-sweep" />
      <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-title-sm font-bold text-ink">
            <Sparkles aria-hidden className="size-5 text-brand-600" />
            {t("summaryTitle")}
          </p>
          <p className="text-body-sm text-ink">
            {t("summaryClicks", {
              hours: view.simMinutes / 60,
              clicked: format.number(totals.clicked),
              delivered: format.number(totals.delivered),
              clickRate: pct(percent(totals.clicked, totals.delivered)),
              benchmark: pct(view.benchmark),
            })}{" "}
            {view.firstReport !== null
              ? t("summaryReports", { reported: format.number(totals.reported), minutes: format.number(Math.max(1, Math.round(view.firstReport))) })
              : t("summaryNoReports")}
          </p>
          {totals.clicked ? (
            <p className="text-body-sm text-ink">
              {risk.now < risk.peak
                ? t("summaryLoop", { trained: format.number(totals.trained), clicked: format.number(totals.clicked), before: format.number(risk.before), peak: format.number(risk.peak), now: format.number(risk.now) })
                : t("summaryLoopFlat", { trained: format.number(totals.trained), clicked: format.number(totals.clicked), before: format.number(risk.before), now: format.number(risk.now) })}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <ButtonLink size="sm" icon={<RotateCcw />} href="/admin/drill">
              {t("again")}
            </ButtonLink>
            <ButtonLink size="sm" variant="secondary" href={`/admin/campaigns/${view.campaignId}`}>
              {t("openCampaign")}
            </ButtonLink>
            {canLeadership ? (
              <ButtonLink size="sm" variant="secondary" href="/admin/leadership">
                {t("leadership")}
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <div className="grid justify-items-start gap-1 rounded-xl border border-line bg-surface p-5 lg:justify-items-end lg:text-end">
          <p className="text-caption font-semibold text-ink-muted">{t("resilience")}</p>
          <p className={cn("text-numeral font-bold tabular-nums", ratio >= 1 ? "text-safe-700" : "text-warn-700")}>{format.number(ratio, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</p>
          <p className="max-w-56 text-tab text-ink-subtle">{t("resilienceHint")}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Funnel({ view, pct }: { view: DrillView; pct: (n: number) => string }) {
  const t = useTranslations("admin.drill");
  const format = useClientFormat();
  const { totals } = view;
  const steps = [
    { key: "delivered" as const, value: totals.delivered, share: percent(totals.delivered, totals.audience), icon: Mail, tone: "brand" as const, bar: "bg-brand-600" },
    { key: "opened" as const, value: totals.opened, share: percent(totals.opened, totals.delivered), icon: MailOpen, tone: "brand" as const, bar: "bg-brand-400" },
    { key: "clicked" as const, value: totals.clicked, share: percent(totals.clicked, totals.delivered), icon: MousePointerClick, tone: "warn" as const, bar: "bg-warn-500" },
    ...(view.template.harvest ? [{ key: "submitted" as const, value: totals.submitted, share: percent(totals.submitted, totals.delivered), icon: KeyRound, tone: "risk" as const, bar: "bg-risk-600" }] : []),
    { key: "reported" as const, value: totals.reported, share: percent(totals.reported, totals.delivered), icon: Megaphone, tone: "safe" as const, bar: "bg-safe-600" },
  ];
  const iconTone = { brand: "bg-brand-50 text-brand-600", warn: "bg-warn-50 text-warn-700", risk: "bg-risk-50 text-risk-600", safe: "bg-safe-50 text-safe-600" };
  return (
    <ul className={cn("grid grid-cols-2 gap-3 max-lg:[&>li:last-child:nth-child(odd)]:col-span-2", view.template.harvest ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {steps.map((s) => (
        <li key={s.key} className="relative isolate flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-raised">
          {/* A pass of light each time the number moves. */}
          <span key={s.value} aria-hidden className="light-sweep" />
          <div className="flex items-center justify-between gap-2">
            <span className={cn("grid size-9 place-items-center rounded-sm [&_svg]:size-[1.1rem]", iconTone[s.tone])}>
              <s.icon aria-hidden />
            </span>
            <span className="text-tab font-semibold text-ink-subtle tabular-nums">{pct(s.share)}</span>
          </div>
          <div>
            <p className="text-numeral font-bold text-ink tabular-nums">{format.number(s.value)}</p>
            <p className="mt-1 text-caption font-medium text-ink-muted">{t(`funnel.${s.key}`)}</p>
          </div>
          <div className="relative mt-auto">
            <div aria-hidden className="h-2 overflow-hidden rounded-pill bg-sunken">
              <div className={cn("h-full rounded-pill transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)", s.bar)} style={{ width: `${s.share}%` }} />
            </div>
            {s.key === "clicked" ? (
              <>
                <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-pill bg-ink" style={{ insetInlineStart: `${view.benchmark}%` }} />
                <p className="mt-2 text-tab text-ink-subtle">{t("benchmark", { value: pct(view.benchmark) })}</p>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function People({ view }: { view: DrillView }) {
  const t = useTranslations("admin.drill");
  const format = useClientFormat();
  const groups = useMemo(() => {
    const map = new Map<string, DrillView["people"]>();
    for (const p of view.people) {
      const key = p.department ?? "";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [view.people]);
  const stateOf = (p: DrillView["people"][number]) => (p.trained ? t("states.trained") : t(`states.${p.outcome}`));
  return (
    <Card>
      <CardHeader title={t("peopleTitle")} description={t("peopleBody")} icon={<Users />} />
      <CardBody className="grid gap-5">
        {groups.map(([department, people]) => (
          <section key={department} className="grid gap-2">
            <h3 className="flex items-baseline gap-2 text-caption font-semibold text-ink">
              {department || t("noDepartment")}
              <span className="text-tab font-medium text-ink-subtle tabular-nums">{format.number(people.length)}</span>
            </h3>
            <ul className="flex flex-wrap gap-2">
              {people.map((p) => (
                <li key={p.id}>
                  <span
                    title={t("personState", { name: p.name, state: stateOf(p) })}
                    className={cn(
                      "relative grid size-11 place-items-center rounded-lg text-tab-sm font-bold transition-[background-color,color,box-shadow] duration-(--duration-slow)",
                      TILE[p.outcome],
                      p.trained && "ring-2 ring-safe-500 ring-offset-2 ring-offset-surface",
                    )}
                  >
                    <span aria-hidden>{p.initials}</span>
                    <span className="sr-only">{t("personState", { name: p.name, state: stateOf(p) })}</span>
                    {p.trained ? (
                      <span aria-hidden className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-safe-600 text-white ring-2 ring-surface motion-ok:animate-reveal">
                        <Check className="size-3" />
                      </span>
                    ) : p.reported && p.outcome !== "reported" ? (
                      <span aria-hidden className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-safe-600 text-white ring-2 ring-surface">
                        <ShieldCheck className="size-3" />
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-tab text-ink-muted">
          {(["pending", "delivered", "opened", "clicked", "submitted", "reported"] as const)
            .filter((o) => o !== "submitted" || view.template.harvest)
            .map((o) => (
              <li key={o} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 rounded-[0.25rem]", TILE[o])} />
                {t(`states.${o}`)}
              </li>
            ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[0.25rem] bg-sunken ring-2 ring-safe-500 ring-offset-1 ring-offset-surface" />
            {t("states.trained")}
          </li>
        </ul>
      </CardBody>
    </Card>
  );
}

function Feed({ view }: { view: DrillView }) {
  const t = useTranslations("admin.drill");
  return (
    <Card>
      <CardHeader title={t("feedTitle")} icon={<Zap />} />
      <CardBody className="pt-3">
        {view.feed.length ? (
          <ol role="log" aria-live="polite" aria-relevant="additions" className="grid gap-1">
            {view.feed.map((e) => {
              const Icon = FEED_ICON[e.kind];
              return (
                <li key={e.n} className="flex gap-3 rounded-md py-2 motion-ok:animate-reveal">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", FEED_TONE[e.kind])}>
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-caption text-ink">{t(`feed.${e.kind}`, { name: e.name, module: view.template.moduleTitle ?? "" })}</span>
                  <span className="shrink-0 text-tab text-ink-subtle tabular-nums">{t("feedTime", { minutes: Math.max(1, Math.round(e.sim)) })}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-body-sm text-ink-muted">{t("feedEmpty")}</p>
        )}
      </CardBody>
    </Card>
  );
}

function Race({ view }: { view: DrillView }) {
  const t = useTranslations("admin.drill");
  // The first hour, where the race is decided.
  const span = 60;
  const at = (m: number) => `${(Math.min(span, m) / span) * 100}%`;
  const rows = [
    { label: t("firstClick"), value: view.firstClick, tone: "bg-warn-500", text: "text-warn-700" },
    { label: t("firstReport"), value: view.firstReport, tone: "bg-safe-600", text: "text-safe-700" },
  ];
  return (
    <Card>
      <CardHeader title={t("race")} description={t("raceBody")} icon={<Timer />} />
      <CardBody className="grid gap-4">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-caption font-semibold text-ink">{r.label}</span>
              <span className={cn("text-caption font-semibold tabular-nums", r.value === null ? "text-ink-subtle" : r.text)}>
                {r.value === null ? t("notYet") : t("minutesAfter", { minutes: Math.max(1, Math.round(r.value)) })}
              </span>
            </div>
            <div aria-hidden className="relative h-2 rounded-pill bg-sunken">
              {r.value !== null ? (
                <span className={cn("absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full ring-2 ring-surface transition-[inset-inline-start] duration-(--duration-slow) ltr:-translate-x-1/2 rtl:translate-x-1/2", r.tone)} style={{ insetInlineStart: at(r.value) }} />
              ) : null}
            </div>
          </div>
        ))}
        <div aria-hidden className="flex justify-between text-tab text-ink-subtle tabular-nums">
          <span>0</span>
          <span>{t("feedTime", { minutes: span })}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function Risk({ view }: { view: DrillView }) {
  const t = useTranslations("admin.drill");
  const format = useClientFormat();
  const { before, peak, now, trail } = view.risk;
  const fromPeak = peak - now;
  const tone = (n: number) => (n >= 67 ? "risk" : n >= 34 ? "warn" : "safe");
  const values = [
    { key: "riskBefore" as const, value: before, className: "text-title text-ink-muted" },
    { key: "riskPeak" as const, value: peak, className: "text-title text-warn-700" },
    { key: "riskNow" as const, value: now, className: "text-numeral text-ink" },
  ];
  return (
    <Card>
      <CardHeader title={t("riskTitle")} description={t("riskBody")} icon={now <= before ? <TrendingDown /> : <TrendingUp />} />
      <CardBody className="grid gap-4">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          {values.map((v) => (
            <div key={v.key}>
              <p className="text-caption text-ink-muted">{t(v.key)}</p>
              <p className={cn("font-bold tabular-nums", v.className)}>{format.number(v.value)}</p>
            </div>
          ))}
          {fromPeak > 0 ? (
            <Pill tone="safe" className="mb-1.5">
              <TrendingDown aria-hidden />
              {t("riskFromPeak", { value: fromPeak })}
            </Pill>
          ) : null}
        </div>
        <RiskCurve trail={trail} before={before} simMinutes={view.simMinutes} durationMs={view.durationMs} />
        <ProgressBar value={now} tone={tone(now)} label={t("riskTitle")} size="sm" />
      </CardBody>
    </Card>
  );
}

/**
 * The audience's average risk over the drill (decorative: the numbers above say the same). The x axis is the
 * playback's own clock, so the curve moves in step with the dashboard; the dashed line is the starting score.
 */
function RiskCurve({ trail, before, simMinutes, durationMs }: { trail: { sim: number; risk: number }[]; before: number; simMinutes: number; durationMs: number }) {
  if (trail.length < 2) return <div aria-hidden className="h-16 rounded-md bg-sunken/60" />;
  const W = 300;
  const H = 64;
  const values = trail.map((p) => p.risk);
  const lo = Math.min(before, ...values) - 2;
  const hi = Math.max(before, ...values) + 2;
  const x = (sim: number) => (simToMs(sim, durationMs, simMinutes) / durationMs) * W;
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
  // A step line: the score holds until the next batch changes it.
  const d = trail.map((p, i) => (i ? `H${x(p.sim).toFixed(1)}V${y(p.risk).toFixed(1)}` : `M${x(p.sim).toFixed(1)},${y(p.risk).toFixed(1)}`)).join("");
  const last = trail[trail.length - 1];
  const top = trail.reduce((a, b) => (b.risk > a.risk ? b : a));
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="h-16 w-full overflow-visible rtl:-scale-x-100" preserveAspectRatio="none">
      <line x1="0" x2={W} y1={y(before)} y2={y(before)} stroke="currentColor" className="text-line-strong" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(top.sim)} cy={y(top.risk)} r="3" className="fill-warn-500" />
      <circle cx={x(last.sim)} cy={y(last.risk)} r="3.5" fill="var(--brand)" />
    </svg>
  );
}

function Automation({ totals }: { totals: DrillView["totals"] }) {
  const t = useTranslations("admin.drill");
  const format = useClientFormat();
  const items = [
    { key: "moments" as const, value: totals.clicked, icon: Sparkles },
    { key: "assigned" as const, value: totals.clicked, icon: GraduationCap },
    { key: "closed" as const, value: totals.trained, icon: ShieldCheck },
    { key: "matched" as const, value: totals.reported, icon: Megaphone },
  ];
  return (
    <Card>
      <CardHeader title={t("automation")} icon={<Zap />} />
      <CardBody>
        <ul className="grid grid-cols-2 gap-4">
          {items.map((i) => (
            <li key={i.key} className="grid gap-1">
              <i.icon aria-hidden className="size-4 text-brand-600" />
              <span className="text-title font-bold text-ink tabular-nums">{format.number(i.value)}</span>
              <span className="text-tab text-ink-muted">{t(`auto.${i.key}`)}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
