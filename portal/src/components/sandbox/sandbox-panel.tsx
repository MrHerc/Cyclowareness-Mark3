"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, FileSearch, FlaskConical, Link2, Send, ShieldAlert, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { analyzeAction, escalateAnalysisAction, type SandboxState } from "@/server/actions/security";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { defang } from "@/lib/defang";
import { cn } from "@/lib/cn";

type Finding = { id: string; severity: "info" | "low" | "medium" | "high"; weight: number; params?: Record<string, string | number> };

export function VerdictBadge({ verdict }: { verdict: "clean" | "suspicious" | "malicious" }) {
  const t = useTranslations("security");
  return <Pill tone={verdict === "clean" ? "safe" : verdict === "suspicious" ? "warn" : "risk"}>{t(`sandbox.verdict.${verdict}`)}</Pill>;
}

export function AnalysisResult({
  a,
  onEscalate,
  stixHref,
}: {
  a: { number: number; kind: "url" | "file"; objectName: string; sha256: string | null; verdict: "clean" | "suspicious" | "malicious"; score: number; findings: Finding[]; iocs: { type: string; value: string }[]; mitre: string[] };
  onEscalate?: () => void;
  stixHref?: string;
}) {
  const t = useTranslations("security");
  const ts = useTranslations("secops");
  const Icon = a.verdict === "clean" ? ShieldCheck : a.verdict === "suspicious" ? ShieldAlert : ShieldX;
  return (
    <Card className={cn("overflow-hidden", a.verdict === "malicious" ? "border-risk-100" : a.verdict === "suspicious" ? "border-warn-100" : "border-safe-100")}>
      <div className={cn("flex flex-wrap items-center gap-4 p-5", a.verdict === "malicious" ? "bg-risk-50" : a.verdict === "suspicious" ? "bg-warn-50" : "bg-safe-50")}>
        <Icon className={cn("size-10", a.verdict === "malicious" ? "text-risk-600" : a.verdict === "suspicious" ? "text-warn-700" : "text-safe-600")} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-tab text-ink-subtle">SB-{a.number}</p>
          <p dir="ltr" className="truncate font-mono text-body-sm font-semibold">{a.kind === "url" ? defang(a.objectName) : a.objectName}</p>
          <p className="mt-1 text-caption text-ink-muted">{t(`sandbox.verdictBody.${a.verdict}`)}</p>
        </div>
        <div className="text-end">
          <VerdictBadge verdict={a.verdict} />
          <p className="mt-1 text-title font-bold tabular-nums">
            {a.score}
            <span className="text-caption font-normal text-ink-subtle">/100</span>
          </p>
        </div>
      </div>
      <CardBody className="grid gap-5">
        <div>
          <p className="mb-2 text-caption font-semibold text-ink-muted">{t("sandbox.findings")}</p>
          <ul className="grid gap-2">
            {a.findings.map((f, i) => (
              <li key={`${f.id}-${i}`} className="flex items-start gap-2.5 text-body-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", f.severity === "high" ? "bg-risk-500" : f.severity === "medium" ? "bg-warn-500" : f.severity === "low" ? "bg-brand-400" : "bg-safe-500")} />
                <span className="flex-1">{t(`findings.${f.id}` as "findings.file.no_findings", (f.params ?? {}) as Record<string, string>)}</span>
                {f.weight ? <span className="text-tab text-ink-subtle tabular-nums">+{f.weight}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        {a.iocs.length ? (
          <div>
            <p className="mb-2 text-caption font-semibold text-ink-muted">{t("sandbox.indicators")}</p>
            <ul className="grid gap-1.5">
              {a.iocs.slice(0, 12).map((i, k) => (
                <li key={k} className="flex gap-2 font-mono text-tab">
                  <span className="w-24 shrink-0 text-ink-subtle">{ts(`iocTypes.${i.type as "domain"}`)}</span>
                  <span dir="ltr" className="min-w-0 break-all">{i.type === "url" || i.type === "domain" ? defang(i.value) : i.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {a.mitre.length ? (
          <div>
            <p className="mb-2 text-caption font-semibold text-ink-muted">{t("sandbox.mitre")}</p>
            <div className="flex flex-wrap gap-1.5">
              {a.mitre.map((m) => (
                <a key={m} href={`https://attack.mitre.org/techniques/${m.replace(".", "/")}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-pill bg-ink px-2.5 py-1 font-mono text-tab-sm font-semibold text-white hover:bg-ink/85 pointer-coarse:min-h-11 pointer-coarse:px-3.5">
                  {m}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onEscalate && a.verdict !== "clean" ? (
            <Button variant="danger" size="sm" icon={<Send />} onClick={onEscalate}>
              {t("sandbox.escalate")}
            </Button>
          ) : null}
          {stixHref ? (
            <a href={stixHref} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-line-strong px-3.5 text-caption font-semibold hover:bg-sunken pointer-coarse:h-11">
              {ts("sandbox.stix")}
            </a>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

// A rejected analysis (server unreachable, a deploy in between) becomes the generic error on its form instead of
// replacing the sandbox panel with the error boundary.
function submitAnalysis(prev: SandboxState, data: FormData): Promise<SandboxState> {
  return analyzeAction(prev, data).catch((): SandboxState => ({ error: "generic" }));
}

export function SandboxPanel({ analyst = false }: { analyst?: boolean }) {
  const t = useTranslations("security.sandbox");
  const tc = useTranslations("common");
  const [fileState, fileAction, filePending] = useActionState<SandboxState, FormData>(submitAnalysis, undefined);
  const [urlState, urlAction, urlPending] = useActionState<SandboxState, FormData>(submitAnalysis, undefined);
  const [, startSubmit] = useTransition();
  const [last, setLast] = useState<"file" | "url" | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const state = last === "file" ? fileState : last === "url" ? urlState : undefined;
  const errText = (e?: string) => (e === "rateLimited" ? t("errors.rateLimited") : e === "tooBig" ? t("errors.tooBig") : e === "noFile" ? t("errors.noFile") : e === "noUrl" ? t("errors.noUrl") : e ? tc("errors.generic") : null);

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("file")} icon={<Upload />} />
          <CardBody>
            {/* Both forms are sent through a transition, so React skips its form reset: after a refused or failed check the
                chosen file is still attached (matching the name shown) and the typed link is kept. */}
            <form
              action={fileAction}
              onSubmit={(e) => {
                e.preventDefault();
                setLast("file");
                const data = new FormData(e.currentTarget);
                startSubmit(() => fileAction(data));
              }}
              className="grid gap-4"
            >
              <input type="hidden" name="kind" value="file" />
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && fileInput.current) {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    fileInput.current.files = dt.files;
                    setFileName(f.name);
                  }
                }}
                className={cn("grid cursor-pointer place-items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors", dragging ? "border-brand-600 bg-brand-50" : "border-line-strong hover:bg-sunken")}
              >
                <input ref={fileInput} type="file" name="file" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
                <span className="grid size-12 place-items-center rounded-lg bg-brand-600 text-brand-on shadow-raised">
                  <Upload className="size-6" />
                </span>
                <span className="mt-3 text-body-sm font-semibold">
                  {fileName ??
                    t.rich("fileDrop", {
                      pick: (c) => <span className="text-brand-600 underline">{c}</span>,
                    })}
                </span>
                <span className="mt-1 text-tab text-ink-subtle">{t("fileHint")}</span>
              </label>
              {last === "file" && errText(fileState?.error) ? <p className="text-caption text-risk-600">{errText(fileState?.error)}</p> : null}
              <SubmitButton icon={<FlaskConical />} disabled={!fileName} pending={filePending}>
                {t("analyzeFile")}
              </SubmitButton>
            </form>
            <p className="mt-5 text-tab-sm font-bold tracking-wide text-ink-muted uppercase">{t("checks")}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {(t.raw("fileChecks") as string[]).map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-tab text-ink-muted">
                  <Check className="size-3.5 text-safe-600" />
                  {c}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("url")} icon={<Link2 />} />
          <CardBody>
            <form
              action={urlAction}
              onSubmit={(e) => {
                e.preventDefault();
                setLast("url");
                const data = new FormData(e.currentTarget);
                startSubmit(() => urlAction(data));
              }}
              className="grid gap-4"
            >
              <input type="hidden" name="kind" value="url" />
              <label className="grid gap-1.5">
                <span className="text-caption font-semibold">{t("urlLabel")}</span>
                <Input name="url" placeholder="https://…" inputMode="url" spellCheck={false} autoComplete="off" maxLength={2000} />
                <span className="text-tab text-ink-subtle">{t("urlHint")}</span>
              </label>
              {last === "url" && errText(urlState?.error) ? <p className="text-caption text-risk-600">{errText(urlState?.error)}</p> : null}
              <SubmitButton icon={<FileSearch />} pending={urlPending}>
                {t("analyzeUrl")}
              </SubmitButton>
            </form>
            <p className="mt-5 text-tab-sm font-bold tracking-wide text-ink-muted uppercase">{t("checks")}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {(t.raw("urlChecks") as string[]).map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-tab text-ink-muted">
                  <Check className="size-3.5 text-safe-600" />
                  {c}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      {state?.analysis ? (
        <div className="animate-rise">
          <AnalysisResult
            a={state.analysis}
            stixHref={analyst ? `/api/sandbox/${state.analysis.id}/stix` : undefined}
            onEscalate={
              escalated.has(state.analysis.id) || pending
                ? undefined
                : () =>
                    start(async () => {
                      const res = await escalateAnalysisAction(state.analysis!.id).catch(() => ({ ok: false }));
                      if (res.ok) {
                        setEscalated(new Set(escalated).add(state.analysis!.id));
                        toast(t("escalated"));
                      } else toast(tc("errors.generic"), "error");
                    })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
