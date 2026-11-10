"use server";

import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, hasFeature } from "../auth/viewer";
import { isUuid } from "../../lib/ids";
import { parseDay } from "../../lib/day";
import { departmentKey } from "../../lib/departments";
import { isUniqueViolation } from "../db/errors";
import { audit } from "../services/audit";
import { notifyUsers } from "../services/notify";
import { assignmentTargets, coveringAssignments, departmentClosure, dueFor, gainsCoverage, resolveAssignments } from "../services/assignments";
import { recomputeChanged, recomputeRisk } from "../services/risk";
import { getTranslations } from "next-intl/server";
import { LOCALES, isLocale, pick } from "../../i18n/config";
import type { PolicyText } from "../../lib/policy-text";

/* ───────── departments ───────── */

const nameSchema = z.string().trim().min(2).max(120);

export async function saveDepartmentAction(input: { id?: string; name: string; parentId: string | null; headUserId: string | null }): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer("departments.write");
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, error: "invalid" };
  // Ids reach uuid columns: anything else is refused before it can make the query throw.
  if ((input.id !== undefined && !isUuid(input.id)) || (input.parentId !== null && !isUuid(input.parentId)) || (input.headUserId !== null && !isUuid(input.headUserId))) return { ok: false, error: "invalid" };
  const departments = await db().select().from(t.departments).where(eq(t.departments.tenantId, v.tenant.id));
  const byId = new Map(departments.map((d) => [d.id, d]));
  if (input.parentId && !byId.has(input.parentId)) return { ok: false, error: "invalid" };
  // Names are unique within the organisation the way the CSV import matches them (case and dotted/dotless i
  // folded): a second "SALES" next to "Sales" would leave the import picking one of the two at random. Only a
  // new or changed name is checked, so moving one of two older look-alikes is not refused. The key is stored
  // with each new name (name_key), and its unique index decides when two saves or an import race this check.
  const key = departmentKey(name.data);
  const renamed = !input.id || departmentKey(byId.get(input.id)?.name ?? "") !== key;
  if (renamed && departments.some((d) => d.id !== input.id && departmentKey(d.name) === key)) return { ok: false, error: "duplicate" };
  if (input.headUserId) {
    // A deleted (anonymised) person cannot head a department: manager alerts would go nowhere.
    const [h] = await db().select({ id: t.users.id }).from(t.users).where(and(eq(t.users.id, input.headUserId), eq(t.users.tenantId, v.tenant.id), ne(t.users.status, "deleted")));
    if (!h) return { ok: false, error: "invalid" };
  }
  if (input.id) {
    const current = byId.get(input.id);
    if (!current) return { ok: false, error: "invalid" };
    if (input.parentId && departmentClosure(departments).get(input.id)?.has(input.parentId)) return { ok: false, error: "cycle" };
    try {
      await db()
        .update(t.departments)
        .set({ name: name.data, ...(renamed ? { nameKey: key } : {}), parentId: input.parentId, headUserId: input.headUserId })
        .where(eq(t.departments.id, input.id));
    } catch (error) {
      if (isUniqueViolation(error, "departments_tenant_name_key_idx")) return { ok: false, error: "duplicate" };
      throw error;
    }
    if (current.parentId !== input.parentId) {
      // The sub-tree now sits under other departments: its people get a new department date where that
      // puts them under a department assignment that did not cover them before (see assignedSince).
      const before = departmentClosure(departments);
      const after = departmentClosure(departments.map((d) => (d.id === input.id ? { ...d, parentId: input.parentId } : d)));
      const assignments = await departmentAssignments(v.tenant.id);
      const gained = [...(before.get(input.id) ?? [input.id])].filter((d) => gainsCoverage(coveringAssignments(assignments, before, d), coveringAssignments(assignments, after, d)));
      if (gained.length) await db().update(t.users).set({ departmentChangedAt: new Date() }).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.departmentId, gained)));
    }
    if (current.name !== name.data) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.renamed", targetType: "department", targetId: input.id, meta: { from: current.name, to: name.data } });
    if (current.parentId !== input.parentId) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.moved", targetType: "department", targetId: input.id });
  } else {
    let row: { id: string };
    try {
      [row] = await db().insert(t.departments).values({ tenantId: v.tenant.id, name: name.data, nameKey: key, parentId: input.parentId, headUserId: input.headUserId }).returning({ id: t.departments.id });
    } catch (error) {
      if (isUniqueViolation(error, "departments_tenant_name_key_idx")) return { ok: false, error: "duplicate" };
      throw error;
    }
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.created", targetType: "department", targetId: row.id, meta: { name: name.data } });
  }
  refresh();
  return { ok: true };
}

