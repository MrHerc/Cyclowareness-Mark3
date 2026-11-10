"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { refresh } from "next/cache";
import QRCode from "qrcode";
import { db, t } from "../db";
import { actionViewer, getSession } from "../auth/viewer";
import { hashPassword, passwordProblem } from "../auth/password";
import { verifyUserPassword } from "../auth/step-up";
import { newBackupCodes, newTotpKey, totpUri, verifyTotpOnce } from "../auth/totp";
import { invalidateUserSessions } from "../auth/session";
import { twoFactorRequired } from "../auth/permissions";
import { audit } from "../services/audit";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";
import type { ActionResult } from "@/lib/action-result";

async function checkPassword(userId: string, password: string): Promise<boolean> {
  if (!(await rateLimit(`pw-confirm:${userId}`, 10, 15 * 60_000)).ok) return false;
  return verifyUserPassword(userId, password);
}

/** Step 1 of 2FA setup: confirm the password, create a key and show it as a QR code. */
export async function startTotpAction(password: string): Promise<ActionResult<{ qrSvg: string; secret: string; uri: string }>> {
  const v = await actionViewer();
  if (v.user.totpEnabled) return { ok: false, error: "alreadyOn" };
  if (!(await checkPassword(v.user.id, password))) return { ok: false, error: "wrongPassword" };
  const key = newTotpKey();
  // Stored but inactive until the first code is verified.
  await db().update(t.users).set({ totpSecret: key.encrypted, totpEnabled: false }).where(eq(t.users.id, v.user.id));
  const uri = totpUri(v.tenant.name.slice(0, 40) || "Cyclowareness", v.user.email, key.base32);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 208, color: { dark: "#16123a", light: "#ffffff" } });
  return { ok: true, qrSvg, secret: key.base32.replace(/(.{4})/g, "$1 ").trim(), uri };
}

/** Step 2: the first code turns it on and returns the one-time backup codes. */
export async function confirmTotpAction(code: string): Promise<ActionResult<{ codes: string[] }>> {
  const v = await actionViewer();
  const [u] = await db().select({ secret: t.users.totpSecret, enabled: t.users.totpEnabled }).from(t.users).where(eq(t.users.id, v.user.id));
  if (!u?.secret || u.enabled) return { ok: false, error: "generic" };
  if (!(await verifyTotpOnce(v.user.id, u.secret, code.replace(/\s/g, "")))) return { ok: false, error: "wrongCode" };
  const backup = newBackupCodes();
  await db().update(t.users).set({ totpEnabled: true, totpRecovery: backup.hashes }).where(eq(t.users.id, v.user.id));
  // The current session already proved the second factor; every other one (perhaps someone else's) has to sign in again.
  await db().update(t.sessions).set({ twoFactorVerified: true }).where(eq(t.sessions.id, v.sessionId));
  await invalidateUserSessions(v.user.id, v.sessionId, null);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.2fa_on", ip: await clientIp() });
  return { ok: true, codes: backup.codes };
}

/** Profile → Security: a signed-in person replaces their password (the same rules as setting it from a link). */
export async function changePasswordAction(current: string, next: string, confirm: string): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer();
  if (!(await checkPassword(v.user.id, current))) return { ok: false, error: "wrongPassword" };
  if (!next) return { ok: false, error: "required" };
  if (next !== confirm) return { ok: false, error: "mismatch" };
  if (next.toLowerCase() === v.user.email) return { ok: false, error: "sameAsEmail" };
  const problem = passwordProblem(next, [v.user.email, v.user.name]);
  if (problem) return { ok: false, error: problem === "short" ? "tooShort" : problem === "long" ? "tooLong" : "weak" };
  await db().update(t.users).set({ passwordHash: await hashPassword(next) }).where(eq(t.users.id, v.user.id));
  // Whoever knew the old password is signed out everywhere else.
  await invalidateUserSessions(v.user.id, v.sessionId, "password_change");
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.password_set", ip: await clientIp(), meta: { kind: "change" } });
  return { ok: true };
}

