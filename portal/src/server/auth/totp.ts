import { createTOTPKeyURI, verifyTOTPWithGracePeriod } from "@oslojs/otp";
import { decodeBase32IgnorePadding, encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";
import { decryptSecret, encryptSecret, sha256Hex } from "../crypto";

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

/** Accepts the current code and one step either side (clock drift). */
export function verifyTotp(encryptedKey: string | null, code: string): boolean {
  const base32 = decryptSecret(encryptedKey);
  if (!base32 || !/^\d{6}$/.test(code)) return false;
  return verifyTOTPWithGracePeriod(decodeBase32IgnorePadding(base32), TOTP_PERIOD, TOTP_DIGITS, code, TOTP_PERIOD);
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
  return { codes, hashes: codes.map(hashBackupCode) };
}

export function hashBackupCode(code: string): string {
  return sha256Hex(`backup:${code.trim().toLowerCase().replace(/\s/g, "")}`);
}
