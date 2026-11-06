import "server-only";
import { db } from "../db";
import type { Viewer } from "./viewer";
import { verifyUserPassword } from "./password";
import { audit } from "../services/audit";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";

export type StepUpError = "wrongPassword" | "rateLimited";

/**
 * Step-up before account-takeover tooling (2FA reset, reset links, role changes): the actor types
 * their own password again, 10 tries per actor per 15 minutes (per actor, so one administrator
 * cannot lock the others out), and every refusal is in the audit log.
 */
export async function stepUp(v: Viewer, password: unknown, action: string): Promise<StepUpError | null> {
  const limited = !(await rateLimit(`step-up:${v.user.id}`, 10, 15 * 60_000)).ok;
  const error: StepUpError | null = limited ? "rateLimited" : (await verifyUserPassword(v.user.id, typeof password === "string" ? password : "")) ? null : "wrongPassword";
  if (error) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "security.step_up_failed", ip: await clientIp(), meta: { action, error } });
  return error;
}
