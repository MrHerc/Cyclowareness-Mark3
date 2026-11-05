"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, allowed, type Viewer } from "../auth/viewer";
import { audit } from "../services/audit";
import { advanceLoop, assignIncidentTraining, closeLoop, createIncident, createLoop, targetTraining } from "../services/secops";
import { insertNumbered } from "../services/threats";
import { analyzeUrl } from "../sandbox/analyze";
import { emitEvent } from "../services/events";
import { departmentClosure } from "../services/assignments";
import { aiEnabled, draftLesson, lessonDraftSchema, type LessonDraft } from "../ai";
import { rateLimit } from "../rate-limit";
import { isLocale, LOCALES, pick } from "../../i18n/config";
import { AUDIENCES, CATEGORIES } from "../../lib/domain/catalog";
import { LAB_IDS } from "../../lib/domain/labs";
import { parseDay } from "../../lib/day";
import { isForeignKeyViolation } from "../db/errors";

const uuid = z.string().uuid();
const severity = z.enum(t.SEVERITY);
/** A real calendar day: 2026-02-31 would make the date column throw. */
const day = z.string().refine((s) => parseDay(s) !== null);
type Result = { ok: boolean; error?: string; field?: string };

/* ───────── threat intake ───────── */

async function ownReport(v: Viewer, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [r] = await db().select().from(t.threatReports).where(and(eq(t.threatReports.id, id), eq(t.threatReports.tenantId, v.tenant.id)));
  return r ?? null;
}

export async function triageReportAction(id: string, sev: string): Promise<Result> {
  const v = await actionViewer("secops.write");
  const s = severity.safeParse(sev);
  const r = await ownReport(v, id);
  if (!r || !s.success) return { ok: false };
  await db().update(t.threatReports).set({ severity: s.data, status: r.status === "new" ? "triaged" : r.status }).where(eq(t.threatReports.id, r.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "threat.triaged", targetType: "threat_report", targetId: r.id, meta: { number: `TR-${r.number}`, severity: s.data } });
  refresh();
  return { ok: true };
}

export async function dismissReportAction(id: string): Promise<Result> {
  const v = await actionViewer("secops.write");
  const r = await ownReport(v, id);
  if (!r) return { ok: false };
  await db().update(t.threatReports).set({ status: "dismissed" }).where(eq(t.threatReports.id, r.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "threat.triaged", targetType: "threat_report", targetId: r.id, meta: { number: `TR-${r.number}`, status: "dismissed" } });
  refresh();
  return { ok: true };
}

const convertSchema = z.object({ title: z.string().trim().min(3).max(300), severity, incident: z.boolean() });

/** Report → closed loop (and optionally an incident with the reporter as the first target). */
export async function convertReportAction(id: string, input: z.infer<typeof convertSchema>): Promise<Result & { loopId?: string; incidentId?: string }> {
  const v = await actionViewer("secops.write");
  // Loops are an Enterprise feature; without it the report → incident path lives under /admin/incidents.
  if (!v.tenant.features.has("closed_loops")) return { ok: false, error: "plan" };
  const p = convertSchema.safeParse(input);
  const r = await ownReport(v, id);
  if (!r || !p.success) return { ok: false };
  if (r.status === "converted") return { ok: false, error: "already" };
  let incidentId: string | null = null;
  if (p.data.incident && v.tenant.features.has("incidents")) {
    const inc = await createIncident(db(), { tenantId: v.tenant.id, actorId: v.user.id, title: p.data.title, description: r.details, severity: p.data.severity, source: "report", reportId: r.id, iocs: r.url ? [{ type: "url", value: r.url }] : [] });
    incidentId = inc.id;
  }
  const loopId = await createLoop(db(), { tenantId: v.tenant.id, title: p.data.title, sourceType: "report", sourceId: `TR-${r.number}`, verdict: p.data.severity === "low" ? "suspicious" : "malicious", stage: "conversion", actorId: v.user.id, incidentId });
  await db().update(t.threatReports).set({ status: "converted", severity: p.data.severity }).where(eq(t.threatReports.id, r.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "threat.triaged", targetType: "threat_report", targetId: r.id, meta: { number: `TR-${r.number}`, status: "converted" } });
  refresh();
  return { ok: true, loopId, incidentId: incidentId ?? undefined };
}

