"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, type Viewer } from "../auth/viewer";
import { ASSIGNABLE_ROLES } from "../auth/permissions";
import { issueAccountLink } from "../auth/links";
import { invalidateUserSessions } from "../auth/session";
import { audit } from "../services/audit";
import { notifyUsers } from "../services/notify";
import { resolveAssignments } from "../services/assignments";
import { recomputeRisk } from "../services/risk";
import { scopeDepartmentIds } from "../queries/admin";
import { clientIp } from "../request";
import { parseCsv } from "../../lib/csv";
import { LOCALES } from "../../i18n/config";
import type { Role } from "../db/schema";
import { pick } from "../../i18n/config";

async function target(v: Viewer, userId: string) {
  const [u] = await db().select().from(t.users).where(and(eq(t.users.id, userId), eq(t.users.tenantId, v.tenant.id), ne(t.users.status, "deleted")));
  return u ?? null;
}

const personSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES as [Role, ...Role[]]),
  departmentId: z.string().uuid().or(z.literal("")).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+\d{8,15})?$/)
    .optional(),
  locale: z.enum(LOCALES).default("az"),
});

export type PersonState = { ok?: boolean; error?: string; name?: string } | undefined;

export async function addPersonAction(_: PersonState, form: FormData): Promise<PersonState> {
  const v = await actionViewer("people.write");
  const p = personSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  if (p.data.role === "tenant_admin" && v.user.role !== "tenant_admin" && v.user.role !== "super_admin") return { error: "invalid" };
  const [exists] = await db().select({ id: t.users.id }).from(t.users).where(eq(t.users.email, p.data.email));
  if (exists) return { error: "emailTaken" };
  const [row] = await db()
    .insert(t.users)
    .values({
      tenantId: v.tenant.id,
      name: p.data.name,
      email: p.data.email,
      role: p.data.role,
      status: "invited",
      departmentId: p.data.departmentId || null,
      jobTitle: p.data.jobTitle || null,
      phone: p.data.phone || null,
      locale: p.data.locale,
    })
    .returning({ id: t.users.id });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.added", targetType: "user", targetId: row.id, ip: await clientIp(), meta: { email: p.data.email, role: p.data.role } });
  if (v.tenant.settings.email.enabled) await emailInvite(v.tenant.id, row.id);
  refresh();
  return { ok: true, name: p.data.name };
}

/** Issues an invite link and sends the welcome mail to one invited person. Returns 1 when a mail was queued. */
async function emailInvite(tenantId: string, userId: string, defer = false): Promise<number> {
  const link = await issueAccountLink(userId, "invite");
  return notifyUsers(db(), tenantId, [userId], "welcome", { link: link.replace(/^https?:\/\/[^/]+/, "") }, undefined, { statuses: ["active", "invited"], defer });
}

/** Bulk bar on People: emails the invitation to the selected people who have not activated yet. */
export async function emailInvitesAction(userIds: string[]): Promise<{ ok: boolean; count: number }> {
  const v = await actionViewer("people.write");
  if (!v.tenant.settings.email.enabled) return { ok: false, count: 0 };
  const people = await db()
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, userIds.slice(0, 5000)), eq(t.users.status, "invited"), ne(t.users.role, "super_admin")));
  let count = 0;
  for (const u of people) count += await emailInvite(v.tenant.id, u.id, true);
  if (count) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.invites_emailed", ip: await clientIp(), meta: { count } });
  refresh();
  return { ok: true, count };
}

export async function createLinkAction(userId: string, kind: "invite" | "reset"): Promise<{ ok: boolean; url?: string }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u) return { ok: false };
  const url = await issueAccountLink(u.id, kind);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: kind === "invite" ? "person.invite_link" : "person.reset_link", targetType: "user", targetId: u.id, ip: await clientIp() });
  return { ok: true, url };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().max(120).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+\d{8,15})?$/)
    .optional(),
  locale: z.enum(LOCALES),
});

export async function updatePersonAction(userId: string, input: z.infer<typeof updateSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  const p = updateSchema.safeParse(input);
  if (!u || !p.success) return { ok: false };
  await db().update(t.users).set({ name: p.data.name, jobTitle: p.data.jobTitle || null, phone: p.data.phone || null, locale: p.data.locale }).where(eq(t.users.id, u.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.changed", targetType: "user", targetId: u.id });
  refresh();
  return { ok: true };
}

export async function changeRoleAction(userId: string, role: Role): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || u.id === v.user.id || !ASSIGNABLE_ROLES.includes(role)) return { ok: false };
  if ((role === "tenant_admin" || u.role === "tenant_admin") && v.user.role !== "tenant_admin" && v.user.role !== "super_admin") return { ok: false };
  await db().update(t.users).set({ role }).where(eq(t.users.id, u.id));
  // Privilege changes take effect on the next sign-in.
  await invalidateUserSessions(u.id);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.role_changed", targetType: "user", targetId: u.id, meta: { from: u.role, to: role } });
  refresh();
  return { ok: true };
}

