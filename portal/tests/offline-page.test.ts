import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { offlineScript } from "@/app/offline/script";

/** Runs the offline page's inline script against a minimal fake page (there is no DOM test environment). */
function run(opts: { cookie?: string; onLine?: boolean; health?: "ok" | "503" | "down"; lastReload?: number; path?: string }) {
  const el = (attrs: Record<string, string>, hidden = false) => ({ attrs, hidden, dir: attrs.dir ?? "ltr", getAttribute: (k: string) => attrs[k] ?? null });
  const elements = [
    el({ "data-offline-locale": "en" }),
    el({ "data-offline-locale": "ar", dir: "rtl" }, true),
    el({ "data-offline-state": "offline" }),
    el({ "data-offline-state": "server" }, true),
  ];
  const html = { lang: "en", dir: "ltr" };
  const listeners: Record<string, () => void> = {};
  let click: ((e: { target: unknown }) => void) | undefined;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  const store = new Map<string, string>(opts.lastReload ? [["cy-offline-reload", String(opts.lastReload)]] : []);
  const requests: RequestInit[] = [];
  let reloads = 0;
  const ctx = {
    document: {
      cookie: opts.cookie ?? "",
      documentElement: html,
      querySelectorAll: (sel: string) => elements.filter((e) => sel.slice(1, -1) in e.attrs),
      addEventListener: (type: string, fn: (e: { target: unknown }) => void) => type === "click" && (click = fn),
    },
    navigator: { onLine: opts.onLine ?? true },
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    setTimeout: (fn: () => void, ms: number) => (timers.set(nextId, { fn, ms }), nextId++),
    clearTimeout: (id: number) => timers.delete(id),
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    location: { pathname: opts.path ?? "/admin", reload: () => reloads++ },
    fetch: (_url: string, init: RequestInit) => {
      requests.push(init);
      return opts.health === "down" ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve({ ok: opts.health !== "503", status: opts.health === "503" ? 503 : 200 });
    },
    Date,
    Math,
    Number,
    String,
  };
  vm.runInNewContext(offlineScript("locale"), ctx);
  const visible = (attr: string, value: string) => !elements.find((e) => e.attrs[attr] === value)!.hidden;
  const delays = () => [...timers.values()].map((x) => x.ms);
  const tick = async () => {
    const [id, next] = [...timers.entries()][0];
    timers.delete(id);
    next.fn();
    await new Promise((r) => setTimeout(r, 0));
    return next.ms;
  };
  return { html, visible, delays, tick, listeners, store, requests, click: (target: unknown) => click?.({ target }), reloads: () => reloads };
}

describe("offline page script", () => {
  it("shows the language of the locale cookie with its direction", () => {
    const p = run({ cookie: "theme=dark; locale=ar" });
    expect(p.visible("data-offline-locale", "ar")).toBe(true);
    expect(p.visible("data-offline-locale", "en")).toBe(false);
    expect(p.html).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("says the server did not answer unless the device has no network", () => {
    const online = run({ onLine: true });
    expect(online.visible("data-offline-state", "server")).toBe(true);
    expect(online.visible("data-offline-state", "offline")).toBe(false);
    const offline = run({ onLine: false });
    expect(offline.visible("data-offline-state", "offline")).toBe(true);
    expect(offline.visible("data-offline-state", "server")).toBe(false);
  });

  it("reloads as soon as the server answers, and keeps trying while it does not", async () => {
    const up = run({ health: "ok" });
    expect(await up.tick()).toBe(3000);
    expect(up.reloads()).toBe(1);
    expect(up.store.has("cy-offline-reload")).toBe(true);
    expect(up.requests[0]).toMatchObject({ cache: "no-store", credentials: "omit" });

    for (const health of ["down", "503"] as const) {
      const p = run({ health });
      await p.tick();
      expect(p.reloads()).toBe(0);
      const [next] = p.delays();
      expect(p.delays()).toHaveLength(1);
      expect(next).toBeGreaterThanOrEqual(4000);
      expect(next).toBeLessThan(7000);
    }
  });

  it("waits longer when an automatic reload landed here again", () => {
    expect(run({ lastReload: Date.now() - 2000 }).delays()).toEqual([15000]);
    expect(run({ lastReload: Date.now() - 60_000 }).delays()).toEqual([3000]);
  });

  it("tries at once when the network comes back, replacing the pending try", () => {
    const p = run({ onLine: false });
    p.listeners.online();
    expect(p.delays()).toEqual([0]);
  });

  it("makes the retry button reload without React", () => {
    const p = run({});
    p.click({ closest: (sel: string) => (sel === "[data-offline-retry]" ? {} : null) });
    expect(p.reloads()).toBe(1);
    p.click({ closest: () => null });
    expect(p.reloads()).toBe(1);
  });

  it("neither polls nor reloads when /offline itself is opened from a working server", () => {
    const p = run({ path: "/offline", health: "ok" });
    expect(p.delays()).toEqual([]);
    expect(p.visible("data-offline-state", "offline")).toBe(true);
    p.click({ closest: () => ({}) });
    expect(p.reloads()).toBe(1);
  });
});
