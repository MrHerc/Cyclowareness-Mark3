"use server";

import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db, t } from "../db";
import { isUniqueViolation, logFailure } from "../db/errors";
import { actionViewer, type Viewer } from "../auth/viewer";
import { isUuid } from "../../lib/ids";
import { ASSIGNABLE_ROLES } from "../auth/permissions";
import { emailDomain } from "../auth/sso-routing";
import { issueAccountLink } from "../auth/links";
import { invalidateUserSessions } from "../auth/session";
import { stepUp, type StepUpError } from "../auth/step-up";
import { audit } from "../services/audit";
import { notifyTakeover, notifyUsers } from "../services/notify";
import { coveringAssignments, departmentClosure, gainsCoverage, resolveAssignments } from "../services/assignments";
import { recomputeRisk } from "../services/risk";
import { scopeDepartmentIds } from "../queries/admin";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";
import { importTooBig, parseCsv } from "../../lib/csv";
import { cleanPhone, PHONE_PATTERN } from "../../lib/phone";
import { departmentKey } from "../../lib/departments";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/config";
import type { Role } from "../db/schema";
import { pick } from "../../i18n/config";
import azCommon from "../../../messages/az/common.json";
import enCommon from "../../../messages/en/common.json";
import ruCommon from "../../../messages/ru/common.json";
import trCommon from "../../../messages/tr/common.json";
import roCommon from "../../../messages/ro/common.json";
import kaCommon from "../../../messages/ka/common.json";
import ukCommon from "../../../messages/uk/common.json";
import deCommon from "../../../messages/de/common.json";
import frCommon from "../../../messages/fr/common.json";
import arCommon from "../../../messages/ar/common.json";

/** The platform operator is out of reach of tenant administrators (even in the platform organisation): only another super_admin acts on one. */
const reachable = (v: Viewer) => (v.user.role === "super_admin" ? undefined : ne(t.users.role, "super_admin"));

async function target(v: Viewer, userId: string) {
  // The id reaches a uuid column: anything else is no person (instead of a database error).
  if (!isUuid(userId)) return null;
  const [u] = await db().select().from(t.users).where(and(eq(t.users.id, userId), eq(t.users.tenantId, v.tenant.id), ne(t.users.status, "deleted"), reachable(v)));
  return u ?? null;
}

/** Optional phone, written as people type it (+994 50 123 45 67, as the CSV import accepts) and stored as +994501234567. */
const phoneSchema = z
  .string()
  .transform(cleanPhone)
  .pipe(z.string().regex(PHONE_PATTERN).or(z.literal("")))
  .optional();

const personSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES as [Role, ...Role[]]),
  departmentId: z.string().uuid().or(z.literal("")).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  phone: phoneSchema,
  locale: z.enum(LOCALES).default("az"),
});

/** `fields`: the inputs the server rejected (zod paths), so the form marks exactly those. */
export type PersonState = { ok?: boolean; error?: string; name?: string; fields?: string[] } | undefined;

/**
 * Phone numbers sign people in, so a number can belong to one account only (across organisations): the organisation
 * of the live account that holds it, else null. An administrator is told which account only within their own
 * organisation; a number held elsewhere is just "cannot be added" (no cross-organisation existence oracle).
 */
async function phoneHolder(phone: string, exceptUserId?: string): Promise<string | null> {
  const rows = await db().select({ id: t.users.id, tenantId: t.users.tenantId }).from(t.users).where(and(eq(t.users.phone, phone), ne(t.users.status, "deleted"))).limit(2);
  return rows.find((r) => r.id !== exceptUserId)?.tenantId ?? null;
}

/** The problem to report for a taken address or number: its own account within the organisation, a neutral reason outside it. */
const takenBy = <T extends string>(holderTenantId: string, v: Viewer, own: T): T | "cannotAdd" => (holderTenantId === v.tenant.id ? own : "cannotAdd");

