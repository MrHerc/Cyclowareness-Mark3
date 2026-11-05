"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { safePath } from "../../lib/safe-path";
import { cleanPhone, PHONE_PATTERN } from "../../lib/phone";
import { db, t } from "../db";
import { logFailure } from "../db/errors";
import { log } from "../log";
import type { Role } from "../db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "../auth/password";
import { clearSessionCookie, createSession, invalidateSession, invalidateUserSessions, readSessionToken, sessionIdFromToken, setSessionCookie } from "../auth/session";
import { getSession } from "../auth/viewer";
import { hashBackupCode, legacyBackupHash, verifyTotpOnce } from "../auth/totp";
import { isConsoleRole } from "../auth/permissions";
import { decideSignInStep, emailDomain, type SignInStep } from "../auth/sso-routing";
import { featuresFor, withDefaults } from "../../lib/tenant-defaults";
import { audit } from "../services/audit";
import { clientIp, ipRateKey, userAgent } from "../request";
import { rateLimit } from "../rate-limit";
import { sha256Hex } from "../crypto";
import { sendSms, smsAvailable } from "../sms";
import { queueEmail, renderEmailHtml } from "../mail";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "../../i18n/config";
import { randomToken } from "../services/progress";
import { env } from "../env";
import { issueAccountLink } from "../auth/links";

export type AuthState = { error?: string; step?: string; email?: string; phone?: string; devCode?: string; done?: boolean; ssoUrl?: string } | undefined;

const LOCK_WINDOW_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;
/** Failed guesses per account (email or phone) and client address in LOCK_WINDOW_MS. */
const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_FAILS_PER_IP = 30;
/** Failures on one account within the hour, from anywhere, after which a client that already failed on it gets no more tries. */
const ACCOUNT_CEILING = 50;
/** A one-time phone code takes this many guesses in all; then it is spent. */
const MAX_CODE_GUESSES = 5;
/** Email steps per client address in LOCK_WINDOW_MS: generous, since a whole office can share one address. */
const CHECK_EMAIL_PER_CLIENT = 300;
/** Reset mails per organisation and hour. */
const RESET_MAILS_PER_TENANT_HOUR = 1000;
let dummyHash: Promise<string> | null = null;
/** A real hash of a random string so unknown accounts take as long to check as real ones. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomToken(16));
  return dummyHash;
}

/**
 * Runs a form action so that a thrown failure (database or SMS provider unavailable) leaves the visitor on the form with what
 * they typed and the translated "try again" message (`generic`), instead of the error boundary replacing the page.
 * redirect() and the other control-flow errors of Next.js still go through.
 */
async function orFailed(run: () => Promise<AuthState>, failed: NonNullable<AuthState>): Promise<AuthState> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    logFailure("[auth] action failed", error);
    return { ...failed, error: "generic" };
  }
}

const typed = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/**
 * The audit entry of a step that has already taken effect (a session cookie set, a code sent, a password changed). A failed
 * write is logged instead of thrown: orFailed would otherwise report the completed step as failed.
 */
async function auditDone(entry: Parameters<typeof audit>[1]): Promise<void> {
  try {
    await audit(db(), entry);
  } catch (error) {
    logFailure("[auth] audit write failed", error);
  }
}

/** Work done after the answer is sent, so its duration (a lookup, a mail, an SMS) tells nothing about the account. */
function afterAnswer(what: string, work: () => Promise<unknown>): void {
  after(() => work().catch((error: unknown) => logFailure(what, error)));
}

/** Only same-site relative paths (see lib/safe-path.ts for what is refused). */
function safeNext(value: FormDataEntryValue | null): string {
  return safePath(value);
}

async function failures(key: string, windowMs = LOCK_WINDOW_MS): Promise<number> {
  const [{ n }] = await db()
    .select({ n: count() })
    .from(t.loginAttempts)
    .where(and(eq(t.loginAttempts.key, key), eq(t.loginAttempts.success, false), gt(t.loginAttempts.at, new Date(Date.now() - windowMs))));
  return Number(n);
}

