"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Check, ChevronRight, FlaskConical, Pencil, Recycle, X } from "lucide-react";
import {
  advanceLoopAction,
  analyzeReportUrlAction,
  closeLoopAction,
  convertPolicyIntelAction,
  convertReportAction,
  convertThreatIntelAction,
  decideMaterialAction,
  dismissReportAction,
  editMaterialAction,
  setIntelStatusAction,
  setLoopVerdictAction,
  triageReportAction,
} from "@/server/actions/secops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
type Option = { id: string; label: string };

/* ───────── threat intake ───────── */

export function ReportActions({
  report,
  incidentsOn,
  sandboxOn,
  loopsOn,
}: {
  report: { id: string; status: "new" | "triaged" | "converted" | "dismissed"; severity: string | null; subject: string; url: string | null };
  incidentsOn: boolean;
  sandboxOn: boolean;
  /** Converting opens a closed loop, which only Enterprise plans have. */
  loopsOn: boolean;
}) {
  const t = useTranslations("secops.threats");
  const tc = useTranslations("common");
  const tv = useTranslations("security.sandbox");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(report.subject);
  const [sev, setSev] = useState(report.severity ?? "medium");
  const [incident, setIncident] = useState(false);
  const router = useRouter();
  const done = report.status === "converted" || report.status === "dismissed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!done ? (
        <Select
          aria-label={t("severity")}
          className="h-9 w-32 pointer-coarse:h-11"
          value={report.severity ?? ""}
          disabled={pending}
          onChange={(e) => start(async () => void ((await triageReportAction(report.id, e.target.value)).ok && toast(t("triaged"))))}
        >
          <option value="" disabled>
            {t("triage")}
          </option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {tc(`severity.${s}`)}
            </option>
          ))}
        </Select>
      ) : null}
      {report.url && sandboxOn ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<FlaskConical />}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await analyzeReportUrlAction(report.id);
              if (res.ok) toast(t("analyzed", { number: res.number!, verdict: tv(`verdict.${res.verdict as "clean"}`) }), res.verdict === "clean" ? "success" : "error");
              else toast(res.error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.generic"), "error");
            })
          }
        >
          {t("analyze")}
        </Button>
      ) : null}
      {!done ? (
        <>
          {loopsOn ? (
            <Button size="sm" variant="secondary" icon={<Recycle />} onClick={() => setOpen(true)} disabled={pending}>
              {t("convert")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" icon={<Ban />} disabled={pending} onClick={() => start(async () => void ((await dismissReportAction(report.id)).ok && toast(t("dismissed"))))} title={t("dismissBody")}>
            {t("dismiss")}
          </Button>
        </>
      ) : null}
      {loopsOn ? (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={t("convert")}
          description={t("convertBody")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button
                disabled={pending || title.trim().length < 3}
                onClick={() =>
                  start(async () => {
                    const res = await convertReportAction(report.id, { title, severity: sev as "medium", incident });
                    if (!res.ok) return toast(res.error === "already" || res.error === "plan" ? t(`errors.${res.error}`) : tc("errors.generic"), "error");
                    setOpen(false);
                    toast(t("converted"));
                    router.push(res.incidentId ? `/admin/incidents/${res.incidentId}` : `/admin/loops/${res.loopId}`);
                  })
                }
              >
                {t("convert")}
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Field label={t("loopTitle")} htmlFor={`cv-title-${report.id}`}>
              <Input id={`cv-title-${report.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
            </Field>
            <Field label={t("severity")} htmlFor={`cv-sev-${report.id}`}>
              <Select id={`cv-sev-${report.id}`} value={sev} onChange={(e) => setSev(e.target.value)} className="max-w-48">
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {tc(`severity.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {incidentsOn ? <Checkbox label={t("alsoIncident")} checked={incident} onChange={(e) => setIncident(e.target.checked)} /> : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

/* ───────── closed loops ───────── */

export function LoopActions({ id, next, verdict, closed }: { id: string; next: string | null; verdict: string; closed: boolean }) {
  const t = useTranslations("secops.loops");
  const ts = useTranslations("secops");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"advance" | "close" | null>(null);
  const [note, setNote] = useState("");
  if (closed) return null;
  const submit = () =>
    start(async () => {
      const res = mode === "close" ? await closeLoopAction(id, note) : await advanceLoopAction(id, next!, note);
      if (!res.ok) return toast(tc("errors.generic"), "error");
      toast(mode === "close" ? t("closedToast") : t("moved"));
      setMode(null);
      setNote("");
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t("setVerdict")}
        className="h-10 w-40 pointer-coarse:h-11"
        value={verdict}
        disabled={pending}
        onChange={(e) => start(async () => void ((await setLoopVerdictAction(id, e.target.value)).ok && toast(t("moved"))))}
      >
        {(["pending", "malicious", "suspicious", "benign"] as const).map((v) => (
          <option key={v} value={v}>
            {ts(`verdicts.${v}`)}
          </option>
        ))}
      </Select>
      {next ? (
        // The stage name can be long ("Перейти к этапу «Преобразование»"): let the label wrap on narrow phones.
        <Button icon={<ChevronRight />} onClick={() => setMode("advance")} disabled={pending} className="h-auto min-h-10 max-w-full py-2 text-start whitespace-normal pointer-coarse:min-h-11">
          {t("next", { stage: ts(`stages.${next as "analysis"}`) })}
        </Button>
      ) : null}
      <Button variant="secondary" icon={<Check />} onClick={() => setMode("close")} disabled={pending}>
        {t("close")}
      </Button>
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "close" ? t("close") : next ? t("next", { stage: ts(`stages.${next as "analysis"}`) }) : ""}
        description={mode === "close" ? t("closeBody") : next ? ts(`stageHelp.${next as "analysis"}`) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {tc("confirm")}
            </Button>
          </>
        }
      >
        <Field label={t("note")} htmlFor={`loop-note-${id}`}>
          <Textarea id={`loop-note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} maxLength={1000} />
        </Field>
      </Dialog>
    </div>
  );
}

/* ───────── approval gate ───────── */

export function MaterialDecision({ id, status, title, body }: { id: string; status: "pending" | "second_approval"; title: string; body: string }) {
  const t = useTranslations("secops.approvals");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"reject" | "edit" | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState({ title, body });
  const approve = () =>
    start(async () => {
      const res = await decideMaterialAction(id, "approve");
      if (!res.ok) return toast(res.error === "sameApprover" ? t("sameApprover") : tc("errors.generic"), "error");
      toast(res.stage === "second_approval" ? t("firstApproved") : t("approved", { count: res.count ?? 0 }));
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="safe" icon={<Check />} onClick={approve} disabled={pending}>
        {status === "second_approval" ? t("secondApprove") : t("approve")}
      </Button>
      <Button variant="secondary" icon={<Pencil />} onClick={() => setMode("edit")} disabled={pending}>
        {t("edit")}
      </Button>
      <Button variant="danger-soft" icon={<X />} onClick={() => setMode("reject")} disabled={pending}>
        {t("reject")}
      </Button>
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "reject" ? t("reject") : t("edit")}
        size={mode === "edit" ? "lg" : "md"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {tc("cancel")}
            </Button>
            {mode === "reject" ? (
              <Button
                variant="danger"
                disabled={pending || !reason.trim()}
                onClick={() =>
                  start(async () => {
                    const res = await decideMaterialAction(id, "reject", reason);
                    if (!res.ok) return toast(tc("errors.generic"), "error");
                    toast(t("rejected"));
                    setMode(null);
                  })
                }
              >
                {t("reject")}
              </Button>
            ) : (
              <Button
                disabled={pending || draft.title.trim().length < 3 || draft.body.trim().length < 10}
                onClick={() =>
                  start(async () => {
                    const res = await editMaterialAction(id, draft);
                    if (!res.ok) return toast(tc("errors.invalid"), "error");
                    toast(t("edited"));
                    setMode(null);
                  })
                }
              >
                {t("saveEdit")}
              </Button>
            )}
          </>
        }
      >
        {mode === "reject" ? (
          <Field label={t("rejectReason")} htmlFor={`rej-${id}`}>
            <Textarea id={`rej-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
        ) : (
          <div className="grid gap-4">
            <Field label={t("title")} htmlFor={`ed-title-${id}`}>
              <Input id={`ed-title-${id}`} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} />
            </Field>
            <Field label={t("body")} htmlFor={`ed-body-${id}`}>
              <Textarea id={`ed-body-${id}`} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-48" maxLength={5000} />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ───────── intelligence ───────── */

export function IntelActions({
  id,
  kind,
  status,
  modules,
  departments,
  canConvert,
  canReview,
}: {
  id: string;
  kind: "threat" | "policy";
  status: "new" | "reviewed" | "converted" | "dismissed";
  modules: Option[];
  departments: Option[];
  canConvert: boolean;
  /** Triage (reviewed / dismissed) needs the team's write permission; reading the feed alone does not allow it. */
  canReview: boolean;
}) {
  const t = useTranslations("secops.intel");
  const ts = useTranslations("secops");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [moduleId, setModuleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const router = useRouter();
  if (status === "converted" || (!canConvert && !canReview)) return null;
  const convert = () =>
    start(async () => {
      if (kind === "policy") {
        const res = await convertPolicyIntelAction(id);
        if (!res.ok) return toast(tc("errors.generic"), "error");
        toast(t("convertedPolicy"));
        router.push(`/admin/policies/${res.policyId}`);
        return;
      }
      const res = await convertThreatIntelAction(id, { moduleId: moduleId || null, departmentId: departmentId || null });
      if (!res.ok) return toast(tc("errors.generic"), "error");
      setOpen(false);
      toast(t("convertedThreat"));
      router.push(`/admin/loops/${res.loopId}`);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {canConvert ? (
        <Button size="sm" icon={<Recycle />} disabled={pending} onClick={() => (kind === "policy" ? convert() : setOpen(true))} title={kind === "policy" ? t("convertPolicyBody") : t("convertThreatBody")}>
          {kind === "policy" ? t("convertPolicy") : t("convertThreat")}
        </Button>
      ) : null}
      {canReview && status === "new" ? (
        <Button size="sm" variant="secondary" icon={<Check />} disabled={pending} onClick={() => start(async () => void ((await setIntelStatusAction(id, "reviewed")).ok && toast(t("updated"))))}>
          {t("review")}
        </Button>
      ) : null}
      {canReview && status !== "dismissed" ? (
        <Button size="sm" variant="ghost" icon={<Ban />} disabled={pending} onClick={() => start(async () => void ((await setIntelStatusAction(id, "dismissed")).ok && toast(t("updated"))))}>
          {t("dismiss")}
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("convertThreat")}
        description={t("convertThreatBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={convert} disabled={pending}>
              {t("convertThreat")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("module")} htmlFor={`intel-mod-${id}`}>
            <Select id={`intel-mod-${id}`} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="">{ts("approvals.noModule")}</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("audience")} htmlFor={`intel-aud-${id}`}>
            <Select id={`intel-aud-${id}`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">{t("everyone")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