/** Domains other organisations have proven: their addresses cannot be claimed here (that would block them from adding their own people). */
async function foreignVerifiedDomains(tenantId: string): Promise<Set<string>> {
  const rows = await db()
    .select({ domain: t.tenants.domain })
    .from(t.tenants)
    .where(and(ne(t.tenants.id, tenantId), isNotNull(t.tenants.domainVerifiedAt), isNotNull(t.tenants.domain)));
  return new Set(rows.map((r) => r.domain!.toLowerCase()));
}

/** Values go to the database in batches of this size (an import holds up to 5,000 rows). */
const LOOKUP_BATCH = 500;

/** Which of these addresses already belong to an account, and in which organisation: any one, deleted accounts included, as the unique index spans them all. */
async function takenEmails(emails: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(emails.filter(Boolean))];
  const taken = new Map<string, string>();
  for (let i = 0; i < wanted.length; i += LOOKUP_BATCH) {
    const rows = await db().select({ email: t.users.email, tenantId: t.users.tenantId }).from(t.users).where(inArray(t.users.email, wanted.slice(i, i + LOOKUP_BATCH)));
    for (const r of rows) taken.set(r.email, r.tenantId);
  }
  return taken;
}

/** Which of these numbers already belong to a live account, and in which organisation (see phoneHolder). */
async function takenPhones(phones: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(phones.filter(Boolean))];
  const taken = new Map<string, string>();
  for (let i = 0; i < wanted.length; i += LOOKUP_BATCH) {
    const rows = await db()
      .select({ phone: t.users.phone, tenantId: t.users.tenantId })
      .from(t.users)
      .where(and(inArray(t.users.phone, wanted.slice(i, i + LOOKUP_BATCH)), ne(t.users.status, "deleted")));
    for (const r of rows) taken.set(r.phone!, r.tenantId);
  }
  return taken;
}

export async function addPersonAction(_: PersonState, form: FormData): Promise<PersonState> {
  const v = await actionViewer("people.write");
  const p = personSchema.safeParse(Object.fromEntries(form));
  if (!p.success) {
    const fields = [...new Set(p.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
    // A wrong phone number gets its own message (expected format); the rest are marked as invalid.
    return { error: fields.length === 1 && fields[0] === "phone" ? "invalidPhone" : "invalid", fields };
  }
  if (p.data.role === "tenant_admin" && v.user.role !== "tenant_admin" && v.user.role !== "super_admin") return { error: "invalid" };
  // Each answer tells whether an address exists somewhere, so an administrator gets a bounded number of tries.
  if (!(await rateLimit(`people-add:${v.user.id}`, 60, 60 * 60_000)).ok) return { error: "rateLimited" };
  // Checked before any lookup: an address on another organisation's proven domain gets the same answer whether or not it exists.
  if ((await foreignVerifiedDomains(v.tenant.id)).has(emailDomain(p.data.email) ?? "")) return { error: "foreignDomain" };
  const [exists] = await db().select({ tenantId: t.users.tenantId }).from(t.users).where(eq(t.users.email, p.data.email));
  if (exists) return { error: takenBy(exists.tenantId, v, "emailTaken") };
  const holder = p.data.phone ? await phoneHolder(p.data.phone) : null;
  if (holder) return { error: takenBy(holder, v, "phoneTaken") };
  if (p.data.departmentId) {
    const [dept] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, p.data.departmentId), eq(t.departments.tenantId, v.tenant.id)));
    if (!dept) return { error: "invalid", fields: ["departmentId"] };
  }
  let row: { id: string };
  try {
    [row] = await db()
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
  } catch (error) {
    // The checks above can race with a concurrent add; the unique indexes decide.
    if (isUniqueViolation(error, "users_email_idx")) return { error: "emailTaken" };
    if (isUniqueViolation(error, "users_phone_active_idx")) return { error: "phoneTaken" };
    // Any other failure keeps the dialog open with a notice instead of replacing it with the error page.
    unstable_rethrow(error);
    logFailure("[people] adding a person failed", error);
    return { error: "generic" };
  }
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
  const ids = Array.isArray(userIds) ? userIds.filter(isUuid).slice(0, 5000) : [];
  if (!ids.length) return { ok: false, count: 0 };
  const people = await db()
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids), eq(t.users.status, "invited"), ne(t.users.role, "super_admin")));
  let count = 0;
  for (const u of people) count += await emailInvite(v.tenant.id, u.id, true);
  if (count) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.invites_emailed", ip: await clientIp(), meta: { count } });
  refresh();
  return { ok: true, count };
}

