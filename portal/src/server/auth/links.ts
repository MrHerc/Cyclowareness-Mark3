import "server-only";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";
import { db, t } from "../db";
import { sha256Hex } from "../crypto";
import { randomToken } from "../services/progress";
import { appUrl } from "../env";

/**
 * One-time link for inviting a person or resetting a password. Returns the full URL.
 * A new reset link replaces the old one; invite links already emailed or copied stay valid
 * (used or expired ones are cleaned up) and the first one used retires the rest (setPasswordAction).
 */
export async function issueAccountLink(userId: string, kind: "invite" | "reset"): Promise<string> {
  const token = randomToken(24);
  await db()
    .delete(t.authTokens)
    .where(
      and(
        eq(t.authTokens.userId, userId),
        eq(t.authTokens.kind, kind),
        kind === "invite" ? or(isNotNull(t.authTokens.usedAt), lt(t.authTokens.expiresAt, new Date())) : undefined,
      ),
    );
  await db()
    .insert(t.authTokens)
    .values({ id: sha256Hex(token), userId, kind, expiresAt: new Date(Date.now() + (kind === "invite" ? 14 * 86_400_000 : 60 * 60_000)) });
  return `${appUrl()}/account/${kind}/${token}`;
}