/** Runs the static URL analyser on the link in a report and stores the result. */
export async function analyzeReportUrlAction(id: string): Promise<Result & { number?: number; verdict?: string }> {
  const v = await actionViewer("secops.write");
  const r = await ownReport(v, id);
  if (!r?.url || !v.tenant.features.has("sandbox")) return { ok: false };
  if (!(await rateLimit(`sandbox:${v.user.id}`, 30, 10 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  const a = analyzeUrl(r.url);
  const { number, row } = await insertNumbered(db(), t.sandboxAnalyses, v.tenant.id, 500, async (number) => {
    const [inserted] = await db()
      .insert(t.sandboxAnalyses)
      .values({ tenantId: v.tenant.id, number, kind: a.kind, objectName: a.objectName, sha256: a.sha256, sizeBytes: a.sizeBytes, verdict: a.verdict, score: a.score, findings: a.findings, iocs: a.iocs, mitre: a.mitre, submittedBy: v.user.id })
      .returning({ id: t.sandboxAnalyses.id });
    return inserted;
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "sandbox.analyzed", targetType: "sandbox", targetId: row.id, meta: { number: `SB-${number}`, verdict: a.verdict } });
  if (a.verdict === "malicious") await emitEvent(db(), v.tenant.id, "sandbox.malicious", { number: `SB-${number}`, kind: a.kind, iocs: a.iocs });
  refresh();
  return { ok: true, number, verdict: a.verdict };
}

/* ───────── closed loops ───────── */

const stageSchema = z.enum(t.LOOP_STAGES);
const verdictSchema = z.enum(["malicious", "suspicious", "pending", "benign"]);

export async function advanceLoopAction(id: string, stage: string, note: string): Promise<Result> {
  const v = await actionViewer("secops.write");
  if (!v.tenant.features.has("closed_loops")) return { ok: false };
  const s = stageSchema.safeParse(stage);
  if (!uuid.safeParse(id).success || !s.success) return { ok: false };
  const ok = await advanceLoop(db(), { tenantId: v.tenant.id, loopId: id, to: s.data, actorId: v.user.id, note: note.trim().slice(0, 1000) || null });
  refresh();
  return { ok };
}

export async function setLoopVerdictAction(id: string, verdict: string): Promise<Result> {
  const v = await actionViewer("secops.write");
  if (!v.tenant.features.has("closed_loops")) return { ok: false };
  const p = verdictSchema.safeParse(verdict);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false };
  const changed = await db()
    .update(t.loops)
    .set({ verdict: p.data, updatedAt: new Date() })
    .where(and(eq(t.loops.id, id), eq(t.loops.tenantId, v.tenant.id), isNull(t.loops.closedAt)))
    .returning({ id: t.loops.id });
  if (!changed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "loop.advanced", targetType: "loop", targetId: id, meta: { verdict: p.data } });
  refresh();
  return { ok: true };
}

export async function closeLoopAction(id: string, note: string): Promise<Result> {
  const v = await actionViewer("secops.write");
  if (!v.tenant.features.has("closed_loops")) return { ok: false };
  if (!uuid.safeParse(id).success) return { ok: false };
  const ok = await closeLoop(db(), { tenantId: v.tenant.id, loopId: id, actorId: v.user.id, note: note.trim().slice(0, 1000) || null });
  refresh();
  return { ok };
}

/* ───────── approval gate ───────── */

async function audienceUserIds(v: Viewer, departmentId: string | null): Promise<string[]> {
  const people = await db()
    .select({ id: t.users.id, departmentId: t.users.departmentId })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active")));
  if (!departmentId) return people.map((p) => p.id);
  const departments = await db().select({ id: t.departments.id, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, v.tenant.id));
  const ids = departmentClosure(departments).get(departmentId);
  return ids ? people.filter((p) => p.departmentId && ids.has(p.departmentId)).map((p) => p.id) : [];
}

/**
 * Human approval of a material. Approving gives the people it targets the linked lesson.
 * Materials marked "needs two approvers" need a second approval by a different person.
 */
export async function decideMaterialAction(id: string, decision: "approve" | "reject", reason?: string): Promise<Result & { count?: number; stage?: "second_approval" | "approved" | "rejected" }> {
  const v = await actionViewer("approvals.decide");
  if (!uuid.safeParse(id).success || (decision !== "approve" && decision !== "reject")) return { ok: false };
  const [m] = await db().select().from(t.materials).where(and(eq(t.materials.id, id), eq(t.materials.tenantId, v.tenant.id)));
  if (!m || (m.status !== "pending" && m.status !== "second_approval")) return { ok: false };

  if (decision === "reject") {
    const why = (reason ?? "").trim().slice(0, 1000);
    if (!why) return { ok: false, error: "reason" };
    await db().insert(t.materialDecisions).values({ materialId: m.id, actorId: v.user.id, decision: "reject", reason: why });
    await db().update(t.materials).set({ status: "rejected" }).where(eq(t.materials.id, m.id));
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "material.rejected", targetType: "material", targetId: m.id, meta: { title: m.title } });
    refresh();
    return { ok: true, stage: "rejected" };
  }

  if (m.status === "second_approval") {
    const [first] = await db()
      .select({ actorId: t.materialDecisions.actorId })
      .from(t.materialDecisions)
      .where(and(eq(t.materialDecisions.materialId, m.id), eq(t.materialDecisions.decision, "approve")));
    if (first?.actorId === v.user.id) return { ok: false, error: "sameApprover" };
  }
  await db().insert(t.materialDecisions).values({ materialId: m.id, actorId: v.user.id, decision: "approve" });
  if (m.requiresTwo && m.status === "pending") {
    await db().update(t.materials).set({ status: "second_approval" }).where(eq(t.materials.id, m.id));
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "material.approved", targetType: "material", targetId: m.id, meta: { title: m.title, step: 1 } });
    refresh();
    return { ok: true, stage: "second_approval" };
  }

  await db().update(t.materials).set({ status: "approved" }).where(eq(t.materials.id, m.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "material.approved", targetType: "material", targetId: m.id, meta: { title: m.title } });
  let count = 0;
  if (m.moduleId && m.targetUserIds.length) {
    const [linkedIncident] = m.sourceRef?.startsWith("IR-")
      ? await db().select({ severity: t.incidents.severity }).from(t.incidents).where(and(eq(t.incidents.tenantId, v.tenant.id), eq(t.incidents.number, Number(m.sourceRef.slice(3)) || -1)))
      : [];
    const assigned = await targetTraining(db(), {
      tenantId: v.tenant.id,
      userIds: m.targetUserIds,
      moduleId: m.moduleId,
      severity: linkedIncident?.severity ?? "medium",
      kind: m.sourceRef?.startsWith("POL-") ? "policy" : "incident",
      title: m.title,
      sourceRef: m.sourceRef ?? `MAT-${m.id.slice(0, 8)}`,
      note: { title: m.title, body: m.body },
    });
    count = assigned.length;
  }
  if (m.loopId) {
    await advanceLoop(db(), { tenantId: v.tenant.id, loopId: m.loopId, to: "training", actorId: v.user.id });
    if (count) {
      const [loop] = await db().select({ trained: t.loops.trainedCount }).from(t.loops).where(eq(t.loops.id, m.loopId));
      await db().update(t.loops).set({ trainedCount: (loop?.trained ?? 0) + count }).where(eq(t.loops.id, m.loopId));
    }
  }
  refresh();
  return { ok: true, count, stage: "approved" };
}