export async function createLinkAction(userId: string, kind: "invite" | "reset", password?: string): Promise<{ ok: boolean; url?: string; error?: StepUpError }> {
  const v = await actionViewer("people.write");
  if (kind !== "invite" && kind !== "reset") return { ok: false };
  // A reset link takes over a live account; an invite only activates one nobody has used yet.
  const refused = kind === "reset" ? await stepUp(v, password, "person.reset_link") : null;
  if (refused) return { ok: false, error: refused };
  const u = await target(v, userId);
  if (!u) return { ok: false };
  const url = await issueAccountLink(u.id, kind);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: kind === "invite" ? "person.invite_link" : "person.reset_link", targetType: "user", targetId: u.id, ip: await clientIp() });
  if (kind === "reset") await notifyTakeover(db(), v.tenant.id, v.user, u, "resetLinkIssued");
  return { ok: true, url };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().max(120).optional(),
  phone: phoneSchema,
  locale: z.enum(LOCALES),
});

/** `error` and `fields` as for adding a person, so the dialog marks the rejected input. */
export type UpdatePersonResult = { ok: boolean; error?: "invalid" | "invalidPhone" | "phoneTaken" | "cannotAdd" | "rateLimited"; fields?: string[] };

export async function updatePersonAction(userId: string, input: z.input<typeof updateSchema>): Promise<UpdatePersonResult> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u) return { ok: false, error: "invalid" };
  const p = updateSchema.safeParse(input);
  if (!p.success) {
    const fields = [...new Set(p.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
    return { ok: false, error: fields.length === 1 && fields[0] === "phone" ? "invalidPhone" : "invalid", fields };
  }
  // A new number is looked up across organisations, like an addition: it counts against the same per-administrator limit.
  if (p.data.phone && p.data.phone !== u.phone && !(await rateLimit(`people-add:${v.user.id}`, 60, 60 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  const holder = p.data.phone ? await phoneHolder(p.data.phone, u.id) : null;
  if (holder) return { ok: false, error: takenBy(holder, v, "phoneTaken"), fields: ["phone"] };
  try {
    await db().update(t.users).set({ name: p.data.name, jobTitle: p.data.jobTitle || null, phone: p.data.phone || null, locale: p.data.locale }).where(eq(t.users.id, u.id));
  } catch (error) {
    // The check above can race with another save; the unique index decides.
    if (isUniqueViolation(error, "users_phone_active_idx")) return { ok: false, error: "phoneTaken", fields: ["phone"] };
    throw error;
  }
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.changed", targetType: "user", targetId: u.id });
  refresh();
  return { ok: true };
}

export async function changeRoleAction(userId: string, role: Role, password?: string): Promise<{ ok: boolean; error?: StepUpError }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || u.id === v.user.id || !ASSIGNABLE_ROLES.includes(role)) return { ok: false };
  if ((role === "tenant_admin" || u.role === "tenant_admin") && v.user.role !== "tenant_admin" && v.user.role !== "super_admin") return { ok: false };
  if (u.role === role) return { ok: true };
  const refused = await stepUp(v, password, "person.role_changed");
  if (refused) return { ok: false, error: refused };
  await db().update(t.users).set({ role }).where(eq(t.users.id, u.id));
  // Privilege changes take effect on the next sign-in.
  await invalidateUserSessions(u.id);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.role_changed", targetType: "user", targetId: u.id, meta: { from: u.role, to: role } });
  // Peers hear of it when an administrator is made or unmade.
  await notifyTakeover(db(), v.tenant.id, v.user, { ...u, role: role === "tenant_admin" ? role : u.role }, "roleChanged", (locale) => ROLE_NAMES[locale as Locale]?.[role] ?? role);
  refresh();
  return { ok: true };
}

/** Clears the authenticator and backup codes and signs the person out everywhere; they set it up again from their profile. */
export async function resetTwoFactorAction(userId: string, password?: string): Promise<{ ok: boolean; error?: StepUpError }> {
  const v = await actionViewer("people.write");
  const refused = await stepUp(v, password, "auth.2fa_reset");
  if (refused) return { ok: false, error: refused };
  const u = await target(v, userId);
  if (!u || u.id === v.user.id) return { ok: false };
  await db().update(t.users).set({ totpSecret: null, totpEnabled: false, totpRecovery: null }).where(eq(t.users.id, u.id));
  await invalidateUserSessions(u.id);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.2fa_reset", targetType: "user", targetId: u.id, ip: await clientIp() });
  await notifyTakeover(db(), v.tenant.id, v.user, u, "twoFactorReset");
  refresh();
  return { ok: true };
}

/** Clears the provider identity bound at the first SSO sign-in (sso_subject); the next sign-in binds the account anew (a person re-created at the identity provider). */
export async function unlinkSsoAction(userId: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u?.ssoSubject) return { ok: false };
  await db().update(t.users).set({ ssoSubject: null }).where(eq(t.users.id, u.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "sso.unlinked", targetType: "user", targetId: u.id, ip: await clientIp() });
  refresh();
  return { ok: true };
}

export async function moveDepartmentAction(userIds: string[], departmentId: string | null): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  if (departmentId !== null && !isUuid(departmentId)) return { ok: false };
  if (departmentId) {
    const [d] = await db().select({ id: t.departments.id }).from(t.departments).where(and(eq(t.departments.id, departmentId), eq(t.departments.tenantId, v.tenant.id)));
    if (!d) return { ok: false };
  }
  const ids = Array.isArray(userIds) ? userIds.filter(isUuid).slice(0, 5000) : [];
  if (!ids.length) return { ok: false };
  // Reminders for department assignments count from the department date, so it moves only for people
  // the move puts under a department assignment that did not cover them before (see assignedSince).
  const [departments, assignments, people] = await Promise.all([
    db().select({ id: t.departments.id, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, v.tenant.id)),
    db()
      .select({ id: t.assignments.id, scope: t.assignments.scope, departmentId: t.assignments.departmentId })
      .from(t.assignments)
      .where(and(eq(t.assignments.tenantId, v.tenant.id), eq(t.assignments.scope, "department"))),
    db().select({ id: t.users.id, departmentId: t.users.departmentId }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids), reachable(v))),
  ]);
  const moved = people.map((p) => p.id);
  if (!moved.length) return { ok: false };
  const closure = departmentClosure(departments);
  const after = coveringAssignments(assignments, closure, departmentId);
  const gained = people.filter((p) => p.departmentId !== departmentId && gainsCoverage(coveringAssignments(assignments, closure, p.departmentId), after)).map((p) => p.id);
  await db().transaction(async (tx) => {
    const changing = and(eq(t.users.tenantId, v.tenant.id), sql`${t.users.departmentId} is distinct from ${departmentId}`);
    if (gained.length) await tx.update(t.users).set({ departmentId, departmentChangedAt: new Date() }).where(and(changing, inArray(t.users.id, gained)));
    await tx.update(t.users).set({ departmentId }).where(and(changing, inArray(t.users.id, moved)));
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.moved", meta: { count: moved.length, departmentId } });
  await recomputeRisk(db(), v.tenant.id, moved);
  refresh();
  return { ok: true };
}

export async function setStatusAction(userIds: string[], status: "active" | "suspended"): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  if (status !== "active" && status !== "suspended") return { ok: false };
  const ids = userIds.filter((id) => id !== v.user.id && isUuid(id)).slice(0, 5000);
  if (!ids.length) return { ok: false };
  const changed = await db()
    .update(t.users)
    // An account that was never activated (still invited, or suspended before it accepted its invite: no
    // activation date and no password) starts its reminder clock now, as accepting the invite does.
    .set(
      status === "active"
        ? {
            status,
            activatedAt: sql`case when ${t.users.status} = 'invited' or (${t.users.status} = 'suspended' and ${t.users.activatedAt} is null and ${t.users.passwordHash} is null) then now() else ${t.users.activatedAt} end`,
          }
        : { status },
    )
    .where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids), ne(t.users.status, "deleted"), reachable(v)))
    .returning({ id: t.users.id });
  if (status === "suspended") for (const { id } of changed) await invalidateUserSessions(id);
  for (const { id } of changed) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: status === "suspended" ? "person.suspended" : "person.reactivated", targetType: "user", targetId: id });
  refresh();
  return { ok: changed.length > 0 };
}

