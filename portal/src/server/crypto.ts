import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Encryption for secrets stored in the database (SMTP and SSO passwords, TOTP keys, webhook
 * secrets): AES-256-GCM with a key derived from APP_SECRET. During a rotation APP_SECRET_PREVIOUS
 * still opens what the old key sealed; `npm run secret:rotate` re-encrypts it all (docs/OPERATIONS.md).
 */
function secret(): string {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required in production");
  return "dev-only-secret-change-me-dev-only-secret-change-me";
}

/** The current secret first, then the previous one while a rotation is under way. */
function secrets(): string[] {
  const previous = process.env.APP_SECRET_PREVIOUS;
  return previous && previous.length >= 32 ? [secret(), previous] : [secret()];
}

function key(purpose: string, value = secret()): Buffer {
  return createHash("sha256").update(`${purpose}:${value}`).digest();
}

/**
 * Key id written into v2 ciphertexts, so decryption knows which secret sealed them. Derived with its
 * own purpose label like every key, so the id is not a prefix of the plain hash of the secret or of
 * any other derivation (a v2 written before the label falls back to every key, see decryptSecret).
 */
function kid(value: string): string {
  return key("kid", value).toString("hex").slice(0, 8);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const current = secret();
  const cipher = createCipheriv("aes-256-gcm", key("enc", current), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v2", kid(current), iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

/** True when the ciphertext was sealed with the current APP_SECRET (what `npm run secret:rotate` leaves alone). */
export function sealedWithCurrentKey(value: string): boolean {
  return value.startsWith(`v2:${kid(secret())}:`);
}

/**
 * Opens a v2 ciphertext with the key its id names and a v1 one (no key id) with every key; a v2
 * whose id matches no key is tried with every key too, GCM's tag rejects the wrong ones.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const [version, ...rest] = value.split(":");
  if (version !== "v1" && version !== "v2") return null;
  const id = version === "v2" ? rest.shift() : undefined;
  const [iv, tag, data] = rest;
  if (!iv || !tag || data === undefined) return null;
  const all = secrets();
  const candidates = id ? [...all.filter((s) => kid(s) === id), ...all.filter((s) => kid(s) !== id)] : all;
  for (const s of candidates) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key("enc", s), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      // Not this key.
    }
  }
  return null;
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