/**
 * Without TRUST_PROXY the client address is unknown and the per-address lockout cannot work. Instead of
 * a shared lock (which anyone could trip to lock every user out), a burst of failed sign-ins across all
 * accounts slows down further failures; a correct password is never refused or delayed by it.
 */
const ANONYMOUS_SLOWDOWN_AFTER = 300;
const ANONYMOUS_SLOWDOWN_MS = 2_000;
const anonymousFailureTimes: number[] = [];
function recordAnonymousFailure(): number {
  const since = Date.now() - LOCK_WINDOW_MS;
  while (anonymousFailureTimes.length && anonymousFailureTimes[0] < since) anonymousFailureTimes.shift();
  if (anonymousFailureTimes.length < 10_000) anonymousFailureTimes.push(Date.now());
  return anonymousFailureTimes.length;
}

/**
 * Claims one guess before the credential is checked: a failure row per key is written first and the window counted after,
 * so of any burst of parallel requests only the first `max` fit (each count includes every row committed before its own).
 * A key with max null is only recorded. A refused claim takes its rows back, so refused requests do not extend a lock;
 * passed() turns a claim into a success.
 */
async function claim(limits: [key: string, max: number | null][]): Promise<string[] | null> {
  const rows = await db()
    .insert(t.loginAttempts)
    .values(limits.map(([key]) => ({ key, success: false })))
    .returning({ id: t.loginAttempts.id });
  const ids = rows.map((r) => r.id);
  for (const [key, max] of limits) {
    if (max === null || (await failures(key)) <= max) continue;
    await db().delete(t.loginAttempts).where(inArray(t.loginAttempts.id, ids));
    return null;
  }
  return ids;
}

async function passed(claimed: string[]): Promise<void> {
  await db().update(t.loginAttempts).set({ success: true }).where(inArray(t.loginAttempts.id, claimed));
}

/**
 * The lock key of one client on one account. Grouped like the other per-client limits (an IPv6 client by its /64), so
 * rotating addresses within one network does not reset the lock; the audit log keeps the full address.
 */
const clientKey = (account: string, ip: string | null) => (ip ? `${account}|ip:${ipRateKey(ip)}` : account);

/**
 * Claims a guess at an account (`email:…` or `phone:…`): five failures per account and client address and thirty per address
 * across accounts in 15 minutes. Once the account has ACCOUNT_CEILING failures within the hour from anywhere, an address that
 * already failed on it is held there, while one that has not failed still gets its try, so nobody can lock the owner out from
 * elsewhere. Without TRUST_PROXY every client looks the same, and five failures lock the account as before.
 */
async function claimGuess(account: string, ip: string | null): Promise<string[] | null> {
  if (!ip) return claim([[account, MAX_FAILS_PER_ACCOUNT]]);
  const crowded = (await failures(account, HOUR_MS)) >= ACCOUNT_CEILING;
  return claim([
    [clientKey(account, ip), crowded ? 1 : MAX_FAILS_PER_ACCOUNT],
    [`ip:${ipRateKey(ip)}`, MAX_FAILS_PER_IP],
    [account, null],
  ]);
}

type SendLimits = { key: string; perClient: number; ceiling: number; perAddress: number; windowMs: number };
/** Sign-in codes: five per number and client in 15 minutes, twenty per client across numbers. */
const SMS_SENDS: SendLimits = { key: "sms", perClient: 5, ceiling: 10, perAddress: 20, windowMs: LOCK_WINDOW_MS };
/** Password reset mails: three per address and client in an hour, ten per client across addresses. */
const RESET_MAILS: SendLimits = { key: "reset", perClient: 3, ceiling: 10, perAddress: 10, windowMs: HOUR_MS };

/**
 * Throttles codes and links sent to one recipient (a number or an address). Each client gets `perClient` in the window and
 * `perAddress` across recipients. Once the recipient has had `ceiling` requests from anyone, a client gets one at most, so
 * other people can neither flood the recipient nor stop the owner's own first request. Without TRUST_PROXY all clients are
 * one and the recipient gets `perClient`, as before.
 */
