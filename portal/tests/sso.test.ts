import { describe, expect, it, vi } from "vitest";
import { parseEmailMarkup, stripEmailMarkup } from "@/lib/email-markup";

vi.stubEnv("APP_SECRET", "test-only-app-secret-0123456789-abcdefghij-0123456789");
const { codeChallenge, openState, sealState, verifyIdToken } = await import("@/server/auth/oidc");
const { renderEmailHtml } = await import("@/server/mail");

const provider = { issuer: "https://idp.example.test", authorizationEndpoint: "https://idp.example.test/auth", tokenEndpoint: "https://idp.example.test/token", jwksUri: "https://idp.example.test/jwks", secretPost: false };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

async function signedToken(claims: Record<string, unknown>) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const head = `${b64({ alg: "RS256", kid: "k1" })}.${b64(claims)}`;
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, Buffer.from(head))).toString("base64url");
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: "k1", use: "sig" }] })));
  return `${head}.${sig}`;
}

const now = () => Math.floor(Date.now() / 1000);
const good = () => ({ iss: provider.issuer, aud: "client-1", exp: now() + 300, iat: now(), nonce: "n-1", email: "aysel@example.test" });

describe("OIDC ID token", () => {
  it("accepts a valid token and returns its claims", async () => {
    const token = await signedToken(good());
    await expect(verifyIdToken(provider, token, { clientId: "client-1", nonce: "n-1" })).resolves.toMatchObject({ email: "aysel@example.test" });
  });

  it.each([
    ["issuer", { iss: "https://other.example.test" }, "token_issuer"],
    ["audience", { aud: "client-2" }, "token_audience"],
    ["expiry", { exp: now() - 3600 }, "token_expired"],
    ["nonce", { nonce: "n-2" }, "token_nonce"],
  ])("rejects a wrong %s", async (_, patch, error) => {
    const token = await signedToken({ ...good(), ...patch });
    await expect(verifyIdToken(provider, token, { clientId: "client-1", nonce: "n-1" })).rejects.toThrow(error);
  });

  it("rejects a changed payload and an unsigned token", async () => {
    const token = await signedToken(good());
    const [h, , s] = token.split(".");
    await expect(verifyIdToken(provider, `${h}.${b64({ ...good(), email: "boss@example.test" })}.${s}`, { clientId: "client-1", nonce: "n-1" })).rejects.toThrow("token_signature");
    await expect(verifyIdToken(provider, `${b64({ alg: "none" })}.${b64(good())}.`, { clientId: "client-1", nonce: "n-1" })).rejects.toThrow("token_alg");
  });

  it("uses an S256 PKCE challenge and a tamper-proof state cookie", () => {
    expect(codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    const sealed = sealState({ state: "s", nonce: "n", verifier: "v", tenant: "demo", test: false, at: Date.now() });
    expect(openState(sealed)?.tenant).toBe("demo");
    expect(openState(sealed.replace(/^./, "x"))).toBeNull();
    expect(openState(sealState({ state: "s", nonce: "n", verifier: "v", tenant: "demo", test: false, at: Date.now() - 11 * 60_000 }))).toBeNull();
  });
});

describe("email markup", () => {
  it("parses bold, italic and links, and leaves URLs alone", () => {
    expect(parseEmailMarkup("Hi **Aysel**, read _this_ [now](https://a.test/x_y_z). See https://a.test/_b_ too")).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "bold", text: "Aysel" },
      { kind: "text", text: ", read " },
      { kind: "italic", text: "this" },
      { kind: "text", text: " " },
      { kind: "link", text: "now", href: "https://a.test/x_y_z" },
      { kind: "text", text: ". See " },
      { kind: "text", text: "https://a.test/_b_" },
      { kind: "text", text: " too" },
    ]);
    expect(stripEmailMarkup("**Due** _soon_: [open](https://a.test)")).toBe("Due soon: open (https://a.test)");
  });

  it("renders markup only when asked, escaped, with http(s) links only", () => {
    const text = "**<b>x</b>** [go](javascript:alert(1)) [ok](https://a.test/?a=1&b=2)\n\nhttps://a.test/start";
    const html = renderEmailHtml(text, { markup: true, buttonLabel: "Open" });
    expect(html).toContain("<b>&lt;b&gt;x&lt;/b&gt;</b>");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="https://a.test/?a=1&amp;b=2"');
    expect(html).toContain(">Open</a>");
    expect(renderEmailHtml("**x**")).toContain("**x**");
  });
});