const editSchema = z.object({ title: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(5000) });

export async function editMaterialAction(id: string, input: z.infer<typeof editSchema>): Promise<Result> {
  const v = await actionViewer("approvals.decide");
  const p = editSchema.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false };
  const [m] = await db().select().from(t.materials).where(and(eq(t.materials.id, id), eq(t.materials.tenantId, v.tenant.id)));
  if (!m || (m.status !== "pending" && m.status !== "second_approval")) return { ok: false };
  await db().update(t.materials).set({ title: p.data.title, body: p.data.body }).where(eq(t.materials.id, m.id));
  await db().insert(t.materialDecisions).values({ materialId: m.id, actorId: v.user.id, decision: "edit" });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "material.edited", targetType: "material", targetId: m.id });
  refresh();
  return { ok: true };
}

const materialSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  moduleId: uuid.nullable(),
  departmentId: uuid.nullable(),
  requiresTwo: z.boolean(),
});

/** Studio: an analyst-written support material goes to the approval gate. */
export async function createMaterialAction(input: z.infer<typeof materialSchema>): Promise<Result> {
  const v = await actionViewer("studio.write");
  const p = materialSchema.safeParse(input);
  if (!p.success) return { ok: false };
  if (p.data.moduleId) {
    const [mod] = await db().select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.id, p.data.moduleId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    if (!mod) return { ok: false };
  }
  const targets = await audienceUserIds(v, p.data.departmentId);
  const [row] = await db()
    .insert(t.materials)
    .values({ tenantId: v.tenant.id, title: p.data.title, body: p.data.body, origin: "analyst", requiresTwo: p.data.requiresTwo, moduleId: p.data.moduleId, targetUserIds: targets, createdBy: v.user.id })
    .returning({ id: t.materials.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "material.created", targetType: "material", targetId: row.id, meta: { title: p.data.title } });
  refresh();
  return { ok: true };
}

/* ───────── incidents ───────── */

const incidentSchema = z.object({
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().max(8000),
  severity,
  source: z.enum(["analyst", "sandbox", "report", "siem", "intel"]),
  confidential: z.boolean(),
  live: z.boolean(),
  iocs: z.string().max(20_000),
  mitre: z.string().max(500),
  moduleId: uuid.nullable(),
  minScore: z.number().int().min(0).max(100).nullable(),
  dueDate: day.nullable(),
  departmentId: uuid.nullable(),
  userIds: z.array(uuid).max(5000),
  sandboxId: uuid.nullable(),
  assignNow: z.boolean(),
});