async function sendAllowed(recipient: string, ip: string | null, l: SendLimits): Promise<boolean> {
  if (!ip) return (await rateLimit(`${l.key}:${recipient}`, l.perClient, l.windowMs)).ok;
  const client = ipRateKey(ip);
  const all = await rateLimit(`${l.key}:${recipient}`, l.ceiling, l.windowMs);
  const own = await rateLimit(`${l.key}:${recipient}|ip:${client}`, all.ok ? l.perClient : 1, l.windowMs);
  const spread = await rateLimit(`${l.key}-ip:${client}`, l.perAddress, l.windowMs);
  return own.ok && spread.ok;
}

/** The one active account with this number; none when the number is shared (sign-in by phone is then refused). */
async function userByPhone(phone: string) {
  const rows = await db().select().from(t.users).where(and(eq(t.users.phone, phone), eq(t.users.status, "active"))).limit(2);
  return rows.length === 1 ? rows[0] : undefined;
}

async function startSession(user: { id: string; tenantId: string; locale: string; totpEnabled: boolean }, verified: boolean) {
  const [tenant] = await db().select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, user.tenantId));
  const { token, expiresAt } = await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    twoFactorVerified: verified || !user.totpEnabled,
    ip: await clientIp(),
    userAgent: await userAgent(),
    maxDevices: tenant ? withDefaults(tenant.settings).identity.maxDevices : null,
  });
  await setSessionCookie(token, expiresAt);
  if (isLocale(user.locale)) (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
}

const emailSchema = z.email().max(254);

/**
 * A proven domain with single sign-on on sends its people to the organisation's provider.
 * Everywhere else the answer is the password step, whether or not the account exists.
 * `anyAddress`: the step for the domain alone, the same for every address on it (the email step must not tell who is an administrator).
 */
async function signInStepFor(email: string, anyAddress = false): Promise<SignInStep> {
  const domain = emailDomain(email);
  if (!domain) return { step: "password" };
  const [tenant] = await db()
    .select({ id: t.tenants.id, slug: t.tenants.slug, plan: t.tenants.plan, features: t.tenants.features, settings: t.tenants.settings, domain: t.tenants.domain, domainVerifiedAt: t.tenants.domainVerifiedAt })
    .from(t.tenants)
    .where(and(eq(t.tenants.domain, domain), isNotNull(t.tenants.domainVerifiedAt)))
    .limit(1);
  if (!tenant) return { step: "password" };
  const [person] = anyAddress ? [] : await db().select({ tenantId: t.users.tenantId, role: t.users.role }).from(t.users).where(eq(t.users.email, email));
  const identity = withDefaults(tenant.settings).identity;
  const sso = identity.sso;
  return decideSignInStep(
    email,
    {
      id: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      domainVerifiedAt: tenant.domainVerifiedAt,
      ssoEnabled: identity.ssoEnabled,
      ssoFeature: featuresFor(tenant.plan, tenant.features).has("sso"),
      ssoReady: sso?.protocol === "oidc" && !!sso.issuer && !!sso.clientId,
      autoCreate: sso?.autoCreate ?? false,
    },
    person ?? null,
  );
}

/** People whose organisation signs them in through its provider (their proven domain, single sign-on on). */
async function signsInWithSso(email: string): Promise<boolean> {
  return (await signInStepFor(email)).step === "sso";
}

export async function checkEmailAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => checkEmail(prev, form), { email: typed(form, "email") });
}

async function checkEmail(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "emailRequired" };
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid", email };
  // Each step reads the database, so long lists of addresses are slowed down per client.
  const ip = await clientIp();
  if (ip && !(await rateLimit(`check-email:${ipRateKey(ip)}`, CHECK_EMAIL_PER_CLIENT, LOCK_WINDOW_MS)).ok) return { error: "rateLimited", email };
  // Every address on a single sign-on domain gets the provider's screen; administrators choose their password there.
  const next = await signInStepFor(email, true);
  return next.step === "sso" ? { step: "sso", email, ssoUrl: next.url } : { step: "password", email };
}

