import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SW = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
const ORIGIN = "http://localhost:3100";
const OFFLINE_HTML = [
  '<html><head><link rel="stylesheet" href="/_next/static/css/app.css" data-precedence="next"/>',
  '<link rel="preload" href="/_next/static/media/font.woff2" as="font"/>',
  '<script src="/_next/static/chunks/main.js" async=""></script></head><body><main><h1>Offline</h1>',
  '<script nonce="n1">self.__next_f.push([1,"9734:I[\\"static/chunks/9734.js\\"]"])</script>',
  '<script nonce="n1" data-offline-script="">poll()</script></main></body></html>',
].join("");

type Handler = (event: FakeEvent) => void;
type FakeEvent = { request?: { method: string; url: string; mode: string }; promise?: Promise<unknown>; respondWith(p: Promise<unknown>): void; waitUntil(p: Promise<unknown>): void };

/** Loads public/sw.js with fake caches and network; `up` decides whether the server answers. */
function load(up: boolean) {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: string | { url: string }) => new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
  const network = (r: string | { url: string }) => {
    if (!up) return Promise.reject(new TypeError("Failed to fetch"));
    const p = key(r);
    const body = p === "/offline" ? OFFLINE_HTML : `asset ${p}`;
    return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/html", "content-encoding": "gzip", "content-length": "999" } }));
  };
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, m);
    return {
      addAll: async (urls: string[]) => {
        for (const u of urls) m.set(key(u), await network(u));
      },
      put: async (r: { url: string }, res: Response) => void m.set(key(r), res),
      match: async (r: string | { url: string }) => m.get(key(r))?.clone(),
    };
  };
  const caches = {
    open,
    match: async (r: string | { url: string }) => {
      for (const m of stores.values()) if (m.has(key(r))) return m.get(key(r))!.clone();
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (k: string) => stores.delete(k),
  };
  const handlers: Record<string, Handler> = {};
  const self = { location: { origin: ORIGIN }, addEventListener: (t: string, h: Handler) => (handlers[t] = h), skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } };
  vm.runInNewContext(SW, { self, caches, fetch: network, Response, Headers, URL, Set, Promise });
  const event = (request?: FakeEvent["request"]): FakeEvent => ({ request, respondWith(p) { this.promise = p; }, waitUntil(p) { this.promise = p; } });
  return { handlers, stores, event, setUp: (v: boolean) => (up = v) };
}

describe("service worker", () => {
  it("precaches the offline page with its stylesheets and fonts", async () => {
    const sw = load(true);
    const e = sw.event();
    sw.handlers.install(e);
    await e.promise;
    const cached = [...[...sw.stores.values()][0].keys()].sort();
    expect(cached).toEqual(["/_next/static/css/app.css", "/_next/static/media/font.woff2", "/icons/icon-192.png", "/icons/icon.svg", "/offline"]);
  });

  it("serves the offline page without the app's scripts when a page cannot be fetched", async () => {
    const sw = load(true);
    const install = sw.event();
    sw.handlers.install(install);
    await install.promise;
    sw.setUp(false);
    const nav = sw.event({ method: "GET", url: `${ORIGIN}/admin`, mode: "navigate" });
    sw.handlers.fetch(nav);
    const res = (await nav.promise) as Response;
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(res.headers.get("content-length")).toBeNull();
    expect(html).toContain('<script nonce="n1" data-offline-script="">poll()</script>');
    expect(html).not.toContain("main.js");
    expect(html).not.toContain("__next_f");
    expect(html).toContain("/_next/static/css/app.css");
  });

  it("passes pages through untouched while the server answers", async () => {
    const sw = load(true);
    const nav = sw.event({ method: "GET", url: `${ORIGIN}/admin`, mode: "navigate" });
    sw.handlers.fetch(nav);
    expect(await ((await nav.promise) as Response).text()).toBe("asset /admin");
  });
});
