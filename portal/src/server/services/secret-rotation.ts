import { eq, isNotNull } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { decryptSecret, encryptSecret, sealedWithCurrentKey } from "../crypto";

export type RotationCounts = { tenants: number; users: number; unreadable: number };

/**
 * Re-encrypts every stored secret with the current APP_SECRET after a rotation (docs/OPERATIONS.md,
 * "Rotating APP_SECRET"): the *Enc fields of tenants.settings and users.totp_secret. A value already
 * under the current key is left alone, so a second run changes nothing; one that opens with no key
 * (sealed with a secret that is neither current nor previous) is left as it is and counted.
 */
export async function rotateStoredSecrets(db: DB): Promise<RotationCounts> {
  const counts: RotationCounts = { tenants: 0, users: 0, unreadable: 0 };
  const resealed = (value: string | undefined | null): string | undefined => {
    if (!value || sealedWithCurrentKey(value)) return undefined;
    const plain = decryptSecret(value);
    if (plain === null) {
      counts.unreadable++;
      return undefined;
    }
    return encryptSecret(plain);
  };

  const tenants = await db.select({ id: t.tenants.id }).from(t.tenants);
  for (const { id } of tenants) {
    // Read and written under a lock, so an administrator's settings save meanwhile is not overwritten.
    const changed = await db.transaction(async (tx) => {
      const [row] = await tx.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, id)).for("update");
      const s = structuredClone(row.settings);
      const holders: [{ [field: string]: unknown } | undefined, string][] = [
        [s.identity.sso, "clientSecretEnc"],
        [s.identity.ldap, "passwordEnc"],
        [s.email, "passwordEnc"],
        [s.integrations, "webhookSecretEnc"],
      ];
      let changed = false;
      for (const [holder, field] of holders) {
        const current = holder?.[field];
        const next = resealed(typeof current === "string" ? current : undefined);
        if (next === undefined || !holder) continue;
        holder[field] = next;
        changed = true;
      }
      if (changed) await tx.update(t.tenants).set({ settings: s }).where(eq(t.tenants.id, id));
      return changed;
    });
    if (changed) counts.tenants++;
  }

  const users = await db.select({ id: t.users.id, totpSecret: t.users.totpSecret }).from(t.users).where(isNotNull(t.users.totpSecret));
  for (const u of users) {
    const next = resealed(u.totpSecret);
    if (next === undefined) continue;
    await db.update(t.users).set({ totpSecret: next }).where(eq(t.users.id, u.id));
    counts.users++;
  }
  return counts;
}