/** Indicators are stored as real values (like sandbox results) and shown defanged in the UI. */
function classifyIoc(value: string): t.Ioc | null {
  const v = value.trim().replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http");
  if (!v) return null;
  if (/^[a-f0-9]{64}$/i.test(v)) return { type: "sha256", value: v.toLowerCase() };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return { type: "ip", value: v };
  if (/^[^@\s]+@[^@\s]+\.(?:xn--[a-z0-9-]+|[a-z]{2,})$/i.test(v)) return { type: "email", value: v.toLowerCase() };
  if (/^https?:\/\//i.test(v)) return { type: "url", value: v.slice(0, 2000) };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) && !/\.(exe|dll|js|vbs|lnk|docm|xlsm|zip|iso|html?|pdf|docx?|xlsx?|yml|yaml|json|ps1|bat|cmd)$/i.test(v)) return { type: "domain", value: v.toLowerCase() };
  return { type: "filename", value: v.slice(0, 300) };
}

export async function createIncidentAction(input: z.infer<typeof incidentSchema>): Promise<Result & { id?: string; number?: number; assigned?: number }> {
  const v = await actionViewer("secops.write");
  if (!v.tenant.features.has("incidents")) return { ok: false };
  const p = incidentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  if (d.moduleId) {
    const [mod] = await db().select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.id, d.moduleId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    if (!mod) return { ok: false, error: "invalid" };
  }
  if (d.sandboxId) {
    const [sb] = await db().select({ id: t.sandboxAnalyses.id }).from(t.sandboxAnalyses).where(and(eq(t.sandboxAnalyses.id, d.sandboxId), eq(t.sandboxAnalyses.tenantId, v.tenant.id)));
    if (!sb) return { ok: false, error: "invalid" };
  }
  const fromDept = d.departmentId ? await audienceUserIds(v, d.departmentId) : [];
  const chosen = d.userIds.length
    ? (await db().select({ id: t.users.id }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, d.userIds)))).map((u) => u.id)
    : [];
  const targets = [...new Set([...fromDept, ...chosen])];
  const iocs = d.iocs
    .split(/\r?\n/)
    .map(classifyIoc)
    .filter((x): x is t.Ioc => !!x)
    .slice(0, 200);
  const mitre = [...new Set(d.mitre.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^T\d{4}(\.\d{3})?$/.test(x)))].slice(0, 30);
  const inc = await createIncident(db(), {
    tenantId: v.tenant.id,
    actorId: v.user.id,
    title: d.title,
    description: d.description || null,
    severity: d.severity,
    source: d.source,
    confidential: d.confidential,
    live: d.live,
    iocs,
    mitre,
    sandboxId: d.sandboxId,
    trainingModuleId: d.moduleId,
    minScore: d.moduleId ? d.minScore : null,
    dueDate: d.dueDate,
    targetUserIds: targets,
  });
  const assigned = d.assignNow && d.moduleId && targets.length ? await assignIncidentTraining(db(), { tenantId: v.tenant.id, incidentId: inc.id, actorId: v.user.id }) : 0;
  refresh();
  return { ok: true, id: inc.id, number: inc.number, assigned };
}

const incidentUpdateSchema = z.object({ status: z.enum(t.INCIDENT_STATUS).optional(), severity: severity.optional(), live: z.boolean().optional(), confidential: z.boolean().optional() });

export async function updateIncidentAction(id: string, input: z.infer<typeof incidentUpdateSchema>): Promise<Result> {
  const v = await actionViewer("secops.write");
  const p = incidentUpdateSchema.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success || !v.tenant.features.has("incidents")) return { ok: false };
  const [inc] = await db().select().from(t.incidents).where(and(eq(t.incidents.id, id), eq(t.incidents.tenantId, v.tenant.id)));
  if (!inc) return { ok: false };
  const set: Partial<typeof t.incidents.$inferInsert> = { ...p.data };
  if (p.data.status === "resolved" && inc.status !== "resolved") Object.assign(set, { resolvedAt: new Date(), live: false });
  if (p.data.status && p.data.status !== "resolved") set.resolvedAt = null;
  await db().update(t.incidents).set(set).where(eq(t.incidents.id, inc.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "incident.changed", targetType: "incident", targetId: inc.id, meta: { number: `IR-${inc.number}`, ...p.data } });
  refresh();
  return { ok: true };
}

const trainingSchema = z.object({
  moduleId: uuid.nullable(),
  minScore: z.number().int().min(0).max(100).nullable(),
  dueDate: day.nullable(),
  departmentId: uuid.nullable(),
  userIds: z.array(uuid).max(5000),
});

/** Sets or changes the training that follows an incident (lesson, pass mark, due date, people). */
export async function setIncidentTrainingAction(id: string, input: z.infer<typeof trainingSchema>): Promise<Result> {
  const v = await actionViewer("secops.write");
  const p = trainingSchema.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success || !v.tenant.features.has("incidents")) return { ok: false };
  const [inc] = await db().select().from(t.incidents).where(and(eq(t.incidents.id, id), eq(t.incidents.tenantId, v.tenant.id)));
  if (!inc) return { ok: false };
  const d = p.data;
  if (d.moduleId) {
    const [mod] = await db().select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.id, d.moduleId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    if (!mod) return { ok: false };
  }
  const fromDept = d.departmentId ? await audienceUserIds(v, d.departmentId) : [];
  const chosen = d.userIds.length ? (await db().select({ id: t.users.id }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, d.userIds)))).map((u) => u.id) : [];
  const targets = [...new Set([...fromDept, ...chosen])];
  await db()
    .update(t.incidents)
    .set({ trainingModuleId: d.moduleId, minScore: d.moduleId ? d.minScore : null, dueDate: d.dueDate, targetUserIds: targets, ...(d.moduleId !== inc.trainingModuleId ? { autoTrainingAt: null } : {}) })
    .where(eq(t.incidents.id, inc.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "incident.changed", targetType: "incident", targetId: inc.id, meta: { number: `IR-${inc.number}`, training: true, targets: targets.length } });
  refresh();
  return { ok: true };
}