/** Clears the authenticator and backup codes and signs the person out everywhere; they set it up again from their profile. */
export async function resetTwoFactorAction(userId: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || u.id === v.user.id) return { ok: false };
  await db().update(t.users).set({ totpSecret: null, totpEnabled: false, totpRecovery: null }).where(eq(t.users.id, u.id));
  await invalidateUserSessions(u.id);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.2fa_reset", targetType: "user", targetId: u.id, ip: await clientIp() });
  const tr = await getTranslations({ locale: u.locale, namespace: "admin.person" });
  await db().insert(t.notifications).values({ tenantId: v.tenant.id, userId: u.id, kind: "security", title: tr("twoFactorResetTitle"), body: tr("twoFactorResetBody"), href: "/profile" });
  refresh();
  return { ok: true };
}

export async function moveDepartmentAction(userIds: string[], departmentId: string | null): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  if (departmentId) {
    const [d] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, departmentId), eq(t.departments.tenantId, v.tenant.id)));
    if (!d) return { ok: false };
  }
  const ids = userIds.slice(0, 5000);
  await db().update(t.users).set({ departmentId }).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids)));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.moved", meta: { count: ids.length, departmentId } });
  await recomputeRisk(db(), v.tenant.id, ids);
  refresh();
  return { ok: true };
}

export async function setStatusAction(userIds: string[], status: "active" | "suspended"): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const ids = userIds.filter((id) => id !== v.user.id).slice(0, 5000);
  if (!ids.length) return { ok: false };
  await db().update(t.users).set({ status }).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids), ne(t.users.status, "deleted")));
  if (status === "suspended") for (const id of ids) await invalidateUserSessions(id);
  for (const id of ids) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: status === "suspended" ? "person.suspended" : "person.reactivated", targetType: "user", targetId: id });
  refresh();
  return { ok: true };
}

/** Deletion anonymises the person: learning history stays for reports, identity is removed. */
async function anonymise(v: Viewer, userId: string, action: "person.deleted" | "person.deletion_approved") {
  await db()
    .update(t.users)
    .set({ name: "—", email: `deleted+${userId}@invalid.local`, phone: null, jobTitle: null, avatarUrl: null, passwordHash: null, totpSecret: null, totpEnabled: false, totpRecovery: null, status: "deleted", deletionRequestedAt: null, managerId: null })
    .where(eq(t.users.id, userId));
  await invalidateUserSessions(userId);
  await db().delete(t.authTokens).where(eq(t.authTokens.userId, userId));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action, targetType: "user", targetId: userId, ip: await clientIp() });
}

export async function deletePersonAction(userId: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || u.id === v.user.id) return { ok: false };
  await anonymise(v, u.id, "person.deleted");
  refresh();
  return { ok: true };
}

export async function decideDeletionAction(userId: string, approve: boolean): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || !u.deletionRequestedAt) return { ok: false };
  if (approve) await anonymise(v, u.id, "person.deletion_approved");
  else {
    await db().update(t.users).set({ deletionRequestedAt: null }).where(eq(t.users.id, u.id));
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.deletion_declined", targetType: "user", targetId: u.id });
  }
  refresh();
  return { ok: true };
}

/** Reminds the selected people about assigned modules they haven't finished. */
export async function remindPeopleAction(userIds: string[]): Promise<{ count: number }> {
  const v = await actionViewer("assignments.read");
  const scope = await scopeDepartmentIds(v);
  const users = await db()
    .select({ id: t.users.id, departmentId: t.users.departmentId, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, userIds.slice(0, 5000)), eq(t.users.status, "active")));
  const allowedUsers = users.filter((u) => !scope || (u.departmentId && scope.has(u.departmentId)));
  const assigned = await resolveAssignments(db(), v.tenant.id, allowedUsers.map((u) => u.id));
  const mods = await db().select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules);
  const modMap = new Map(mods.map((m) => [m.id, m]));
  const done = allowedUsers.length
    ? await db()
        .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
        .from(t.moduleProgress)
        .where(and(inArray(t.moduleProgress.userId, allowedUsers.map((u) => u.id)), eq(t.moduleProgress.status, "completed")))
    : [];
  const doneSet = new Set(done.map((d) => `${d.userId}:${d.moduleId}`));
  let count = 0;
  for (const u of allowedUsers) {
    const pending = [...(assigned.get(u.id) ?? new Map()).values()].filter((m) => !doneSet.has(`${u.id}:${m.moduleId}`));
    if (!pending.length) continue;
    const first = modMap.get(pending[0].moduleId);
    if (!first) continue;
    count += await notifyUsers(db(), v.tenant.id, [u.id], "reminder", { module: pick(first.title, u.locale), dueDate: pending[0].due ?? undefined, link: `/learn/${first.slug}` }, { title: pick(first.title, u.locale), href: `/learn/${first.slug}` });
  }
  refresh();
  return { count };
}

