import { timingSafeEqual } from "node:crypto";
import { createTOTPKeyURI, generateHOTP } from "@oslojs/otp";
import { decodeBase32IgnorePadding, encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "../db";
import { decryptSecret, encryptSecret, hmac, sha256Hex } from "../crypto";
import { env } from "../env";

export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;

export function newTotpKey(): { base32: string; encrypted: string } {
  const key = new Uint8Array(20);
  crypto.getRandomValues(key);
  const base32 = encodeBase32UpperCaseNoPadding(key);
  return { base32, encrypted: encryptSecret(base32) };
}

export function totpUri(issuer: string, account: string, base32: string): string {
  return createTOTPKeyURI(issuer, account, decodeBase32IgnorePadding(base32), TOTP_PERIOD, TOTP_DIGITS);
}

/** The time step (current, or one either side for clock drift) whose code this is, else null. */
export function totpStep(encryptedKey: string | null, code: string, now = Date.now()): number | null {
  const base32 = decryptSecret(encryptedKey);
  if (!base32 || !/^\d{6}$/.test(code)) return null;
  const key = decodeBase32IgnorePadding(base32);
  const current = Math.floor(now / 1000 / TOTP_PERIOD);
  for (const step of [current - 1, current, current + 1]) {
    if (timingSafeEqual(Buffer.from(generateHOTP(key, BigInt(step), TOTP_DIGITS)), Buffer.from(code))) return step;
  }
  return null;
}

/**
 * Accepts a code once: the matched step is recorded in one conditional update, so the same code (or an older one)
 * is refused afterwards, even when two requests carry it at the same time.
 */
export async function verifyTotpOnce(userId: string, encryptedKey: string | null, code: string): Promise<boolean> {
  const step = totpStep(encryptedKey, code);
  if (step === null) return false;
  const taken = await db()
    .update(t.users)
    .set({ totpLastStep: step })
    .where(and(eq(t.users.id, userId), sql`(${t.users.totpLastStep} is null or ${t.users.totpLastStep} < ${step})`))
    .returning({ id: t.users.id });
  return taken.length > 0;
}

/** Ten single-use backup codes, shown once; only their hashes are stored. */
export function newBackupCodes(): { codes: string[]; hashes: string[] } {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = Array.from({ length: 10 }, () => {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const s = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { codes, hashes: codes.map((code) => hashBackupCode(code)) };
}

const normalised = (code: string) => code.trim().toLowerCase().replace(/\s/g, "");

/** An HMAC keyed from APP_SECRET (like the stored TOTP keys), so a copy of the database alone cannot be searched offline. */
export function hashBackupCode(code: string, secret = env.secret): string {
  return hmac(`backup:${normalised(code)}`, sha256Hex(`backup-codes:${secret}`));
}

/** Every form a stored code may have: the current key, the previous key during an APP_SECRET rotation, and the legacy hash. */
export function backupCodeHashes(code: string): string[] {
  return [hashBackupCode(code), ...(env.previousSecret ? [hashBackupCode(code, env.previousSecret)] : []), legacyBackupHash(code)];
}

/** How codes made before the keyed hash were stored (plain SHA-256); they stay valid until used or replaced. */
export function legacyBackupHash(code: string): string {
  return sha256Hex(`backup:${normalised(code)}`);
}
