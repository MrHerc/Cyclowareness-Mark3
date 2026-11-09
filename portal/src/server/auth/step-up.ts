import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "./viewer";
import { verifyPassword } from "./password";
import { audit } from "../services/audit";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";

export type StepUpError = "wrongPassword" | "rateLimited";

/**
 * Step-up before account-takeover tooling (2FA reset, reset links, role changes): the actor types
 * their own password again, 10 tries per actor per 15 minutes (per actor, so one administrator
 * cannot lock the others out), and every refusal is in the audit log.
 */
export async function stepUp(v: Viewer, password: unknown, action: string, targetId?: string): Promise<StepUpError | null> {
  const limited = !(await rateLimit(`step-up:${v.user.id}`, 10, 15 * 60_000)).ok;
  const error: StepUpError | null = limited ? "rateLimited" : (await verifyUserPassword(v.user.id, typeof password === "string" ? password : "")) ? null : "wrongPassword";
  // The target is recorded as given (before any lookup): an investigator needs to see whose account a run of failures aimed at.
  if (error) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "security.step_up_failed", targetType: targetId ? "user" : undefined, targetId, ip: await clientIp(), meta: { action, error } });
  return error;
}

/** A signed-in person's own password against the stored hash (confirming a sensitive action). An account without a password never matches. */
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const [u] = await db().select({ hash: t.users.passwordHash }).from(t.users).where(eq(t.users.id, userId));
  return verifyPassword(u?.hash ?? null, password);
}