/**
 * Deletes a department. People move to "no department" and sub-departments one level up; its
 * assignments and scheduled reports are removed; campaigns aimed at it that have not started go
 * back to drafts without an audience (they would otherwise reach nobody, or be read as the whole
 * organisation). Campaigns that already ran keep their results.
 */
export async function deleteDepartmentAction(id: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("departments.write");
  if (!isUuid(id)) return { ok: false };
  const [d] = await db().select().from(t.departments).where(and(eq(t.departments.id, id), eq(t.departments.tenantId, v.tenant.id)));
  if (!d) return { ok: false };
  // All or nothing: a failure halfway must not leave people moved while campaigns or schedules still point here.
  const { campaigns, schedules } = await db().transaction(async (tx) => {
    await tx.update(t.departments).set({ parentId: d.parentId }).where(and(eq(t.departments.parentId, id), eq(t.departments.tenantId, v.tenant.id)));
    await tx.update(t.users).set({ departmentId: null, departmentChangedAt: new Date() }).where(and(eq(t.users.departmentId, id), eq(t.users.tenantId, v.tenant.id)));
    await tx.delete(t.assignments).where(and(eq(t.assignments.departmentId, id), eq(t.assignments.tenantId, v.tenant.id)));
    const campaigns = await tx
      .update(t.campaigns)
      .set({ status: "draft", departmentId: null })
      .where(and(eq(t.campaigns.departmentId, id), eq(t.campaigns.tenantId, v.tenant.id), inArray(t.campaigns.status, ["draft", "scheduled"])))
      .returning({ id: t.campaigns.id });
    const schedules = await tx
      .delete(t.reportSchedules)
      .where(and(eq(t.reportSchedules.departmentId, id), eq(t.reportSchedules.tenantId, v.tenant.id)))
      .returning({ id: t.reportSchedules.id });
    await tx.delete(t.departments).where(eq(t.departments.id, id));
    return { campaigns, schedules };
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.deleted", targetType: "department", targetId: id, meta: { name: d.name, campaignsToDraft: campaigns.length, reportSchedulesRemoved: schedules.length } });
  refresh();
  return { ok: true };
}

/** The tenant's department-scoped assignments, to tell who a department change puts under a new one. */
function departmentAssignments(tenantId: string) {
  return db()
    .select({ id: t.assignments.id, scope: t.assignments.scope, departmentId: t.assignments.departmentId })
    .from(t.assignments)
    .where(and(eq(t.assignments.tenantId, tenantId), eq(t.assignments.scope, "department")));
}

/** Folds one department into another: people, sub-departments, assignments, campaign audiences and scheduled reports move, the source is deleted. */
export async function mergeDepartmentAction(sourceId: string, targetId: string): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer("departments.write");
  if (!isUuid(sourceId) || !isUuid(targetId) || sourceId === targetId) return { ok: false, error: "invalid" };
  const departments = await db().select().from(t.departments).where(eq(t.departments.tenantId, v.tenant.id));
  const source = departments.find((d) => d.id === sourceId);
  const target = departments.find((d) => d.id === targetId);
  if (!source || !target) return { ok: false, error: "invalid" };
  // The target must not sit under the source, or its sub-tree would become its own parent.
  if (departmentClosure(departments).get(sourceId)?.has(targetId)) return { ok: false, error: "cycle" };
  // The source's people and sub-departments move under the target, and the source's assignments move
  // with them. A new department date goes only to people this puts under a department assignment that
  // did not cover them before: the target's own and those above it (see assignedSince).
  const subtree = [...(departmentClosure(departments).get(sourceId) ?? [sourceId])];
  const assignments = await departmentAssignments(v.tenant.id);
  const before = departmentClosure(departments);
  const after = departmentClosure(departments.filter((d) => d.id !== sourceId).map((d) => (d.parentId === sourceId ? { ...d, parentId: targetId } : d)));
  const merged = assignments.map((a) => (a.departmentId === sourceId ? { ...a, departmentId: targetId } : a));
  const gained = new Set(subtree.filter((d) => gainsCoverage(coveringAssignments(assignments, before, d), coveringAssignments(merged, after, d === sourceId ? targetId : d))));
  const gainedSub = subtree.filter((d) => d !== sourceId && gained.has(d));
  // All or nothing, so nothing is left pointing at a half-merged department.
  const moved = await db().transaction(async (tx) => {
    const changedAt = new Date();
    const moved = await tx
      .update(t.users)
      .set(gained.has(sourceId) ? { departmentId: targetId, departmentChangedAt: changedAt } : { departmentId: targetId })
      .where(and(eq(t.users.departmentId, sourceId), eq(t.users.tenantId, v.tenant.id)))
      .returning({ id: t.users.id });
    if (gainedSub.length) await tx.update(t.users).set({ departmentChangedAt: changedAt }).where(and(inArray(t.users.departmentId, gainedSub), eq(t.users.tenantId, v.tenant.id)));
    await tx.update(t.departments).set({ parentId: targetId }).where(and(eq(t.departments.parentId, sourceId), eq(t.departments.tenantId, v.tenant.id)));
    await tx.update(t.assignments).set({ departmentId: targetId }).where(and(eq(t.assignments.departmentId, sourceId), eq(t.assignments.tenantId, v.tenant.id)));
    await tx.update(t.campaigns).set({ departmentId: targetId }).where(and(eq(t.campaigns.departmentId, sourceId), eq(t.campaigns.tenantId, v.tenant.id)));
    await tx.update(t.reportSchedules).set({ departmentId: targetId }).where(and(eq(t.reportSchedules.departmentId, sourceId), eq(t.reportSchedules.tenantId, v.tenant.id)));
    await tx.delete(t.departments).where(eq(t.departments.id, sourceId));
    return moved;
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.merged", targetType: "department", targetId, meta: { from: source.name, to: target.name, sourceId, people: moved.length } });
  if (moved.length) await recomputeRisk(db(), v.tenant.id, moved.map((u) => u.id));
  refresh();
  return { ok: true };
}

/* ───────── assignments ───────── */

const assignSchema = z.object({
  target: z.enum(["module", "path"]),
  targetId: z.string().uuid(),
  scope: z.enum(["everyone", "department", "user"]),
  departmentId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  dueKind: z.enum(["none", "fixed", "after_joining"]),
  // A real calendar day: 2026-02-31 would make the date column throw.
  dueDate: z
    .string()
    .refine((s) => parseDay(s) !== null)
    .nullable(),
  dueDays: z.number().int().min(1).max(365).nullable(),
  reason: z.string().trim().max(300).nullable(),
});

export async function createAssignmentAction(input: z.infer<typeof assignSchema>): Promise<{ ok: boolean; count?: number }> {
  const v = await actionViewer("assignments.write");
  const p = assignSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const a = p.data;
  if (a.target === "path" && !hasFeature(v, "paths")) return { ok: false };
  if (a.scope === "department" && !a.departmentId) return { ok: false };
  if (a.scope === "user" && !a.userId) return { ok: false };
  if (a.dueKind === "fixed" && !a.dueDate) return { ok: false };
  if (a.dueKind === "after_joining" && !a.dueDays) return { ok: false };
  if (a.target === "module") {
    const [m] = await db().select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.id, a.targetId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    if (!m) return { ok: false };
  } else {
    const [pth] = await db().select({ id: t.learningPaths.id }).from(t.learningPaths).where(and(eq(t.learningPaths.id, a.targetId), or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))));
    if (!pth) return { ok: false };
  }
  // The audience must be this organisation's own department or person.
  if (a.scope === "department" && a.departmentId) {
    const [d] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, a.departmentId), eq(t.departments.tenantId, v.tenant.id)));
    if (!d) return { ok: false };
  }
  if (a.scope === "user" && a.userId) {
    const [u] = await db().select({ id: t.users.id }).from(t.users).where(and(eq(t.users.id, a.userId), eq(t.users.tenantId, v.tenant.id)));
    if (!u) return { ok: false };
  }
  const [row] = await db()
    .insert(t.assignments)
    .values({
      tenantId: v.tenant.id,
      moduleId: a.target === "module" ? a.targetId : null,
      pathId: a.target === "path" ? a.targetId : null,
      scope: a.scope,
      departmentId: a.scope === "department" ? a.departmentId : null,
      userId: a.scope === "user" ? a.userId : null,
      dueKind: a.dueKind,
      dueDate: a.dueKind === "fixed" ? a.dueDate : null,
      dueDays: a.dueKind === "after_joining" ? a.dueDays : null,
      reason: a.reason,
      createdBy: v.user.id,
    })
    .returning({ id: t.assignments.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "assignment.created", targetType: "assignment", targetId: row.id, meta: { scope: a.scope } });

  // Tell the people who now have it (everyone it targets, even if another assignment already covered the module).
  const targets = [...((await assignmentTargets(db(), v.tenant.id)).get(row.id) ?? [])];
  const title =
    a.target === "module"
      ? (await db().select({ title: t.modules.title, slug: t.modules.slug }).from(t.modules).where(eq(t.modules.id, a.targetId)))[0]
      : (await db().select({ title: t.learningPaths.title, slug: t.learningPaths.key }).from(t.learningPaths).where(eq(t.learningPaths.id, a.targetId)))[0];
  if (title) {
    const href = a.target === "module" ? `/learn/${title.slug}` : `/paths/${title.slug}`;
    // The title in each recipient's own language.
    const titleIn = (locale: string) => pick(title.title, locale);
    // "N days after joining" gives everyone their own due day: one message per day, like the reminders.
    const byDue = new Map<string, string[]>();
    if (a.dueKind === "after_joining" && targets.length) {
      // The whole organisation, filtered here: a large audience would not fit in one IN list.
      const wanted = new Set(targets);
      const people = await db()
        .select({ id: t.users.id, departmentId: t.users.departmentId, createdAt: t.users.createdAt, activatedAt: t.users.activatedAt })
        .from(t.users)
        .where(eq(t.users.tenantId, v.tenant.id));
      for (const u of people.filter((p) => wanted.has(p.id))) {
        const due = dueFor({ dueKind: a.dueKind, dueDate: null, dueDays: a.dueDays }, u, v.tenant.settings.timeZone) ?? "";
        byDue.set(due, [...(byDue.get(due) ?? []), u.id]);
      }
    } else byDue.set(a.dueKind === "fixed" ? (a.dueDate ?? "") : "", targets);
    // Deferred: the job runner sends the emails, so the request does not wait for the mail server once per person.
    for (const [due, users] of byDue) {
      await notifyUsers(db(), v.tenant.id, users, "assignment", { module: titleIn, dueDate: due || undefined, link: href }, { href }, { defer: true });
    }
  }
  await recomputeRisk(db(), v.tenant.id, targets);
  refresh();
  return { ok: true, count: targets.length };
}