/** Deletion anonymises the person: learning history stays for reports, identity is removed. */
async function anonymise(v: Viewer, u: { id: string; email: string }, action: "person.deleted" | "person.deletion_approved") {
  const userId = u.id;
  // All or nothing: a deleted person must not stay a department head or manager, or keep sign-in links.
  await db().transaction(async (tx) => {
    await tx
      .update(t.users)
      .set({ name: "—", email: `deleted+${userId}@invalid.local`, phone: null, jobTitle: null, avatarUrl: null, passwordHash: null, ssoSubject: null, totpSecret: null, totpEnabled: false, totpRecovery: null, status: "deleted", deletionRequestedAt: null, managerId: null })
      .where(eq(t.users.id, userId));
    // Nobody is managed or headed by a deleted person: manager alerts would otherwise go nowhere.
    await tx.update(t.departments).set({ headUserId: null }).where(and(eq(t.departments.headUserId, userId), eq(t.departments.tenantId, v.tenant.id)));
    await tx.update(t.users).set({ managerId: null }).where(and(eq(t.users.managerId, userId), eq(t.users.tenantId, v.tenant.id)));
    // Signed out everywhere (as invalidateUserSessions does), in the same transaction.
    await tx.delete(t.sessions).where(eq(t.sessions.userId, userId));
    await tx.delete(t.authTokens).where(eq(t.authTokens.userId, userId));
    // The address is removed wherever else it was kept (privacy policy): mail to it, queued ones included (so they
    // are never delivered), the IP of policy sign-offs, and the address in audit entries about the person.
    await tx.delete(t.outbox).where(and(eq(t.outbox.tenantId, v.tenant.id), sql`lower(${t.outbox.to}) = ${u.email.toLowerCase()}`));
    await tx.update(t.policySignoffs).set({ ip: null }).where(eq(t.policySignoffs.userId, userId));
    await tx
      .update(t.auditLog)
      .set({ meta: sql`${t.auditLog.meta} - 'email'` })
      .where(and(eq(t.auditLog.tenantId, v.tenant.id), eq(t.auditLog.targetType, "user"), eq(t.auditLog.targetId, userId)));
  });
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action, targetType: "user", targetId: userId, ip: await clientIp() });
}

