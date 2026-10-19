"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "../db";
import { hashPassword, passwordProblem, verifyPassword } from "../auth/password";
import { clearSessionCookie, createSession, invalidateSession, invalidateUserSessions, readSessionToken, sessionIdFromToken, setSessionCookie } from "../auth/session";
import { getSession } from "../auth/viewer";
import { hashBackupCode, verifyTotp } from "../auth/totp";
import { isPrivileged } from "../auth/permissions";
import { decideSignInStep, emailDomain, type SignInStep } from "../auth/sso-routing";
import { featuresFor } from "../../lib/tenant-defaults";
import { audit } from "../services/audit";
import { clientIp, userAgent } from "../request";
import { sha256Hex } from "../crypto";
import { sendSms, smsAvailable } from "../sms";
import { queueEmail } from "../mail";
import { LOCALE_COOKIE, isLocale } from "../../i18n/config";
import { randomToken } from "../services/progress";
import { env } from "../env";
import { issueAccountLink } from "../auth/links";

export type AuthState = { error?: string; step?: string; email?: string; phone?: string; devCode?: string; done?: boolean; ssoUrl?: string } | undefined;

const LOCK_WINDOW_MS = 15 * 60_000;
const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_FAILS_PER_IP = 30;
let dummyHash: Promise<string> | null = null;
/** A real hash of a random string so unknown accounts take as long to check as real ones. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomToken(16));
  return dummyHash;
}

/** Only same-site relative paths, never "//evil" or "https://…". */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && !v.startsWith("/sign-in") ? v : "/";
}

async function failures(key: string): Promise<number> {
  const [{ n }] = await db()
    .select({ n: count() })
    .from(t.loginAttempts)
    .where(and(eq(t.loginAttempts.key, key), eq(t.loginAttempts.success, false), gt(t.loginAttempts.at, new Date(Date.now() - LOCK_WINDOW_MS))));
  return Number(n);
}

async function recordAttempt(keys: string[], success: boolean) {
  if (!keys.length) return;
  await db().insert(t.loginAttempts).values(keys.map((key) => ({ key, success })));
}

async function startSession(user: { id: string; tenantId: string; locale: string; totpEnabled: boolean }, verified: boolean) {
  const [tenant] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, user.tenantId));
  const { token, expiresAt } = await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    twoFactorVerified: verified || !user.totpEnabled,
    ip: await clientIp(),
    userAgent: await userAgent(),
    maxDevices: tenant?.settings.identity.maxDevices ?? null,
  });
  await setSessionCookie(token, expiresAt);
  if (isLocale(user.locale)) (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
}

const emailSchema = z.email().max(254);

/**
 * A proven domain with single sign-on on sends its people to the organisation's provider.
 * Everywhere else the answer is the password step, whether or not the account exists.
 */
async function signInStepFor(email: string): Promise<SignInStep> {
  const domain = emailDomain(email);
  if (!domain) return { step: "password" };
  const [tenant] = await db()
    .select({ id: t.tenants.id, slug: t.tenants.slug, plan: t.tenants.plan, features: t.tenants.features, settings: t.tenants.settings, domain: t.tenants.domain, domainVerifiedAt: t.tenants.domainVerifiedAt })
    .from(t.tenants)
    .where(and(eq(t.tenants.domain, domain), isNotNull(t.tenants.domainVerifiedAt)))
    .limit(1);
  if (!tenant) return { step: "password" };
  const [person] = await db().select({ tenantId: t.users.tenantId, role: t.users.role, status: t.users.status }).from(t.users).where(eq(t.users.email, email));
  const sso = tenant.settings.identity.sso;
  return decideSignInStep(
    email,
    {
      id: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      domainVerifiedAt: tenant.domainVerifiedAt,
      ssoEnabled: tenant.settings.identity.ssoEnabled,
      ssoFeature: featuresFor(tenant.plan, tenant.features).has("sso"),
      ssoReady: sso?.protocol === "oidc" && !!sso.issuer && !!sso.clientId,
      autoCreate: sso?.autoCreate ?? false,
    },
    person ?? null,
  );
}