export async function signInAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => signIn(prev, form), { step: "password", email: typed(form, "email").toLowerCase() });
}

async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid", step: "email" };
  if (!password) return { error: "passwordRequired", step: "password", email };

  const ip = await clientIp();
  const claimed = await claimGuess(`email:${email}`, ip);
  if (!claimed) return { error: "locked", step: "password", email };

  const [user] = await db().select().from(t.users).where(eq(t.users.email, email));
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  // People of a single sign-on domain sign in through their organisation: their password is refused like a wrong one.
  const viaSso = await signsInWithSso(email);
  if (!user || !ok || user.status !== "active" || viaSso) {
    if (!ip && recordAnonymousFailure() > ANONYMOUS_SLOWDOWN_AFTER) await new Promise((r) => setTimeout(r, ANONYMOUS_SLOWDOWN_MS));
    if (user) await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in_refused", ip, meta: { reason: !ok ? "password" : viaSso ? "sso" : user.status } });
    return { error: user && ok && !viaSso ? "blocked" : "invalidCredentials", step: "password", email };
  }
  await passed(claimed);
  await startSession(user, false);
  await auditDone({ tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "password" } });
  if (user.totpEnabled) redirect(`/sign-in/verify?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function verifySecondFactorAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => verifySecondFactor(prev, form), { step: form.get("mode") === "backup" ? "backup" : "totp" });
}

/** Spends a backup code in one conditional update, so a code works once even when sent twice in parallel. */
async function spendBackupCode(userId: string, code: string): Promise<boolean> {
  for (const h of [hashBackupCode(code), legacyBackupHash(code)]) {
    const spent = await db()
      .update(t.users)
      .set({ totpRecovery: sql`${t.users.totpRecovery} - ${h}::text` })
      .where(and(eq(t.users.id, userId), sql`${t.users.totpRecovery} @> ${JSON.stringify([h])}::jsonb`))
      .returning({ id: t.users.id });
    if (spent.length) return true;
  }
  return false;
}

async function verifySecondFactor(_: AuthState, form: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const mode = form.get("mode") === "backup" ? "backup" : "totp";
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(form.get("next"));
  if (!code) return { error: mode === "backup" ? "backupCodeRequired" : "codeRequired", step: mode };

  // Needs the password already, so the limit is per account: five guesses in 15 minutes, however many arrive at once.
  const claimed = await claim([[`2fa:${session.user.id}`, MAX_FAILS_PER_ACCOUNT]]);
  if (!claimed) return { error: "locked", step: mode };
  let ok: boolean;
  if (mode === "totp") {
    const [user] = await db().select({ totpSecret: t.users.totpSecret }).from(t.users).where(eq(t.users.id, session.user.id));
    ok = await verifyTotpOnce(session.user.id, user?.totpSecret ?? null, code);
  } else ok = await spendBackupCode(session.user.id, code);
  if (!ok) return { error: mode === "backup" ? "invalidBackupCode" : "invalidCode", step: mode };
  await passed(claimed);
  await db().update(t.sessions).set({ twoFactorVerified: true }).where(eq(t.sessions.id, session.sessionId));
  redirect(next);
}

/** The same cleaning as the admin dialogs and the CSV import (lib/phone), so one spelling works everywhere. */
function normalisePhone(raw: string): string | null {
  const p = cleanPhone(raw);
  return PHONE_PATTERN.test(p) ? p : null;
}

/**
 * Sign-in by text message: learners only. Console roles sign in with their password and two-step code, people of a single
 * sign-on domain through their organisation.
 */
async function phoneSignInAllowed(user: { role: Role; email: string }): Promise<boolean> {
  return !isConsoleRole(user.role) && !(await signsInWithSso(user.email));
}

export async function requestPhoneCodeAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => requestPhoneCode(prev, form), { step: "phone", phone: typed(form, "phone") });
}

async function requestPhoneCode(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  // Every refusal echoes the number as typed: React resets the form after the action, and the field falls back to it.
  const refused = (error: string): AuthState => ({ error, step: "phone", phone: typed(form, "phone") });
  if (!phone) return refused("phoneInvalid");
  if (!smsAvailable()) return refused("smsUnavailable");
  const ip = await clientIp();
  // A client that may no longer guess this number's codes gets no new ones either.
  if ((await failures(clientKey(`phone:${phone}`, ip))) >= MAX_FAILS_PER_ACCOUNT) return refused("locked");
  if (!(await sendAllowed(phone, ip, SMS_SENDS))) return refused("rateLimited");
  // Development only: the code on screen, so it is sent before answering.
  if (env.showOtp) return { step: "code", phone, devCode: await sendPhoneCode(phone, ip) };
  // Whose number it is decides only after the answer, so a registered number answers like any other, as fast.
  afterAnswer("[auth] sign-in code not sent", () => sendPhoneCode(phone, ip));
  return { step: "code", phone };
}

/** Texts a new sign-in code (replacing the pending one) when the number belongs to one active learner. Returns the code. */
async function sendPhoneCode(phone: string, ip: string | null): Promise<string | undefined> {
  const user = await userByPhone(phone);
  if (!user || !(await phoneSignInAllowed(user))) return undefined;
  const digits = new Uint32Array(1);
  crypto.getRandomValues(digits);
  const code = String(digits[0] % 1_000_000).padStart(6, "0");
  await db().delete(t.authTokens).where(and(eq(t.authTokens.userId, user.id), eq(t.authTokens.kind, "phone_otp")));
  await db().insert(t.authTokens).values({ id: sha256Hex(`otp:${user.id}:${code}`), userId: user.id, kind: "phone_otp", expiresAt: new Date(Date.now() + 5 * 60_000) });
  // In the person's language, with the warning not to pass it on; every wording fits one SMS.
  const ts = await getTranslations({ locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE, namespace: "auth.phone" });
  const res = await sendSms(phone, ts("smsText", { code }));
  if (!res.ok) {
    log.error("[auth] sign-in code not sent", { tenantId: user.tenantId, userId: user.id, error: res.error });
    return undefined;
  }
  await auditDone({ tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "phone", stage: "code_sent" } });
  return code;
}

export async function verifyPhoneCodeAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => verifyPhoneCode(prev, form), { step: "code", phone: typed(form, "phone") });
}

async function verifyPhoneCode(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(form.get("next"));
  if (!phone) return { error: "phoneInvalid", step: "phone" };
  if (!/^\d{6}$/.test(code)) return { error: "codeRequired", step: "code", phone };
  const ip = await clientIp();
  const claimed = await claimGuess(`phone:${phone}`, ip);
  if (!claimed) return { error: "locked", step: "code", phone };
  const wrong: AuthState = { error: "invalidCode", step: "code", phone };

  const user = await userByPhone(phone);
  const [token] =
    user && (await phoneSignInAllowed(user))
      ? await db()
          .select()
          .from(t.authTokens)
          .where(and(eq(t.authTokens.userId, user.id), eq(t.authTokens.kind, "phone_otp"), isNull(t.authTokens.usedAt)))
          .orderBy(desc(t.authTokens.createdAt))
          .limit(1)
      : [];
  if (!user || !token) return wrong;
  // Each guess takes one of the code's MAX_CODE_GUESSES in a single conditional update, so a parallel burst gets no more;
  // an expired, used or spent code answers exactly like a wrong one.
  const [counted] = await db()
    .update(t.authTokens)
    .set({ attempts: sql`${t.authTokens.attempts} + 1` })
    .where(and(eq(t.authTokens.id, token.id), isNull(t.authTokens.usedAt), lt(t.authTokens.attempts, MAX_CODE_GUESSES), gt(t.authTokens.expiresAt, new Date())))
    .returning({ id: t.authTokens.id });
  if (!counted || token.id !== sha256Hex(`otp:${user.id}:${code}`)) return wrong;
  const [used] = await db()
    .update(t.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(t.authTokens.id, token.id), isNull(t.authTokens.usedAt)))
    .returning({ id: t.authTokens.id });
  if (!used) return wrong;
  await passed(claimed);
  // The SMS code replaces the password only; an authenticator, when set up, is still required.
  await startSession(user, false);
  await auditDone({ tenantId: user.tenantId, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "phone" } });
  if (user.totpEnabled) redirect(`/sign-in/verify?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "emailRequired" };
  // Echoed back so the form keeps what was typed next to the error.
  if (!emailSchema.safeParse(email).success) return { error: "emailInvalid", email };
  const ip = await clientIp();
  // Every address gets the same answer as fast: the throttles count every address alike (so saying so tells nothing), and
  // whether the address has an account (and a mail goes out) is looked at only after the answer is sent.
  if (!(await sendAllowed(email, ip, RESET_MAILS))) return { error: "rateLimited", email };
  afterAnswer("[auth] reset mail not sent", () => mailResetLink(email, ip));
  return { done: true };
}

