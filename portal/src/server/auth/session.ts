import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { db, t } from "../db";
import { randomToken } from "../services/progress";
import { sha256Hex } from "../crypto";
import { audit } from "../services/audit";

/**
 * Database sessions. The browser holds a random token; the database stores only its SHA-256,
 * so a database leak does not leak usable sessions.
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cy_session" : "cy_session";
export const SESSION_DAYS = 30;
const DAY = 86_400_000;

export function sessionIdFromToken(token: string): string {
  return sha256Hex(token);
}

export async function createSession(p: {
  userId: string;
  tenantId: string;
  twoFactorVerified: boolean;
  ip: string | null;
  userAgent: string | null;
  maxDevices: number | null;
}): Promise<{ token: string; id: string; expiresAt: Date }> {
  const token = randomToken(24);
  const id = sessionIdFromToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db().insert(t.sessions).values({ id, userId: p.userId, tenantId: p.tenantId, expiresAt, twoFactorVerified: p.twoFactorVerified, ip: p.ip, userAgent: p.userAgent });

  if (p.maxDevices && p.maxDevices > 0) {
    // The new session always stays; the least recently used of the others go until the limit holds. Taking
    // it out first matters: its last-seen time is the database's clock, the others' that of the app server
    // that last saw them, so with the clocks out of step it can sort among the oldest.
    const others = await db()
      .select({ id: t.sessions.id })
      .from(t.sessions)
      .where(and(eq(t.sessions.userId, p.userId), ne(t.sessions.id, id)))
      .orderBy(asc(t.sessions.lastSeenAt));
    const excess = others.length + 1 - p.maxDevices;
    for (const s of others.slice(0, Math.max(0, excess))) {
      await db().delete(t.sessions).where(eq(t.sessions.id, s.id));
      await audit(db(), { tenantId: p.tenantId, actorId: p.userId, action: "auth.device_limit", ip: p.ip });
    }
  }

  // Invisible per-session code for the leak check (Settings → Protection).
  const code = `${randomCode()}-${randomCode()}`;
  await db().insert(t.watermarkCodes).values({ code, tenantId: p.tenantId, userId: p.userId, sessionId: id }).onConflictDoNothing();
  return { token, id, expiresAt };
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  // A __Host- cookie is only deleted when the deletion carries the same Secure and Path attributes.
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/", secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" });
}

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function invalidateSession(id: string): Promise<void> {
  await db().delete(t.sessions).where(eq(t.sessions.id, id));
}

/**
 * Signs the person out (everywhere but `exceptId`) and revokes the reporting-API tokens they created. Every caller
 * ends sessions for a security reason (a changed or reset password or second factor, signing out other devices,
 * a suspension, a changed role), and a token minted from a stolen session must not outlive that recovery.
 * `reason` goes into each token's api_token.revoked entry.
 */
export async function invalidateUserSessions(userId: string, exceptId?: string, reason = "sessions_ended"): Promise<void> {
  await db()
    .delete(t.sessions)
    .where(exceptId ? and(eq(t.sessions.userId, userId), ne(t.sessions.id, exceptId)) : eq(t.sessions.userId, userId));
  await revokeUserApiTokens(userId, reason);
}

/** Revokes the live (not revoked, not expired) reporting-API tokens the person created, one audit entry per token. */
export async function revokeUserApiTokens(userId: string, reason: string): Promise<void> {
  const revoked = await db()
    .update(t.apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(t.apiTokens.createdBy, userId), isNull(t.apiTokens.revokedAt), gt(t.apiTokens.expiresAt, new Date())))
    .returning({ id: t.apiTokens.id, tenantId: t.apiTokens.tenantId, name: t.apiTokens.name });
  for (const k of revoked) await audit(db(), { tenantId: k.tenantId, actorId: null, action: "api_token.revoked", targetType: "api_token", targetId: k.id, meta: { name: k.name, reason } });
}

/** Absolute lifetime: a session ends this long after sign-in at the latest, however often it is used. */
export const SESSION_MAX_DAYS = 90;

/**
 * Sliding expiry inside the absolute lifetime: a used session with less than half its life left is extended, never past
 * SESSION_MAX_DAYS after sign-in, so a copied cookie stops working by then too. Without the sign-in time (`createdAt`)
 * nothing is extended and the session ends SESSION_DAYS after sign-in.
 */
export function shouldRenew(expiresAt: Date, createdAt?: Date): boolean {
  if (!createdAt) return false;
  return expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY && renewedExpiry(createdAt).getTime() > expiresAt.getTime();
}

export function renewedExpiry(createdAt?: Date): Date {
  const sliding = Date.now() + SESSION_DAYS * DAY;
  return new Date(createdAt ? Math.min(sliding, createdAt.getTime() + SESSION_MAX_DAYS * DAY) : sliding);
}
