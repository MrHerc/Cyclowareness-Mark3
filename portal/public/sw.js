/*
 * Cyclowareness service worker: only an offline fallback.
 * Pages and API responses are never cached (they are personal); static build assets are
 * cached on first use so the app shell opens fast. A page navigation that cannot be fetched (no connection, or
 * the server does not answer) shows /offline, which tells the two apart and reloads itself when the server is back.
 */
const VERSION = "cy-v5";
const OFFLINE = "/offline";
const PRECACHE = [OFFLINE, "/icons/icon.svg", "/icons/icon-192.png"];
// The offline copy's stylesheets and fonts, so it looks right even if no page has loaded them through this worker yet.
const LOOKS = /(?:href|src)="(\/_next\/static\/(?:css|media)\/[^"?#]+)"/g;
// Every script except the offline page's own (data-offline-script). The copy must not start the app: the chunks it
// would load may not be cached, and a chunk that fails to load turns the page into the error boundary.
const APP_SCRIPTS = /<script\b(?![^>]*\bdata-offline-script\b)[^>]*>[\s\S]*?<\/script>/gi;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) =>
        c
          .addAll(PRECACHE)
          .then(() => c.match(OFFLINE))
          .then((res) => res.text())
          .then((html) => c.addAll([...new Set([...html.matchAll(LOOKS)].map((m) => m[1]))])),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** The cached /offline page without the app's scripts; the body changes, so its length and encoding headers go. */
function offlinePage() {
  return caches.match(OFFLINE).then((res) => {
    if (!res) return Response.error();
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return res.text().then((html) => new Response(html.replace(APP_SCRIPTS, ""), { status: res.status, statusText: res.statusText, headers }));
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(offlinePage));
    return;
  }
  // Immutable build assets and fonts: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/rive/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
