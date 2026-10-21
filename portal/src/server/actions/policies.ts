"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { verifyPassword } from "../auth/password";
import { audit } from "../services/audit";
import { clientIp } from "../request";
import { rateLimit } from "../rate-limit";
import { isUuid } from "../../lib/ids";

export type SignState = { ok?: boolean; error?: "agree" | "password" | "rateLimited" | "generic" } | undefined;

/** Signing a policy version requires ticking the statement and the account password. */
export async function signPolicyAction(prev: SignState, form: FormData): Promise<SignState> {
  // A failure (database unavailable) answers with the generic error so the sign-off page stays, instead of the error
  // boundary; redirect() and notFound() still pass through.
  try {
    return await signPolicy(prev, form);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[policies] sign failed", error);
    return { error: "generic" };
  }
}

async function signPolicy(_: SignState, form: FormData): Promise<SignState> {
  const v = await actionViewer();
  const versionId = String(form.get("versionId") ?? "");
  const password = String(form.get("password") ?? "");
  if (!isUuid(versionId)) return { error: "generic" };
  if (form.get("agree") !== "on") return { error: "agree" };
  if (!(await rateLimit(`sign:${v.user.id}`, 10, 15 * 60_000)).ok) return { error: "rateLimited" };
  const [version] = await db()
    .select({
      id: t.policyVersions.id,
      policyId: t.policyVersions.policyId,
      version: t.policyVersions.version,
      publishedAt: t.policyVersions.publishedAt,
      tenantId: t.policies.tenantId,
      archivedAt: t.policies.archivedAt,
    })
    .from(t.policyVersions)
    .innerJoin(t.policies, eq(t.policies.id, t.policyVersions.policyId))
    .where(eq(t.policyVersions.id, versionId));
  if (!version || version.tenantId !== v.tenant.id || version.archivedAt || !version.publishedAt) return { error: "generic" };
  // Only the current published version is signable; a newer version needs a new signature.
  const [latest] = await db()
    .select({ id: t.policyVersions.id })
    .from(t.policyVersions)
    .where(and(eq(t.policyVersions.policyId, version.policyId), isNotNull(t.policyVersions.publishedAt)))
    .orderBy(desc(t.policyVersions.version))
    .limit(1);
  if (latest?.id !== versionId) return { error: "generic" };
  const [u] = await db().select({ hash: t.users.passwordHash }).from(t.users).where(eq(t.users.id, v.user.id));
  // Accounts without a local password (single sign-on) confirm with the checkbox only.
  if (u?.hash && !(await verifyPassword(u.hash, password))) return { error: "password" };
  const ip = await clientIp();
  await db().insert(t.policySignoffs).values({ versionId, userId: v.user.id, ip }).onConflictDoNothing();
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.signed", targetType: "policy", targetId: version.policyId, ip, meta: { version: version.version } });
  refresh();
  return { ok: true };
}