export async function assignIncidentTrainingAction(id: string): Promise<Result & { count?: number }> {
  const v = await actionViewer("secops.write");
  if (!uuid.safeParse(id).success || !v.tenant.features.has("incidents")) return { ok: false };
  const count = await assignIncidentTraining(db(), { tenantId: v.tenant.id, incidentId: id, actorId: v.user.id });
  refresh();
  return { ok: true, count };
}

/* ───────── intelligence ───────── */

export async function setIntelStatusAction(id: string, status: "reviewed" | "dismissed"): Promise<Result> {
  const v = await actionViewer("intel.read");
  if (!uuid.safeParse(id).success || (status !== "reviewed" && status !== "dismissed")) return { ok: false };
  const [item] = await db().select().from(t.intelItems).where(and(eq(t.intelItems.id, id), eq(t.intelItems.tenantId, v.tenant.id)));
  if (!item || item.status === "converted") return { ok: false };
  // Reading the feed is not triage: reviewing or dismissing takes the team's own write permission.
  if (!allowed(v, item.kind === "policy" ? "policies.write" : "secops.write")) return { ok: false };
  await db().update(t.intelItems).set({ status }).where(eq(t.intelItems.id, item.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: status === "dismissed" ? "intel.dismissed" : "intel.reviewed", targetType: "intel", targetId: item.id });
  refresh();
  return { ok: true };
}

/** Threat item → closed loop + support material waiting in the approval gate. */
export async function convertThreatIntelAction(id: string, input: { moduleId: string | null; departmentId: string | null }): Promise<Result & { loopId?: string }> {
  // Converting creates SecOps work (a loop and approval material), so it needs the SecOps permission, not just the feed.
  const v = await actionViewer("secops.write");
  if (!v.tenant.features.has("closed_loops") || !v.tenant.features.has("approvals")) return { ok: false };
  if (!uuid.safeParse(id).success || (input.moduleId && !uuid.safeParse(input.moduleId).success) || (input.departmentId && !uuid.safeParse(input.departmentId).success)) return { ok: false };
  const [item] = await db().select().from(t.intelItems).where(and(eq(t.intelItems.id, id), eq(t.intelItems.tenantId, v.tenant.id), eq(t.intelItems.kind, "threat")));
  if (!item || item.status === "converted") return { ok: false };
  if (input.moduleId) {
    const [mod] = await db().select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.id, input.moduleId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    if (!mod) return { ok: false };
  }
  const loopId = await createLoop(db(), { tenantId: v.tenant.id, title: item.title, sourceType: "intel", sourceId: item.id, verdict: item.severity === "low" ? "suspicious" : "malicious", stage: "approval", actorId: v.user.id });
  const targets = await audienceUserIds(v, input.departmentId);
  await db().insert(t.materials).values({ tenantId: v.tenant.id, title: item.title, body: item.summary, origin: "template", sourceRef: `INT-${item.id.slice(0, 8)}`, loopId, moduleId: input.moduleId, targetUserIds: targets, createdBy: v.user.id });
  await db().update(t.intelItems).set({ status: "converted", loopId }).where(eq(t.intelItems.id, item.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "intel.converted", targetType: "intel", targetId: item.id, meta: { to: "loop" } });
  refresh();
  return { ok: true, loopId };
}

