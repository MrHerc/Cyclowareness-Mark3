import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { signValue, unsignValue } from "../crypto";
import { destinationProblem } from "../net-guard";

/**
 * Minimal OpenID Connect relying party (authorization code flow with PKCE, state and nonce).
 * Only what single sign-on needs: discovery, the code exchange and ID token checks.
 */
export type OidcProvider = { issuer: string; authorizationEndpoint: string; tokenEndpoint: string; jwksUri: string; secretPost: boolean };

const trimSlash = (s: string) => s.replace(/\/+$/, "");

async function getJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  // A tenant's issuer must be a public host: the platform must not probe its own network for a customer.
  if (process.env.NODE_ENV === "production") {
    const u = new URL(url);
    if (await destinationProblem(u.hostname, Number(u.port || 443), "https")) throw new Error("blocked_endpoint");
  }
  const res = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const body = (await res.json()) as unknown;
  if (!body || typeof body !== "object") throw new Error("bad_json");
  return body as Record<string, unknown>;
}

/** Provider endpoints must be https (plain http only for localhost during development). */
function endpoint(value: unknown): string {
  if (typeof value !== "string") throw new Error("discovery");
  const url = new URL(value);
  const devLocal = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !devLocal) throw new Error("insecure_endpoint");
  return url.toString();
}

export async function discover(issuer: string): Promise<OidcProvider> {
  const d = await getJson(`${trimSlash(endpoint(issuer))}/.well-known/openid-configuration`);
  if (typeof d.issuer !== "string" || trimSlash(d.issuer) !== trimSlash(issuer)) throw new Error("issuer_mismatch");
  const methods = Array.isArray(d.token_endpoint_auth_methods_supported) ? (d.token_endpoint_auth_methods_supported as unknown[]) : [];
  return {
    issuer: d.issuer,
    authorizationEndpoint: endpoint(d.authorization_endpoint),
    tokenEndpoint: endpoint(d.token_endpoint),
    jwksUri: endpoint(d.jwks_uri),
    // client_secret_basic is the default; use the form field only when the provider does not offer basic.
    secretPost: methods.length > 0 && !methods.includes("client_secret_basic") && methods.includes("client_secret_post"),
  };
}

/** Short-lived, signed cookie that carries the login attempt from /api/sso/start to the callback. */
export const SSO_STATE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cy_sso" : "cy_sso";
export type SsoState = { state: string; nonce: string; verifier: string; tenant: string; test: boolean; at: number };

export function sealState(s: SsoState): string {
  return signValue(Buffer.from(JSON.stringify(s)).toString("base64url"));
}

export function openState(value: string | undefined): SsoState | null {
  const raw = unsignValue(value);
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SsoState;
    return Date.now() - s.at < 10 * 60_000 ? s : null;
  } catch {
    return null;
  }
}

export function randomValue(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Exchanges the authorization code and returns the raw ID token. */
export async function exchangeCode(p: OidcProvider, input: { code: string; redirectUri: string; clientId: string; clientSecret: string | null; verifier: string }): Promise<string> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, code_verifier: input.verifier });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (input.clientSecret && p.secretPost) body.set("client_secret", input.clientSecret);
  else if (input.clientSecret) headers.authorization = `Basic ${Buffer.from(`${encodeURIComponent(input.clientId)}:${encodeURIComponent(input.clientSecret)}`).toString("base64")}`;
  const tokens = await getJson(p.tokenEndpoint, { method: "POST", headers, body });
  if (typeof tokens.id_token !== "string") throw new Error("no_id_token");
  return tokens.id_token;
}

const ALGORITHMS = {
  RS256: { kty: "RSA", importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verifyParams: { name: "RSASSA-PKCS1-v1_5" } },
  ES256: { kty: "EC", importParams: { name: "ECDSA", namedCurve: "P-256" }, verifyParams: { name: "ECDSA", hash: "SHA-256" } },
} as const;

const decodePart = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/** Checks the signature (provider JWKS), issuer, audience, expiry and nonce; returns the claims. */
export async function verifyIdToken(p: OidcProvider, idToken: string, expected: { clientId: string; nonce: string }): Promise<Record<string, unknown>> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("token_format");
  const [h, payload, signature] = parts;
  const header = decodePart(h);
  const alg = ALGORITHMS[header.alg as keyof typeof ALGORITHMS];
  if (!alg) throw new Error("token_alg");

  const jwks = await getJson(p.jwksUri);
  const keys = (Array.isArray(jwks.keys) ? jwks.keys : []) as Record<string, unknown>[];
  const jwk = keys.find((k) => k.kty === alg.kty && (k.use === undefined || k.use === "sig") && (header.kid === undefined || k.kid === header.kid));
  if (!jwk) throw new Error("token_key");
  const keyData: JsonWebKey = alg.kty === "RSA" ? { kty: "RSA", n: String(jwk.n), e: String(jwk.e) } : { kty: "EC", crv: String(jwk.crv), x: String(jwk.x), y: String(jwk.y) };
  const key = await crypto.subtle.importKey("jwk", keyData, alg.importParams, false, ["verify"]);
  const ok = await crypto.subtle.verify(alg.verifyParams, key, Buffer.from(signature, "base64url"), Buffer.from(`${h}.${payload}`));
  if (!ok) throw new Error("token_signature");

  const claims = decodePart(payload);
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== p.issuer) throw new Error("token_issuer");
  if (!aud.includes(expected.clientId)) throw new Error("token_audience");
  if (aud.length > 1 && claims.azp !== undefined && claims.azp !== expected.clientId) throw new Error("token_azp");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) throw new Error("token_expired");
  if (typeof claims.iat === "number" && claims.iat > now + 300) throw new Error("token_iat");
  if (claims.nonce !== expected.nonce) throw new Error("token_nonce");
  return claims;
}
