"use server";

import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db, t } from "../db";
import { logFailure } from "../db/errors";
import { actionViewer, allowed } from "../auth/viewer";
import { insertNumbered, submitThreatReport } from "../services/threats";
import { analyzeFile, analyzeUrl, MAX_FILE_BYTES, type Analysis } from "../sandbox/analyze";
import { audit } from "../services/audit";
import { emitEvent } from "../services/events";
import { rateLimit } from "../rate-limit";
import { clientIp } from "../request";
import { recomputeRisk } from "../services/risk";
import { isUuid } from "../../lib/ids";

export type ReportState = { ok?: boolean; number?: number; simulation?: boolean; xp?: number; error?: string } | undefined;

const reportSchema = z.object({
  channel: z.enum(["email", "sms", "call", "link", "file", "in_person", "other"]),
  subject: z.string().trim().min(3).max(300),
  details: z.string().trim().max(4000).optional(),
  url: z.string().trim().max(2000).optional(),
});

export async function reportThreatAction(_: ReportState, form: FormData): Promise<ReportState> {
  const v = await actionViewer();
  const parsed = reportSchema.safeParse({
    channel: form.get("channel"),
    subject: form.get("subject"),
    details: form.get("details") || undefined,
    url: form.get("url") || undefined,
  });
  if (!parsed.success) return { error: "subject" };
  if (!(await rateLimit(`threat-report:${v.user.id}`, 20, 60 * 60_000)).ok) return { error: "rateLimited" };
  const res = await submitThreatReport(db(), { tenantId: v.tenant.id, userId: v.user.id, ...parsed.data, ip: await clientIp() });
  if (res.simulation) await recomputeRisk(db(), v.tenant.id, [v.user.id]);
  refresh();
  return { ok: true, ...res };
}

export type SandboxState = { analysis?: Analysis & { id: string; number: number }; error?: string; escalated?: boolean } | undefined;

async function storeAnalysis(tenantId: string, userId: string, a: Analysis) {
  const { number, row } = await insertNumbered(db(), t.sandboxAnalyses, tenantId, 500, async (number) => {
    const [inserted] = await db()
      .insert(t.sandboxAnalyses)
      .values({ tenantId, number, kind: a.kind, objectName: a.objectName, sha256: a.sha256, sizeBytes: a.sizeBytes, verdict: a.verdict, score: a.score, findings: a.findings, iocs: a.iocs, mitre: a.mitre, submittedBy: userId })
      .returning({ id: t.sandboxAnalyses.id });
    return inserted;
  });
  await audit(db(), { tenantId, actorId: userId, action: "sandbox.analyzed", targetType: "sandbox", targetId: row.id, meta: { number: `SB-${number}`, verdict: a.verdict } });
  if (a.verdict === "malicious") await emitEvent(db(), tenantId, "sandbox.malicious", { number: `SB-${number}`, kind: a.kind, sha256: a.sha256, iocs: a.iocs });
  return { id: row.id, number };
}

export async function analyzeAction(prev: SandboxState, form: FormData): Promise<SandboxState> {
  // A failure (database unavailable) answers with the generic error on the form that was sent, instead of replacing the
  // sandbox panel with the error boundary; redirect() and notFound() still pass through.
  try {
    return await analyze(prev, form);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("[sandbox] analysis failed", error);
    return { error: "generic" };
  }
}

async function analyze(_: SandboxState, form: FormData): Promise<SandboxState> {
  const v = await actionViewer();
  if (!v.tenant.features.has("sandbox")) return { error: "forbidden" };
  if (!(await rateLimit(`sandbox:${v.user.id}`, 30, 10 * 60_000)).ok) return { error: "rateLimited" };
  const kind = form.get("kind");
  let analysis: Analysis;
  if (kind === "url") {
    const url = String(form.get("url") ?? "").trim();
    if (!url) return { error: "noUrl" };
    analysis = analyzeUrl(url.slice(0, 2000));
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
    if (file.size > MAX_FILE_BYTES) return { error: "tooBig" };
    // Bytes are analysed in memory and discarded; only the hash and findings are stored.
    analysis = analyzeFile(file.name, Buffer.from(await file.arrayBuffer()));
  }
  const stored = await storeAnalysis(v.tenant.id, v.user.id, analysis);
  refresh();
  return { analysis: { ...analysis, ...stored } };
}

/** The learner sends a sandbox result to the incident response team (becomes a threat report). */
export async function escalateAnalysisAction(id: string): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  if (!isUuid(id) || !v.tenant.features.has("sandbox")) return { ok: false };
  if (!(await rateLimit(`sandbox-escalate:${v.user.id}`, 10, 60 * 60_000)).ok) return { ok: false };
  const [a] = await db()
    .select()
    .from(t.sandboxAnalyses)
    .where(and(eq(t.sandboxAnalyses.id, id), eq(t.sandboxAnalyses.tenantId, v.tenant.id)));
  if (!a || (a.submittedBy !== v.user.id && !allowed(v, "secops.read"))) return { ok: false };
  // One report per analysis (SB numbers are unique per organisation): sending it again only reaches the same report.
  const subject = `SB-${a.number}: ${a.objectName}`.slice(0, 300);
  const [sent] = await db()
    .select({ id: t.threatReports.id })
    .from(t.threatReports)
    .where(and(eq(t.threatReports.tenantId, v.tenant.id), eq(t.threatReports.subject, subject)))
    .limit(1);
  if (sent) return { ok: true };
  // The analysts read the report in the organisation's language, not the learner's.
  const tr = await getTranslations({ locale: v.tenant.settings.defaultLocale, namespace: "security.sandbox" });
  await submitThreatReport(db(), {
    tenantId: v.tenant.id,
    userId: v.user.id,
    channel: a.kind === "url" ? "link" : "file",
    subject,
    details: tr("escalatedDetails", { verdict: tr(`verdict.${a.verdict as "clean"}`), score: a.score }),
    url: a.kind === "url" ? a.objectName : null,
    ip: await clientIp(),
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "sandbox.escalated", targetType: "sandbox", targetId: a.id, meta: { number: `SB-${a.number}` } });
  refresh();
  return { ok: true };
}