const ROLE_ALIASES: Record<string, Role> = {
  learner: "learner",
  employee: "learner",
  department_head: "department_head",
  head: "department_head",
  executive: "executive",
  analyst: "analyst",
  campaign_manager: "campaign_manager",
  content_creator: "content_creator",
  admin: "tenant_admin",
  administrator: "tenant_admin",
  tenant_admin: "tenant_admin",
};

export type ImportPreview = { ok: boolean; rows: number; problems: { line: number; problem: string }[]; newDepartments: string[]; imported?: number; error?: string };

/** CSV import in two steps: "check" validates everything, "commit" writes only a clean file. */
export async function importPeopleAction(csv: string, commit: boolean): Promise<ImportPreview> {
  const v = await actionViewer("people.write");
  if (csv.length > 5_000_000) return { ok: false, rows: 0, problems: [], newDepartments: [], error: "tooMany" };
  const table = parseCsv(csv);
  if (table.length < 2) return { ok: false, rows: 0, problems: [{ line: 1, problem: "header" }], newDepartments: [] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("name") < 0 || col("email") < 0) return { ok: false, rows: 0, problems: [{ line: 1, problem: "header" }], newDepartments: [] };
  if (table.length > 5001) return { ok: false, rows: 0, problems: [], newDepartments: [], error: "tooMany" };

  const departments = await db().select().from(t.departments).where(eq(t.departments.tenantId, v.tenant.id));
  const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const existing = new Set((await db().select({ email: t.users.email }).from(t.users)).map((u) => u.email));
  const seen = new Set<string>();
  const problems: { line: number; problem: string }[] = [];
  const newDepartments = new Set<string>();
  const rows: { name: string; email: string; department: string; jobTitle: string; role: Role; manager: string; phone: string }[] = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    const name = get("name");
    const email = get("email").toLowerCase();
    const roleRaw = get("role").toLowerCase();
    const department = get("department");
    if (!name) problems.push({ line, problem: "name" });
    if (!z.email().safeParse(email).success) problems.push({ line, problem: "email" });
    else if (seen.has(email)) problems.push({ line, problem: "duplicate" });
    else if (existing.has(email)) problems.push({ line, problem: "exists" });
    seen.add(email);
    const role = roleRaw ? ROLE_ALIASES[roleRaw] : "learner";
    if (!role) problems.push({ line, problem: "role" });
    if (department && !deptByName.has(department.toLowerCase())) newDepartments.add(department);
    rows.push({ name, email, department, jobTitle: get("job_title"), role: role ?? "learner", manager: get("manager_email").toLowerCase(), phone: get("phone") });
  });
  if (!commit || problems.length) return { ok: problems.length === 0, rows: rows.length, problems: problems.slice(0, 200), newDepartments: [...newDepartments] };

  for (const name of newDepartments) {
    const [d] = await db().insert(t.departments).values({ tenantId: v.tenant.id, name }).returning({ id: t.departments.id });
    deptByName.set(name.toLowerCase(), d.id);
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "department.created", targetType: "department", targetId: d.id, meta: { name, via: "import" } });
  }
  const created: { id: string; email: string; manager: string }[] = [];
  for (const r of rows) {
    const [u] = await db()
      .insert(t.users)
      .values({
        tenantId: v.tenant.id,
        name: r.name,
        email: r.email,
        role: r.role === "tenant_admin" && v.user.role !== "tenant_admin" ? "learner" : r.role,
        status: "invited",
        departmentId: r.department ? deptByName.get(r.department.toLowerCase()) ?? null : null,
        jobTitle: r.jobTitle || null,
        phone: /^\+\d{8,15}$/.test(r.phone) ? r.phone : null,
        locale: v.tenant.settings.defaultLocale,
      })
      .returning({ id: t.users.id });
    created.push({ id: u.id, email: r.email, manager: r.manager });
  }
  const all = await db().select({ id: t.users.id, email: t.users.email }).from(t.users).where(eq(t.users.tenantId, v.tenant.id));
  const byEmail = new Map(all.map((u) => [u.email, u.id]));
  for (const c of created) {
    const mid = c.manager ? byEmail.get(c.manager) : undefined;
    if (mid) await db().update(t.users).set({ managerId: mid }).where(eq(t.users.id, c.id));
  }
  // Same promise as Add person: everyone imported gets their invitation once sending is on.
  let emailed = 0;
  if (v.tenant.settings.email.enabled) for (const c of created) emailed += await emailInvite(v.tenant.id, c.id, true);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.imported", ip: await clientIp(), meta: { count: created.length, emailed } });
  refresh();
  return { ok: true, rows: rows.length, problems: [], newDepartments: [...newDepartments], imported: created.length };
}