/** Policy item → policy draft to complete and publish for sign-off. */
export async function convertPolicyIntelAction(id: string): Promise<Result & { policyId?: string }> {
  const v = await actionViewer("policies.write");
  if (!uuid.safeParse(id).success || !v.tenant.features.has("policies")) return { ok: false };
  const [item] = await db().select().from(t.intelItems).where(and(eq(t.intelItems.id, id), eq(t.intelItems.tenantId, v.tenant.id), eq(t.intelItems.kind, "policy")));
  if (!item || item.status === "converted") return { ok: false };
  const [policy] = await db().insert(t.policies).values({ tenantId: v.tenant.id, title: item.title.slice(0, 120), createdBy: v.user.id }).returning({ id: t.policies.id });
  await db().update(t.intelItems).set({ status: "converted", policyId: policy.id }).where(eq(t.intelItems.id, item.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.created", targetType: "policy", targetId: policy.id, meta: { title: item.title } });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "intel.converted", targetType: "intel", targetId: item.id, meta: { to: "policy" } });
  refresh();
  return { ok: true, policyId: policy.id };
}

/* ───────── training studio ───────── */

export async function draftLessonAction(topic: string, locale: string): Promise<{ ok: boolean; draft?: LessonDraft; error?: "offline" | "failed" | "rateLimited" }> {
  const v = await actionViewer("studio.write");
  const text = topic.trim();
  if (text.length < 5) return { ok: false, error: "failed" };
  if (!(await rateLimit(`ai-draft:${v.user.id}`, 20, 60 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  const lang = (LOCALES as readonly string[]).includes(locale) ? locale : v.tenant.settings.defaultLocale;
  try {
    const draft = await draftLesson(text, lang);
    if (draft === null && !aiEnabled()) return { ok: false, error: "offline" };
    return draft ? { ok: true, draft } : { ok: false, error: "failed" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

const lessonSchema = lessonDraftSchema.extend({
  locale: z.enum(LOCALES),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(t.DIFFICULTY),
  minutes: z.number().int().min(1).max(30),
  ai: z.boolean(),
});

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/ə/g, "e")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "lesson";
}

/** Saves a studio lesson as a draft module with one lesson (intro, tutor steps, question, recap). */
export async function saveStudioLessonAction(input: z.infer<typeof lessonSchema>): Promise<Result & { slug?: string }> {
  const v = await actionViewer("studio.write");
  const p = lessonSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  if (d.question.options.filter((o) => o.correct).length !== 1) return { ok: false, error: "invalid" };
  const slug = `own-${slugify(d.title)}-${Date.now().toString(36).slice(-4)}`;
  const label = { [d.locale]: d.title };
  const [mod] = await db()
    .insert(t.modules)
    .values({ tenantId: v.tenant.id, slug, category: d.category, audiences: [AUDIENCES[0]], title: label, subtitle: { [d.locale]: d.subtitle }, minutes: d.minutes, xp: 40 + d.minutes * 5, difficulty: d.difficulty, origin: d.ai ? "ai" : "custom", status: "draft", sortOrder: 1000, createdBy: v.user.id })
    .returning({ id: t.modules.id });
  const [lesson] = await db().insert(t.lessons).values({ moduleId: mod.id, key: "lesson-1", title: label, minutes: d.minutes, position: 1 }).returning({ id: t.lessons.id });
  const moods = ["talk", "think", "alert", "talk", "happy", "talk", "think", "talk"] as const;
  const scenes = [
    { type: "intro", id: "intro", title: d.title, body: d.intro, mood: "talk" },
    { type: "tutor", id: "steps", beats: d.points.map((say, i) => ({ id: `b${i + 1}`, say, mood: moods[i % moods.length] })) },
    { type: "choice", id: "check", question: { prompt: d.question.prompt, options: d.question.options.map((o, i) => ({ id: `o${i + 1}`, label: o.label, correct: o.correct, feedback: o.feedback })) } },
    { type: "recap", id: "recap", points: d.recap, mood: "celebrate" },
  ];
  await db().insert(t.lessonContents).values({ lessonId: lesson.id, locale: d.locale, scenes });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "module.created", targetType: "module", targetId: mod.id, meta: { title: d.title, origin: d.ai ? "ai" : "custom" } });
  refresh();
  return { ok: true, slug };
}

async function ownModule(v: Viewer, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [m] = await db().select().from(t.modules).where(and(eq(t.modules.id, id), eq(t.modules.tenantId, v.tenant.id), ne(t.modules.origin, "library")));
  return m ?? null;
}

export async function setModuleStatusAction(id: string, status: "published" | "draft"): Promise<Result> {
  const v = await actionViewer("studio.write");
  const m = await ownModule(v, id);
  if (!m || (status !== "published" && status !== "draft")) return { ok: false };
  await db().update(t.modules).set({ status }).where(eq(t.modules.id, m.id));
  if (status === "published") await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "module.published", targetType: "module", targetId: m.id, meta: { title: pick(m.title, v.tenant.settings.defaultLocale) } });
  refresh();
  return { ok: true };
}

/**
 * Only a module nobody has started can be deleted: certificates (and their public links),
 * attestations and progress are compliance evidence. A module that open targeted training (a
 * risk that closes when the person finishes it) or an incident's training points to is in use too:
 * deleting it would leave risks nobody can close. A module in use can be unpublished instead.
 * Its assignments are removed with it.
 */
export async function deleteModuleAction(id: string): Promise<Result> {
  const v = await actionViewer("studio.write");
  const m = await ownModule(v, id);
  if (!m) return { ok: false };
  const [cert, attestation, progress, risk, incident] = await Promise.all([
    db().select({ id: t.certificates.id }).from(t.certificates).where(eq(t.certificates.moduleId, m.id)).limit(1),
    db().select({ id: t.attestations.id }).from(t.attestations).where(eq(t.attestations.moduleId, m.id)).limit(1),
    db().select({ userId: t.moduleProgress.userId }).from(t.moduleProgress).where(eq(t.moduleProgress.moduleId, m.id)).limit(1),
    db().select({ id: t.behaviorRisks.id }).from(t.behaviorRisks).where(and(eq(t.behaviorRisks.moduleId, m.id), eq(t.behaviorRisks.status, "open"))).limit(1),
    db().select({ id: t.incidents.id }).from(t.incidents).where(eq(t.incidents.trainingModuleId, m.id)).limit(1),
  ]);
  if (cert.length || attestation.length || progress.length || risk.length || incident.length) return { ok: false, error: "in_use" };
  try {
    await db().delete(t.modules).where(eq(t.modules.id, m.id));
  } catch (e) {
    // A certificate or attestation recorded since the check above: their foreign keys keep the module.
    if (isForeignKeyViolation(e)) return { ok: false, error: "in_use" };
    throw e;
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "module.deleted", targetType: "module", targetId: m.id, meta: { title: pick(m.title, v.tenant.settings.defaultLocale) } });
  refresh();
  return { ok: true };
}

/* ───────── learning paths ───────── */

const pathSchema = z.object({
  id: uuid.nullable(),
  /** A duplicate: the library (or own) path it copies, whose other translations it keeps. */
  sourceId: uuid.nullable().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600),
  audience: z.string().trim().max(120),
  recurrence: z.string().trim().max(60),
  standards: z.string().trim().max(200),
  mandatory: z.boolean(),
  moduleSlugs: z.array(z.string().max(120)).min(1).max(40),
  /** Practice labs, shown after the modules. */
  labIds: z.array(z.enum(LAB_IDS)).max(LAB_IDS.length).default([]),
});