export async function updateDueAction(id: string, dueKind: "none" | "fixed" | "after_joining", dueDate: string | null, dueDays: number | null): Promise<{ ok: boolean }> {
  const v = await actionViewer("assignments.write");
  if (!isUuid(id) || !["none", "fixed", "after_joining"].includes(dueKind)) return { ok: false };
  if (dueKind === "fixed" && !parseDay(dueDate)) return { ok: false };
  if (dueKind === "after_joining" && !(dueDays && dueDays > 0 && dueDays <= 365)) return { ok: false };
  const before = await resolveAssignments(db(), v.tenant.id);
  const changed = await db()
    .update(t.assignments)
    .set({ dueKind, dueDate: dueKind === "fixed" ? dueDate : null, dueDays: dueKind === "after_joining" ? dueDays : null })
    .where(and(eq(t.assignments.id, id), eq(t.assignments.tenantId, v.tenant.id)))
    .returning({ id: t.assignments.id });
  if (!changed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "assignment.due_changed", targetType: "assignment", targetId: id });
  await recomputeChanged(db(), v.tenant.id, before);
  refresh();
  return { ok: true };
}

export async function removeAssignmentAction(id: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("assignments.write");
  if (!isUuid(id)) return { ok: false };
  const before = await resolveAssignments(db(), v.tenant.id);
  const removed = await db().delete(t.assignments).where(and(eq(t.assignments.id, id), eq(t.assignments.tenantId, v.tenant.id))).returning({ id: t.assignments.id });
  if (!removed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "assignment.removed", targetType: "assignment", targetId: id });
  await recomputeChanged(db(), v.tenant.id, before);
  refresh();
  return { ok: true };
}