/** The reset mail, for an active account that signs in with a password here. */
async function mailResetLink(email: string, ip: string | null): Promise<void> {
  const [user] = await db().select().from(t.users).where(and(eq(t.users.email, email), eq(t.users.status, "active")));
  // People of a single sign-on domain sign in through their organisation and get no password.
  if (!user || (await signsInWithSso(email))) return;
  // A ceiling per organisation on its mail server, counted only for real accounts, so made-up addresses use none of it.
  if (!(await rateLimit(`reset-tenant:${user.tenantId}`, RESET_MAILS_PER_TENANT_HOUR, HOUR_MS)).ok) return;
  // The new link replaces the pending one (issueAccountLink), so only the newest mail in the inbox works. Nothing is lost
  // silently: each replacement is itself a mail to the same inbox, and the throttles cap how often someone else can do it.
  const link = await issueAccountLink(user.id, "reset");
  // The password-reset email in the person's interface language, its link as a button saying what it does.
  const lang = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  const tr = await getTranslations({ locale: lang, namespace: "auth.forgot.mail" });
  const text = tr("body", { name: user.name.split(" ")[0], link });
  await queueEmail(db(), user.tenantId, { to: user.email, kind: "password_reset", subject: tr("subject"), text, html: renderEmailHtml(text, { buttonLabel: tr("button"), lang }), lang });
  await audit(db(), { tenantId: user.tenantId, actorId: user.id, action: "auth.password_reset_requested", ip });
}