export async function savePathAction(input: z.input<typeof pathSchema>): Promise<Result & { id?: string }> {
  const v = await actionViewer("paths.write");
  if (!v.tenant.features.has("paths")) return { ok: false };
  const p = pathSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  // The editor shows the texts in the admin's interface language, so that is the translation they change.
  const ui = await getLocale();
  const lang = isLocale(ui) ? ui : v.tenant.settings.defaultLocale;
  const known = await db().select({ slug: t.modules.slug }).from(t.modules).where(and(inArray(t.modules.slug, d.moduleSlugs), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
  const ok = new Set(known.map((k) => k.slug));
  const slugs = [...new Set(d.moduleSlugs)].filter((s) => ok.has(s));
  if (!slugs.length) return { ok: false, error: "invalid" };
  // An edit starts from the path itself, a duplicate from the path it copies (library or own).
  const baseId = d.id ?? d.sourceId ?? null;
  const [base] = baseId
    ? await db()
        .select()
        .from(t.learningPaths)
        .where(and(eq(t.learningPaths.id, baseId), d.id ? eq(t.learningPaths.tenantId, v.tenant.id) : or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))))
    : [];
  // A text left as shown keeps all its translations; an edited one replaces only this language's.
  const merge = (from: Record<string, string> | undefined, value: string) => (from && pick(from, lang) === value ? from : { ...from, [lang]: value });
  const values = {
    title: merge(base?.title, d.title),
    description: merge(base?.description, d.description),
    audience: merge(base?.audience, d.audience),
    recurrence: merge(base?.recurrence, d.recurrence),
    standards: d.standards.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
    mandatory: d.mandatory,
    moduleSlugs: slugs,
    labIds: [...new Set(d.labIds)],
  };
  if (d.id) {
    if (!base) return { ok: false };
    await db().update(t.learningPaths).set(values).where(eq(t.learningPaths.id, base.id));
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "path.changed", targetType: "path", targetId: base.id, meta: { title: d.title } });
    refresh();
    return { ok: true, id: base.id };
  }
  const [row] = await db()
    .insert(t.learningPaths)
    .values({ tenantId: v.tenant.id, key: `own-${slugify(d.title)}-${Date.now().toString(36).slice(-4)}`, ...values })
    .returning({ id: t.learningPaths.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "path.created", targetType: "path", targetId: row.id, meta: { title: d.title } });
  refresh();
  return { ok: true, id: row.id };
}

/** A path with issued path certificates is kept (they are compliance evidence with public links). */
export async function deletePathAction(id: string): Promise<Result> {
  const v = await actionViewer("paths.write");
  if (!uuid.safeParse(id).success || !v.tenant.features.has("paths")) return { ok: false };
  const [own] = await db().select({ id: t.learningPaths.id }).from(t.learningPaths).where(and(eq(t.learningPaths.id, id), eq(t.learningPaths.tenantId, v.tenant.id)));
  if (!own) return { ok: false };
  const [cert] = await db().select({ id: t.certificates.id }).from(t.certificates).where(eq(t.certificates.pathId, own.id)).limit(1);
  if (cert) return { ok: false, error: "in_use" };
  const deleted = await db()
    .delete(t.learningPaths)
    .where(and(eq(t.learningPaths.id, id), eq(t.learningPaths.tenantId, v.tenant.id)))
    .returning({ id: t.learningPaths.id });
  if (!deleted.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "path.changed", targetType: "path", targetId: id, meta: { deleted: true } });
  refresh();
  return { ok: true };
}

/* ───────── live sessions ───────── */

const sessionSchema = z.object({
  id: uuid.nullable(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000),
  startsAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(5).max(480),
  location: z.string().trim().min(2).max(300),
  host: z.string().trim().min(2).max(120),
  capacity: z.number().int().min(1).max(100_000).nullable(),
});