export async function deletePersonAction(userId: string): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || u.id === v.user.id) return { ok: false };
  await anonymise(v, u, "person.deleted");
  refresh();
  return { ok: true };
}

export async function decideDeletionAction(userId: string, approve: boolean): Promise<{ ok: boolean }> {
  const v = await actionViewer("people.write");
  const u = await target(v, userId);
  if (!u || !u.deletionRequestedAt) return { ok: false };
  if (approve) await anonymise(v, u, "person.deletion_approved");
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
  const ids = Array.isArray(userIds) ? userIds.filter(isUuid).slice(0, 5000) : [];
  if (!ids.length) return { count: 0 };
  const scope = await scopeDepartmentIds(v);
  const users = await db()
    .select({ id: t.users.id, departmentId: t.users.departmentId, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), inArray(t.users.id, ids), eq(t.users.status, "active")));
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
    count += await notifyUsers(db(), v.tenant.id, [u.id], "reminder", { module: pick(first.title, u.locale), dueDate: pending[0].due ?? undefined, link: `/learn/${first.slug}` }, { href: `/learn/${first.slug}` }, { defer: true });
  }
  refresh();
  return { count };
}

/** Case, spacing and the dotted capital İ (whose lower case carries a combining dot) do not count when matching CSV words. */
const fold = (s: string) => s.trim().toLowerCase().replace(/̇/g, "").replace(/\s+/g, " ");

