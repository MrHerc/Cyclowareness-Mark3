import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq, ne } from "drizzle-orm";
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
    const all = await db().select({ id: t.sessions.id }).from(t.sessions).where(eq(t.sessions.userId, p.userId)).orderBy(asc(t.sessions.lastSeenAt));
    const excess = all.length - p.maxDevices;
    for (const s of all.slice(0, Math.max(0, excess))) {
      if (s.id === id) continue;
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

export async function invalidateUserSessions(userId: string, exceptId?: string): Promise<void> {
  await db()
    .delete(t.sessions)
    .where(exceptId ? and(eq(t.sessions.userId, userId), ne(t.sessions.id, exceptId)) : eq(t.sessions.userId, userId));
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