export async function checkEmailAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "emailRequired" };
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid", email };
  const next = await signInStepFor(email);
  return next.step === "sso" ? { step: "sso", email, ssoUrl: next.url } : { step: "password", email };
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid", step: "email" };
  if (!password) return { error: "passwordRequired", step: "password", email };

  const ip = await clientIp();
  const accountKey = `email:${email}`;
  const ipKey = ip ? `ip:${ip}` : null;
  if ((await failures(accountKey)) >= MAX_FAILS_PER_ACCOUNT || (ipKey && (await failures(ipKey)) >= MAX_FAILS_PER_IP)) {
    return { error: "locked", step: "password", email };
  }

  const [user] = await db().select().from(t.users).where(eq(t.users.email, email));
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !ok || user.status !== "active") {
    await recordAttempt([accountKey, ...(ipKey ? [ipKey] : [])], false);
    if (user) await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in_refused", ip, meta: { reason: !ok ? "password" : user.status } });
    return { error: user && ok ? "blocked" : "invalidCredentials", step: "password", email };
  }
  await recordAttempt([accountKey], true);
  await startSession(user, false);
  await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "password" } });
  if (user.totpEnabled) redirect(`/sign-in/verify?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function verifySecondFactorAction(_: AuthState, form: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const mode = form.get("mode") === "backup" ? "backup" : "totp";
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(form.get("next"));
  if (!code) return { error: mode === "backup" ? "backupCodeRequired" : "codeRequired", step: mode };

  const key = `2fa:${session.user.id}`;
  if ((await failures(key)) >= MAX_FAILS_PER_ACCOUNT) return { error: "locked", step: mode };
  const [user] = await db().select({ totpSecret: t.users.totpSecret, totpRecovery: t.users.totpRecovery }).from(t.users).where(eq(t.users.id, session.user.id));

  let ok = false;
  if (mode === "totp") ok = verifyTotp(user.totpSecret, code);
  else {
    const h = hashBackupCode(code);
    const remaining = user.totpRecovery ?? [];
    if (remaining.includes(h)) {
      ok = true;
      await db().update(t.users).set({ totpRecovery: remaining.filter((x) => x !== h) }).where(eq(t.users.id, session.user.id));
    }
  }
  if (!ok) {
    await recordAttempt([key], false);
    return { error: mode === "backup" ? "invalidBackupCode" : "invalidCode", step: mode };
  }
  await db().update(t.sessions).set({ twoFactorVerified: true }).where(eq(t.sessions.id, session.sessionId));
  redirect(next);
}

function normalisePhone(raw: string): string | null {
  const p = raw.replace(/[\s().-]/g, "");
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

export async function requestPhoneCodeAction(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "phoneInvalid", step: "phone" };
  if (!smsAvailable()) return { error: "smsUnavailable", step: "phone" };
  const ip = await clientIp();
  const key = `phone:${phone}`;
  if ((await failures(key)) >= MAX_FAILS_PER_ACCOUNT) return { error: "locked", step: "phone" };
  // Throttle code requests per number.
  await recordAttempt([`phone-send:${phone}`], true);
  const [{ n: sent }] = await db()
    .select({ n: count() })
    .from(t.loginAttempts)
    .where(and(eq(t.loginAttempts.key, `phone-send:${phone}`), gt(t.loginAttempts.at, new Date(Date.now() - LOCK_WINDOW_MS))));
  if (Number(sent) > 5) return { error: "rateLimited", step: "phone" };

  const [user] = await db().select().from(t.users).where(and(eq(t.users.phone, phone), eq(t.users.status, "active")));
  if (user && isPrivileged(user.role)) return { error: "privilegedPhone", step: "phone" };
  let devCode: string | undefined;
  if (user) {
    const digits = new Uint32Array(1);
    crypto.getRandomValues(digits);
    const code = String(digits[0] % 1_000_000).padStart(6, "0");
    await db().delete(t.authTokens).where(and(eq(t.authTokens.userId, user.id), eq(t.authTokens.kind, "phone_otp")));
    await db().insert(t.authTokens).values({ id: sha256Hex(`otp:${user.id}:${code}`), userId: user.id, kind: "phone_otp", expiresAt: new Date(Date.now() + 5 * 60_000) });
    const res = await sendSms(phone, `Cyclowareness: ${code}`);
    if (!res.ok) return { error: "smsUnavailable", step: "phone" };
    if (env.showOtp) devCode = code;
    await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "phone", stage: "code_sent" } });
  }
  return { step: "code", phone, devCode };
}

export async function verifyPhoneCodeAction(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(form.get("next"));
  if (!phone) return { error: "phoneInvalid", step: "phone" };
  if (!/^\d{6}$/.test(code)) return { error: "codeRequired", step: "code", phone };
  const key = `phone:${phone}`;
  if ((await failures(key)) >= MAX_FAILS_PER_ACCOUNT) return { error: "locked", step: "code", phone };

  const [user] = await db().select().from(t.users).where(and(eq(t.users.phone, phone), eq(t.users.status, "active")));
  const [token] = user
    ? await db()
        .select()
        .from(t.authTokens)
        .where(and(eq(t.authTokens.userId, user.id), eq(t.authTokens.kind, "phone_otp"), isNull(t.authTokens.usedAt)))
        .orderBy(desc(t.authTokens.createdAt))
        .limit(1)
    : [];
  if (!user || !token) {
    await recordAttempt([key], false);
    return { error: "invalidCode", step: "code", phone };
  }
  if (token.expiresAt < new Date() || token.attempts >= 5) return { error: "phoneCodeExpired", step: "code", phone };
  if (token.id !== sha256Hex(`otp:${user.id}:${code}`)) {
    await db().update(t.authTokens).set({ attempts: token.attempts + 1 }).where(eq(t.authTokens.id, token.id));
    await recordAttempt([key], false);
    return { error: "invalidCode", step: "code", phone };
  }
  await db().update(t.authTokens).set({ usedAt: new Date() }).where(eq(t.authTokens.id, token.id));
  await startSession(user, true);
  await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip: await clientIp(), meta: { method: "phone" } });
  redirect(next);
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "emailRequired" };
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid" };
  await recordAttempt([`forgot:${email}`], true);
  const [{ n }] = await db()
    .select({ n: count() })
    .from(t.loginAttempts)
    .where(and(eq(t.loginAttempts.key, `forgot:${email}`), gt(t.loginAttempts.at, new Date(Date.now() - 60 * 60_000))));
  if (Number(n) > 3) return { done: true };
  const [user] = await db().select().from(t.users).where(and(eq(t.users.email, email), eq(t.users.status, "active")));
  if (user) {
    const link = await issueAccountLink(user.id, "reset");
    await queueEmail(db(), user.tenantId, {
      to: user.email,
      kind: "password_reset",
      subject: user.locale === "en" ? "Reset your password" : user.locale === "ru" ? "Восстановление пароля" : "Parolun bərpası",
      text: `${user.name},\n\n${user.locale === "en" ? "Use this link to set a new password. It works for one hour." : user.locale === "ru" ? "Перейдите по ссылке, чтобы задать новый пароль. Ссылка действует один час." : "Yeni parol təyin etmək üçün linkə keçin. Link bir saat işləyir."}\n\n${link}`,
    });
    await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.password_reset_requested", ip: await clientIp() });
  }
  return { done: true };
}

export async function setPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const token = String(form.get("token") ?? "");
  const kind = form.get("kind") === "invite" ? "invite" : "reset";
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const [row] = await db()
    .select({ token: t.authTokens, user: t.users })
    .from(t.authTokens)
    .innerJoin(t.users, eq(t.users.id, t.authTokens.userId))
    .where(and(eq(t.authTokens.id, sha256Hex(token)), eq(t.authTokens.kind, kind)));
  if (!row || row.token.usedAt || row.token.expiresAt < new Date()) return { error: "expired" };
  if (!password) return { error: "required" };
  if (password !== confirm) return { error: "mismatch" };
  if (password.toLowerCase() === row.user.email) return { error: "sameAsEmail" };
  const problem = passwordProblem(password, [row.user.email, row.user.name]);
  if (problem) return { error: problem === "short" ? "tooShort" : problem === "long" ? "tooLong" : "weak" };

  await db()
    .update(t.users)
    .set({ passwordHash: await hashPassword(password), ...(row.user.status === "invited" ? { status: "active" as const } : {}) })
    .where(eq(t.users.id, row.user.id));
  await db().update(t.authTokens).set({ usedAt: new Date() }).where(eq(t.authTokens.id, row.token.id));
  // Several invite links may be out there (emailed, copied, CSV); the account activates once.
  await db().delete(t.authTokens).where(and(eq(t.authTokens.userId, row.user.id), eq(t.authTokens.kind, "invite"), ne(t.authTokens.id, row.token.id)));
  await invalidateUserSessions(row.user.id);
  await audit(db(), { tenantId: row.user.tenantId, actorId: row.user.id, action: "auth.password_set", ip: await clientIp(), meta: { kind } });
  return { done: true };
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    const id = sessionIdFromToken(token);
    const session = await getSession();
    await invalidateSession(id);
    if (session) await audit(db(), { tenantId: session.tenant.id, actorId: session.user.id, action: "auth.sign_out", ip: await clientIp() });
  }
  await clearSessionCookie();
  redirect("/sign-in");
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  const session = await getSession();
  if (session) await db().update(t.users).set({ locale }).where(eq(t.users.id, session.user.id));
}