/**
 * Role spellings the import accepts: the codes, a few English words, and the role names of every
 * interface language, which is what the people export writes (so an exported file imports again).
 */
const ROLE_NAMES: Record<Locale, Record<string, string>> = {
  az: azCommon.roles,
  en: enCommon.roles,
  ru: ruCommon.roles,
  tr: trCommon.roles,
  ro: roCommon.roles,
  ka: kaCommon.roles,
  uk: ukCommon.roles,
  de: deCommon.roles,
  fr: frCommon.roles,
  ar: arCommon.roles,
};
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
  ...Object.fromEntries(
    Object.values(ROLE_NAMES).flatMap((names) => ASSIGNABLE_ROLES.map((role) => [fold(names[role]), role] as const)),
  ),
};

/** Column names the import accepts besides the codes of the template: the obvious words in each interface language. */
const COLUMN_ALIASES: Record<string, string> = {
  "full name": "name",
  ad: "name",
  "ad soyad": "name",
  "ad, soyad": "name",
  имя: "name",
  фио: "name",
  "e-mail": "email",
  "e-poçt": "email",
  "эл. почта": "email",
  "электронная почта": "email",
  почта: "email",
  şöbə: "department",
  отдел: "department",
  "job title": "job_title",
  vəzifə: "job_title",
  должность: "job_title",
  rol: "role",
  роль: "role",
  "manager email": "manager_email",
  "rəhbərin e-poçtu": "manager_email",
  "почта руководителя": "manager_email",
  telefon: "phone",
  телефон: "phone",
  dil: "language",
  язык: "language",
};

/** Language spellings in the optional `language` column: the codes and each language's own name. */
const LANGUAGE_ALIASES: Record<string, Locale> = Object.fromEntries(LOCALES.flatMap((l) => [[l, l], [fold(LOCALE_NAMES[l]), l]] as const));

export type ImportPreview = { ok: boolean; rows: number; problems: { line: number; problem: string }[]; newDepartments: string[]; imported?: number; error?: string };

/** A unique index refused one row of a commit: the whole import rolls back and the row is reported like a preview problem. */
class ImportConflict extends Error {
  constructor(
    readonly line: number,
    readonly problem: "exists" | "phoneTaken" | "departmentTaken",
  ) {
    super(`import conflict on line ${line}: ${problem}`);
  }
}

/** Longest name, job title and department name an import keeps: the limit of the add and edit dialogs. */
const IMPORT_TEXT_MAX = 120;