export async function saveSessionAction(input: z.infer<typeof sessionSchema>): Promise<Result> {
  const v = await actionViewer("sessions.write");
  const p = sessionSchema.safeParse(input);
  // The first rejected field, so the dialog can mark that input.
  if (!p.success) return { ok: false, error: "invalid", field: String(p.error.issues[0]?.path[0] ?? "") || undefined };
  const { id, ...d } = p.data;
  const values = { ...d, description: d.description || null, startsAt: new Date(d.startsAt) };
  if (id) {
    const [row] = await db()
      .update(t.liveSessions)
      .set(values)
      .where(and(eq(t.liveSessions.id, id), eq(t.liveSessions.tenantId, v.tenant.id)))
      .returning({ id: t.liveSessions.id });
    if (!row) return { ok: false };
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "session.changed", targetType: "session", targetId: row.id, meta: { title: d.title } });
  } else {
    const [row] = await db().insert(t.liveSessions).values({ tenantId: v.tenant.id, ...values }).returning({ id: t.liveSessions.id });
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "session.created", targetType: "session", targetId: row.id, meta: { title: d.title } });
  }
  refresh();
  return { ok: true };
}

export async function deleteSessionAction(id: string): Promise<Result> {
  const v = await actionViewer("sessions.write");
  if (!uuid.safeParse(id).success) return { ok: false };
  const [s] = await db().select().from(t.liveSessions).where(and(eq(t.liveSessions.id, id), eq(t.liveSessions.tenantId, v.tenant.id)));
  if (!s) return { ok: false };
  const regs = await db()
    .select({ userId: t.sessionRegistrations.userId, locale: t.users.locale })
    .from(t.sessionRegistrations)
    .innerJoin(t.users, eq(t.users.id, t.sessionRegistrations.userId))
    .where(eq(t.sessionRegistrations.sessionId, s.id));
  if (regs.length && s.startsAt > new Date()) {
    // Each registrant reads the cancellation in their own interface language.
    const title = new Map<string, string>();
    for (const locale of new Set(regs.map((r) => r.locale))) title.set(locale, (await getTranslations({ locale, namespace: "secops.sessions" }))("cancelledTitle", { title: s.title }));
    await db().insert(t.notifications).values(regs.map((r) => ({ tenantId: v.tenant.id, userId: r.userId, kind: "session", title: title.get(r.locale) ?? s.title, href: "/sessions" })));
  }
  await db().delete(t.liveSessions).where(eq(t.liveSessions.id, s.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "session.deleted", targetType: "session", targetId: s.id, meta: { title: s.title, notified: regs.length } });
  refresh();
  return { ok: true };
}

export async function setAttendanceAction(sessionId: string, userId: string, attended: boolean): Promise<Result> {
  const v = await actionViewer("sessions.write");
  if (!uuid.safeParse(sessionId).success || !uuid.safeParse(userId).success) return { ok: false };
  const [s] = await db().select({ id: t.liveSessions.id }).from(t.liveSessions).where(and(eq(t.liveSessions.id, sessionId), eq(t.liveSessions.tenantId, v.tenant.id)));
  if (!s) return { ok: false };
  await db().update(t.sessionRegistrations).set({ attended }).where(and(eq(t.sessionRegistrations.sessionId, s.id), eq(t.sessionRegistrations.userId, userId)));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "session.attendance", targetType: "session", targetId: s.id, meta: { userId, attended } });
  refresh();
  return { ok: true };
}

/* ───────── support desk & feedback ───────── */

export async function setTicketStatusAction(id: string, status: string): Promise<Result> {
  const v = await actionViewer("support.manage");
  const s = z.enum(["open", "in_progress", "answered", "closed"]).safeParse(status);
  if (!uuid.safeParse(id).success || !s.success || !v.tenant.features.has("support")) return { ok: false };
  const [tk] = await db().select().from(t.supportTickets).where(and(eq(t.supportTickets.id, id), eq(t.supportTickets.tenantId, v.tenant.id)));
  if (!tk) return { ok: false };
  await db().update(t.supportTickets).set({ status: s.data, updatedAt: new Date() }).where(eq(t.supportTickets.id, tk.id));
  // The requester hears about an answer or closure even when no message was written.
  if ((s.data === "answered" || s.data === "closed") && s.data !== tk.status) {
    // In the requester's interface language, not the agent's.
    const [requester] = await db().select({ locale: t.users.locale }).from(t.users).where(eq(t.users.id, tk.userId));
    const tr = await getTranslations({ locale: requester?.locale ?? v.tenant.settings.defaultLocale, namespace: "secops.support" });
    await db()
      .insert(t.notifications)
      .values({ tenantId: v.tenant.id, userId: tk.userId, kind: "ticket", title: tr("notifyTitle", { number: tk.number, subject: tk.subject.slice(0, 80) }), body: tr(`notifyBody.${s.data}`), href: `/help/tickets/${tk.id}` });
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "ticket.status", targetType: "ticket", targetId: tk.id, meta: { number: tk.number, status: s.data } });
  refresh();
  return { ok: true };
}

export async function reviewFeedbackAction(id: string): Promise<Result> {
  const v = await actionViewer("feedback.read");
  if (!uuid.safeParse(id).success || !v.tenant.features.has("feedback")) return { ok: false };
  const changed = await db()
    .update(t.feedback)
    .set({ status: "reviewed" })
    .where(and(eq(t.feedback.id, id), eq(t.feedback.tenantId, v.tenant.id)))
    .returning({ id: t.feedback.id });
  if (!changed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "feedback.reviewed", targetType: "feedback", targetId: id });
  refresh();
  return { ok: true };
}