/* ───────── policies ───────── */

export async function createPolicyAction(title: string): Promise<{ ok: boolean; id?: string }> {
  const v = await actionViewer("policies.write");
  const name = nameSchema.safeParse(title);
  if (!name.success) return { ok: false };
  const [row] = await db().insert(t.policies).values({ tenantId: v.tenant.id, title: name.data, createdBy: v.user.id }).returning({ id: t.policies.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.created", targetType: "policy", targetId: row.id, meta: { title: name.data } });
  refresh();
  return { ok: true, id: row.id };
}

const policyTextSchema = z.object({
  title: z.string().trim().max(200),
  summary: z.string().trim().max(600).optional(),
  bodyMd: z.string().trim().max(200_000),
});

const versionSchema = z.object({
  policyId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(600).optional(),
  bodyMd: z.string().trim().min(20).max(200_000),
  /** The same version in the organisation's other languages; a language left empty shows the base text. */
  translations: z.partialRecord(z.enum(LOCALES), policyTextSchema).optional(),
});

export async function publishVersionAction(input: z.infer<typeof versionSchema>): Promise<{ ok: boolean; version?: number }> {
  const v = await actionViewer("policies.write");
  const p = versionSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const [policy] = await db().select().from(t.policies).where(and(eq(t.policies.id, p.data.policyId), eq(t.policies.tenantId, v.tenant.id)));
  if (!policy) return { ok: false };
  // The base text is in the organisation's default language; its marked copy records that (lib/policy-text.ts).
  const base = v.tenant.settings.defaultLocale;
  const translations: Record<string, PolicyText> = { [base]: { title: p.data.title, ...(p.data.summary ? { summary: p.data.summary } : {}), bodyMd: p.data.bodyMd, base: true } };
  for (const [locale, x] of Object.entries(p.data.translations ?? {})) {
    if (locale === base || !x?.bodyMd) continue;
    if (x.bodyMd.length < 20) return { ok: false };
    translations[locale] = { title: x.title || p.data.title, ...(x.summary ? { summary: x.summary } : {}), bodyMd: x.bodyMd };
  }
  const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${t.policyVersions.version}), 0)` }).from(t.policyVersions).where(eq(t.policyVersions.policyId, policy.id));
  const version = Number(max) + 1;
  await db()
    .insert(t.policyVersions)
    .values({
      policyId: policy.id,
      version,
      title: p.data.title,
      summary: p.data.summary || null,
      bodyMd: p.data.bodyMd,
      translations,
      publishedAt: new Date(),
    });
  await db().update(t.policies).set({ title: p.data.title }).where(eq(t.policies.id, policy.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.version_published", targetType: "policy", targetId: policy.id, meta: { version } });
  // Each person's notice in their language, with the title they will read.
  const everyone = await db().select({ id: t.users.id, locale: t.users.locale }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active")));
  const bodies = new Map<string, string>();
  for (const locale of new Set(everyone.map((u) => (isLocale(u.locale) ? u.locale : base)))) bodies.set(locale, (await getTranslations({ locale, namespace: "admin.policies" }))("notifyBody", { version }));
  if (everyone.length) {
    await db()
      .insert(t.notifications)
      .values(
        everyone.map((u) => {
          const locale = isLocale(u.locale) ? u.locale : base;
          return { tenantId: v.tenant.id, userId: u.id, kind: "policy", title: translations[locale]?.title ?? p.data.title, body: bodies.get(locale) ?? null, href: `/policies/${policy.id}?from=%2Fapp` };
        }),
      );
  }
  refresh();
  return { ok: true, version };
}

export async function archivePolicyAction(id: string, archived: boolean): Promise<{ ok: boolean }> {
  const v = await actionViewer("policies.write");
  if (!isUuid(id)) return { ok: false };
  const changed = await db()
    .update(t.policies)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(t.policies.id, id), eq(t.policies.tenantId, v.tenant.id)))
    .returning({ id: t.policies.id });
  if (!changed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: archived ? "policy.archived" : "policy.restored", targetType: "policy", targetId: id });
  refresh();
  return { ok: true };
}

export async function remindPolicyAction(versionId: string): Promise<{ count: number }> {
  const v = await actionViewer("policies.write");
  if (!isUuid(versionId)) return { count: 0 };
  const [version] = await db()
    .select({ id: t.policyVersions.id, policyId: t.policyVersions.policyId, version: t.policyVersions.version, title: t.policyVersions.title, translations: t.policyVersions.translations, tenantId: t.policies.tenantId })
    .from(t.policyVersions)
    .innerJoin(t.policies, eq(t.policies.id, t.policyVersions.policyId))
    .where(eq(t.policyVersions.id, versionId));
  if (!version || version.tenantId !== v.tenant.id) return { count: 0 };
  const signed = new Set((await db().select({ userId: t.policySignoffs.userId }).from(t.policySignoffs).where(eq(t.policySignoffs.versionId, versionId))).map((s) => s.userId));
  const people = await db().select({ id: t.users.id }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active")));
  const targets = people.filter((p) => !signed.has(p.id)).map((p) => p.id);
  // The title each person reads, and an in-app note in their language; the notice's title is the subject ("Signature needed: …").
  const title = (locale: string) => version.translations?.[locale]?.title ?? version.title;
  const bodies = new Map(await Promise.all(LOCALES.map(async (l) => [l, (await getTranslations({ locale: l, namespace: "admin.policies" }))("notifyBody", { version: version.version })] as const)));
  const body = (locale: string) => bodies.get(isLocale(locale) ? locale : "en") ?? "";
  const href = `/policies/${version.policyId}?from=%2Fapp`;
  const count = await notifyUsers(db(), v.tenant.id, targets, "policy_reminder", { module: title, link: href }, { body, href }, { defer: true });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.reminder", targetType: "policy", targetId: version.policyId, meta: { count } });
  return { count };
}

/* ───────── problem reports ───────── */

export async function setProblemStatusAction(id: string, status: "new" | "in_progress" | "resolved" | "not_a_problem"): Promise<{ ok: boolean }> {
  const v = await actionViewer("problems.manage");
  if (!isUuid(id) || !["new", "in_progress", "resolved", "not_a_problem"].includes(status)) return { ok: false };
  const changed = await db()
    .update(t.problemReports)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(t.problemReports.id, id), eq(t.problemReports.tenantId, v.tenant.id)))
    .returning({ id: t.problemReports.id });
  if (!changed.length) return { ok: false };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "problem.status", targetType: "problem", targetId: id, meta: { status } });
  refresh();
  return { ok: true };
}