export async function setPasswordAction(prev: AuthState, form: FormData): Promise<AuthState> {
  return orFailed(() => setPassword(prev, form), {});
}

async function setPassword(_: AuthState, form: FormData): Promise<AuthState> {
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
    .set({ passwordHash: await hashPassword(password), ...(row.user.status === "invited" ? { status: "active" as const, activatedAt: new Date() } : {}) })
    .where(eq(t.users.id, row.user.id));
  await db().update(t.authTokens).set({ usedAt: new Date() }).where(eq(t.authTokens.id, row.token.id));
  // Several invite links may be out there (emailed, copied, CSV); the account activates once.
  await db().delete(t.authTokens).where(and(eq(t.authTokens.userId, row.user.id), eq(t.authTokens.kind, "invite"), ne(t.authTokens.id, row.token.id)));
  await invalidateUserSessions(row.user.id);
  await auditDone({ tenantId: row.user.tenantId, actorId: row.user.id, action: "auth.password_set", ip: await clientIp(), meta: { kind } });
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
  redirect("/sign-in?signedOut=1");
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const session = await getSession();
  // Settings → Languages: signed-in people pick only from the languages their organisation has switched on.
  if (session && !session.tenant.settings.locales.includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  if (session) await db().update(t.users).set({ locale }).where(eq(t.users.id, session.user.id));
}