export async function disableTotpAction(password: string): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer();
  if (twoFactorRequired(v.user.role, v.tenant.settings.identity.requireAdmin2fa)) return { ok: false, error: "required" };
  if (!(await checkPassword(v.user.id, password))) return { ok: false, error: "wrongPassword" };
  await db().update(t.users).set({ totpEnabled: false, totpSecret: null, totpRecovery: null }).where(eq(t.users.id, v.user.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.2fa_off", ip: await clientIp() });
  refresh();
  return { ok: true };
}

export async function regenerateBackupCodesAction(password: string): Promise<ActionResult<{ codes: string[] }>> {
  const v = await actionViewer();
  if (!v.user.totpEnabled) return { ok: false, error: "generic" };
  if (!(await checkPassword(v.user.id, password))) return { ok: false, error: "wrongPassword" };
  const backup = newBackupCodes();
  await db().update(t.users).set({ totpRecovery: backup.hashes }).where(eq(t.users.id, v.user.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.backup_codes" });
  return { ok: true, codes: backup.codes };
}

export async function signOutOtherDevicesAction(): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  await invalidateUserSessions(v.user.id, v.sessionId, "other_devices_signed_out");
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "auth.other_devices_signed_out", ip: await clientIp() });
  return { ok: true };
}

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** The browser crops and resizes the photo to 256 px before sending it. */
export async function setAvatarAction(dataUrl: string | null): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  if (dataUrl !== null && (!DATA_URL.test(dataUrl) || dataUrl.length > 300_000)) return { ok: false };
  await db().update(t.users).set({ avatarUrl: dataUrl }).where(eq(t.users.id, v.user.id));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.changed", targetType: "user", targetId: v.user.id, meta: { field: "photo" } });
  refresh();
  return { ok: true };
}

export async function requestDeletionAction(): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  // Each request notifies every administrator: a few per hour, and a pending request is not made again.
  if (!(await rateLimit(`deletion-request:${v.user.id}`, 5, 60 * 60_000)).ok) return { ok: false };
  const [requested] = await db()
    .update(t.users)
    .set({ deletionRequestedAt: new Date() })
    .where(and(eq(t.users.id, v.user.id), isNull(t.users.deletionRequestedAt)))
    .returning({ id: t.users.id });
  if (!requested) return { ok: true };
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.deletion_requested", targetType: "user", targetId: v.user.id });
  const admins = await db()
    .select({ id: t.users.id, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.role, "tenant_admin"), eq(t.users.status, "active")));
  if (admins.length) {
    // Each administrator reads it in their own interface language.
    const body = new Map<string, string>();
    for (const locale of new Set(admins.map((a) => a.locale))) body.set(locale, (await getTranslations({ locale, namespace: "admin.person" }))("deletionRequestedBody"));
    await db().insert(t.notifications).values(admins.map((a) => ({ tenantId: v.tenant.id, userId: a.id, kind: "deletion", title: v.user.name, body: body.get(a.locale), href: `/admin/users/${v.user.id}` })));
  }
  refresh();
  return { ok: true };
}

export async function cancelDeletionAction(): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  await db().update(t.users).set({ deletionRequestedAt: null }).where(eq(t.users.id, v.user.id));
  refresh();
  return { ok: true };
}

export async function resetTourAction(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await db().update(t.users).set({ tourDone: false }).where(eq(t.users.id, session.user.id));
  // The learner layout mounts the tour from `tourDone`, so it must re-render before the next visit to Home.
  refresh();
  return { ok: true };
}

/** Finishing or skipping the onboarding tour on Home. */
export async function markTourDoneAction(): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  await db().update(t.users).set({ tourDone: true }).where(eq(t.users.id, v.user.id));
  // Unmounts the tour from the layout, so "Show the tour again" later mounts a fresh one.
  refresh();
  return { ok: true };
}