/** CSV import in two steps: "check" validates everything, "commit" writes only a clean file. */
export async function importPeopleAction(csv: string, commit: boolean): Promise<ImportPreview> {
  const v = await actionViewer("people.write");
  // A check reports which of up to 5,000 addresses exist somewhere, so an administrator gets a bounded number of them
  // (the commit of a checked file is not another probe).
  if (!commit && !(await rateLimit(`people-import:${v.user.id}`, 20, 60 * 60_000)).ok) return { ok: false, rows: 0, problems: [], newDepartments: [], error: "rateLimited" };
  if (importTooBig(csv)) return { ok: false, rows: 0, problems: [], newDepartments: [], error: "tooBig" };
  const table = parseCsv(csv);
  if (table.length < 2) return { ok: false, rows: 0, problems: [{ line: 1, problem: "header" }], newDepartments: [] };
  const header = table[0].map((h) => {
    const name = fold(h);
    return COLUMN_ALIASES[name] ?? name;
  });
  const col = (name: string) => header.indexOf(name);
  if (col("name") < 0 || col("email") < 0) return { ok: false, rows: 0, problems: [{ line: 1, problem: "header" }], newDepartments: [] };
  if (table.length > 5001) return { ok: false, rows: 0, problems: [], newDepartments: [], error: "tooMany" };

  const cell = (r: string[], n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
  // The add and edit dialogs allow 120 characters for these; a longer cell is cut, so one row cannot put megabytes
  // into every people list, certificate and export.
  const short = (value: string) => value.slice(0, IMPORT_TEXT_MAX);
  const body = table.slice(1);
  // Only the file's own addresses and numbers are looked up (not every account on the platform).
  const [departments, existing, phones, foreign] = await Promise.all([
    db().select().from(t.departments).where(eq(t.departments.tenantId, v.tenant.id)),
    takenEmails(body.map((r) => cell(r, "email").toLowerCase())),
    takenPhones(body.map((r) => cleanPhone(cell(r, "phone")))),
    foreignVerifiedDomains(v.tenant.id),
  ]);
  // Matched by departmentKey() of the current names. The stored name_key is the key as it was computed when the
  // name was saved, so should departmentKey() ever fold more, two older names could match one spelling: such a
  // row is refused rather than put in either of them.
  const deptMatches = new Map<string, string[]>();
  for (const d of departments) {
    const key = departmentKey(d.name);
    deptMatches.set(key, [...(deptMatches.get(key) ?? []), d.id]);
  }
  const deptByName = new Map([...deptMatches].filter(([, ids]) => ids.length === 1).map(([key, [id]]) => [key, id]));
  const seen = new Set<string>();
  const problems: { line: number; problem: string }[] = [];
  // Keyed by departmentKey(); the first spelling in the file becomes the new department's name, and its line
  // is the one reported should someone add that department before the import is committed.
  const newDepartments = new Map<string, { name: string; line: number }>();
  const newDepartmentNames = () => [...newDepartments.values()].map((d) => d.name);
  const rows: { line: number; name: string; email: string; department: string; jobTitle: string; role: Role; manager: string; phone: string; locale: string }[] = [];
  body.forEach((r, i) => {
    const line = i + 2;
    const get = (n: string) => cell(r, n);
    const name = short(get("name"));
    const email = get("email").toLowerCase();
    const roleRaw = fold(get("role"));
    // Optional: a language the organisation has switched on; empty means the organisation's default.
    const languageRaw = get("language");
    const language = languageRaw ? LANGUAGE_ALIASES[fold(languageRaw)] : undefined;
    if (languageRaw && (!language || !v.tenant.settings.locales.includes(language))) problems.push({ line, problem: "language" });
    const department = short(get("department"));
    if (!name) problems.push({ line, problem: "name" });
    if (!z.email().max(254).safeParse(email).success) problems.push({ line, problem: "email" });
    else if (seen.has(email)) problems.push({ line, problem: "duplicate" });
    // Another organisation's proven domain answers the same whether or not the address exists.
    else if (foreign.has(emailDomain(email) ?? "")) problems.push({ line, problem: "foreignDomain" });
    else if (existing.has(email)) problems.push({ line, problem: takenBy(existing.get(email)!, v, "exists") });
    seen.add(email);
    // Own keys only: "constructor" or "__proto__" in the file must not match what every object inherits.
    const role = roleRaw ? (Object.hasOwn(ROLE_ALIASES, roleRaw) ? ROLE_ALIASES[roleRaw] : undefined) : "learner";
    if (!role) problems.push({ line, problem: "role" });
    // Optional, but a number that is given must be usable for phone sign-in and SMS: +994501234567.
    const phone = cleanPhone(get("phone"));
    if (phone && !PHONE_PATTERN.test(phone)) problems.push({ line, problem: "phone" });
    else if (phone) {
      if (phones.has(phone)) problems.push({ line, problem: takenBy(phones.get(phone)!, v, "phoneTaken") });
      phones.set(phone, v.tenant.id);
    }
    const key = departmentKey(department);
    if (department && (deptMatches.get(key)?.length ?? 0) > 1) problems.push({ line, problem: "departmentAmbiguous" });
    else if (department && !deptByName.has(key) && !newDepartments.has(key)) newDepartments.set(key, { name: department, line });
    rows.push({ line, name, email, department, jobTitle: short(get("job_title")), role: role ?? "learner", manager: get("manager_email").toLowerCase().slice(0, 254), phone, locale: language ?? v.tenant.settings.defaultLocale });
  });
  if (!commit || problems.length) return { ok: problems.length === 0, rows: rows.length, problems: problems.slice(0, 200), newDepartments: newDepartmentNames() };

  // All or nothing: a file lands completely or not at all, so a conflict halfway (someone added one of
  // these addresses meanwhile) leaves no partial import and no orphan departments behind.
  let created: { id: string }[];
  try {
    created = await db().transaction(async (tx) => {
      for (const [key, { name, line }] of newDepartments) {
        let d: { id: string };
        try {
          [d] = await tx.insert(t.departments).values({ tenantId: v.tenant.id, name, nameKey: key }).returning({ id: t.departments.id });
        } catch (error) {
          // Someone added this department since the check (by hand or by another import); the unique index decides.
          if (isUniqueViolation(error, "departments_tenant_name_key_idx")) throw new ImportConflict(line, "departmentTaken");
          throw error;
        }
        deptByName.set(key, d.id);
        await audit(tx, { tenantId: v.tenant.id, actorId: v.user.id, action: "department.created", targetType: "department", targetId: d.id, meta: { name, via: "import" } });
      }
      const inserted: { id: string; manager: string }[] = [];
      for (const r of rows) {
        let u: { id: string };
        try {
          [u] = await tx
            .insert(t.users)
            .values({
              tenantId: v.tenant.id,
              name: r.name,
              email: r.email,
              role: r.role === "tenant_admin" && v.user.role !== "tenant_admin" ? "learner" : r.role,
              status: "invited",
              departmentId: r.department ? deptByName.get(departmentKey(r.department)) ?? null : null,
              jobTitle: r.jobTitle || null,
              phone: r.phone || null,
              locale: r.locale,
            })
            .returning({ id: t.users.id });
        } catch (error) {
          // The checks above can race with a concurrent add or import; the unique indexes decide.
          if (isUniqueViolation(error, "users_email_idx")) throw new ImportConflict(r.line, "exists");
          if (isUniqueViolation(error, "users_phone_active_idx")) throw new ImportConflict(r.line, "phoneTaken");
          throw error;
        }
        inserted.push({ id: u.id, manager: r.manager });
      }
      const all = await tx.select({ id: t.users.id, email: t.users.email }).from(t.users).where(eq(t.users.tenantId, v.tenant.id));
      const byEmail = new Map(all.map((u) => [u.email, u.id]));
      for (const c of inserted) {
        const mid = c.manager ? byEmail.get(c.manager) : undefined;
        if (mid) await tx.update(t.users).set({ managerId: mid }).where(eq(t.users.id, c.id));
      }
      return inserted;
    });
  } catch (error) {
    if (error instanceof ImportConflict) return { ok: false, rows: rows.length, problems: [{ line: error.line, problem: error.problem }], newDepartments: newDepartmentNames() };
    throw error;
  }
  // Same promise as Add person: everyone imported gets their invitation once sending is on.
  let emailed = 0;
  if (v.tenant.settings.email.enabled) for (const c of created) emailed += await emailInvite(v.tenant.id, c.id, true);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.imported", ip: await clientIp(), meta: { count: created.length, emailed } });
  refresh();
  return { ok: true, rows: rows.length, problems: [], newDepartments: newDepartmentNames(), imported: created.length };
}
