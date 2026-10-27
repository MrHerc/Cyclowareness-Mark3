import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { brotliCompressSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("APP_SECRET", "test-only-app-secret-0123456789-abcdefghij-0123456789");
const { guardedRequest } = await import("@/server/net-guard");
const { OIDC_MAX_RESPONSE_BYTES, discover } = await import("@/server/auth/oidc");

/** A stand-in identity provider on 127.0.0.1 (plain http is allowed for localhost outside production). */
let server: Server;
let base = "";
const hits = new Map<string, number>();
const routes = new Map<string, (res: ServerResponse) => void>();

const json = (body: unknown, type = "application/json; charset=utf-8") => (res: ServerResponse) => {
  res.writeHead(200, { "content-type": type });
  res.end(JSON.stringify(body));
};
const config = (path: string, patch: Record<string, unknown> = {}) => ({
  issuer: `${base}${path}`,
  authorization_endpoint: `${base}${path}/auth`,
  token_endpoint: `${base}${path}/token`,
  jwks_uri: `${base}${path}/jwks`,
  ...patch,
});

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.set(req.url ?? "", (hits.get(req.url ?? "") ?? 0) + 1);
    const route = routes.get(req.url ?? "");
    if (route) return route(res);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("guarded request", () => {
  it("refuses plain http and private hosts when the destination is checked, before connecting", async () => {
    await expect(guardedRequest(`${base}/x`, { kind: "https", maxBytes: 10 })).rejects.toThrow("insecure_endpoint");
    await expect(guardedRequest("https://127.0.0.1/x", { kind: "https", maxBytes: 10 })).rejects.toThrow("private_address");
    await expect(guardedRequest("https://[0:0:0:0:0:ffff:7f00:1]/x", { kind: "https", maxBytes: 10 })).rejects.toThrow("private_address");
  });

  it("stops reading past the limit, announced or streamed", async () => {
    routes.set("/big", (res) => {
      res.writeHead(200, { "content-type": "application/json", "content-length": "5000" });
      res.end("x".repeat(5000));
    });
    routes.set("/stream", (res) => {
      res.writeHead(200, { "content-type": "application/json" });
      for (let i = 0; i < 50; i++) res.write("x".repeat(100));
      res.end();
    });
    await expect(guardedRequest(`${base}/big`, { kind: "https", vet: false, maxBytes: 1000 })).rejects.toThrow("response_too_large");
    await expect(guardedRequest(`${base}/stream`, { kind: "https", vet: false, maxBytes: 1000 })).rejects.toThrow("response_too_large");
  });

  it("does not follow redirects and never decompresses the body", async () => {
    routes.set("/moved", (res) => res.writeHead(302, { location: "http://169.254.169.254/" }).end());
    const packed = brotliCompressSync(Buffer.from('{"a":1}'));
    routes.set("/br", (res) => {
      res.writeHead(200, { "content-type": "application/json", "content-encoding": "br" });
      res.end(packed);
    });
    expect((await guardedRequest(`${base}/moved`, { kind: "https", vet: false, maxBytes: 1000 })).status).toBe(302);
    expect((await guardedRequest(`${base}/br`, { kind: "https", vet: false, maxBytes: 1000 })).body.equals(packed)).toBe(true);
  });

  it("reports a connection failure as request_failed", async () => {
    await expect(guardedRequest("http://127.0.0.1:1/x", { kind: "https", vet: false, maxBytes: 10 })).rejects.toThrow("request_failed");
  });
});

describe("OIDC discovery", () => {
  it("is fetched once and then served from memory", async () => {
    routes.set("/ok/.well-known/openid-configuration", json(config("/ok")));
    const first = await discover(`${base}/ok`);
    expect(first.authorizationEndpoint).toBe(`${base}/ok/auth`);
    expect(await discover(`${base}/ok`)).toEqual(first);
    expect(hits.get("/ok/.well-known/openid-configuration")).toBe(1);
  });

  it("refuses a document that is too large, not JSON, or sends people to another host", async () => {
    routes.set("/huge/.well-known/openid-configuration", json({ ...config("/huge"), pad: "x".repeat(OIDC_MAX_RESPONSE_BYTES) }));
    routes.set("/html/.well-known/openid-configuration", json(config("/html"), "text/html"));
    routes.set("/away/.well-known/openid-configuration", json(config("/away", { authorization_endpoint: "https://phish.example/auth" })));
    await expect(discover(`${base}/huge`)).rejects.toThrow("response_too_large");
    await expect(discover(`${base}/html`)).rejects.toThrow("bad_content_type");
    await expect(discover(`${base}/away`)).rejects.toThrow("foreign_authorization_endpoint");
  });

  it("accepts JSON subtypes such as application/jwk-set+json", async () => {
    routes.set("/jwk/.well-known/openid-configuration", json(config("/jwk"), "application/jwk-set+json"));
    await expect(discover(`${base}/jwk`)).resolves.toMatchObject({ issuer: `${base}/jwk` });
  });
});
