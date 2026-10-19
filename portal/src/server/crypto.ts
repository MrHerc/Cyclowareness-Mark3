import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Encryption for secrets stored in the database (SMTP and SSO passwords, TOTP keys, webhook
 * secrets): AES-256-GCM with a key derived from APP_SECRET. Rotating APP_SECRET makes stored
 * secrets unreadable, so admins re-enter them.
 */
function secret(): string {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required in production");
  return "dev-only-secret-change-me-dev-only-secret-change-me";
}

function key(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${secret()}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const [version, iv, tag, data] = value.split(":");
  if (version !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key("enc"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** HMAC-SHA256 hex signature (webhooks, signed one-off values). */
export function hmac(payload: string, secretValue: string): string {
  return createHmac("sha256", secretValue).update(payload).digest("hex");
}

export function signValue(value: string): string {
  return `${value}.${createHmac("sha256", key("sign")).update(value).digest("base64url")}`;
}

export function unsignValue(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(signValue(value).slice(i + 1));
  const given = Buffer.from(signed.slice(i + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? value : null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
