import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SITE_LOCALES, isSiteLocale, negotiate, type SiteLocale } from "./i18n/config";

/**
 * Runs before every request. Pages get a strict CSP with a per-request nonce, the public-site
 * language and an optimistic sign-in check (the real check happens in the data access layer);
 * API routes, static files and prefetches only get Strict-Transport-Security.
 */
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cy_session" : "cy_session";
/** Mirrors SESSION_DAYS in server/auth/session.ts (the database renews the row; the cookie must slide too). */
const SESSION_DAYS = 30;
const SESSION_SEEN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cy_session_seen" : "cy_session_seen";
/**
 * The signed-in app (route groups (learner), (focus), (admin), (print)). Only these send an anonymous
 * visitor to sign-in; every other unknown path reaches the app and gets a real 404.
 */
const APP_PREFIXES = ["/admin", "/super", "/learn", "/paths", "/league", "/progress", "/profile", "/lab", "/security", "/sessions", "/help", "/policies", "/print"];
/** Language of `/` by visitor country (Cloudflare's CF-IPCountry) when the browser languages do not match. */
const COUNTRY_LOCALE: Record<string, SiteLocale> = { AZ: "az", TR: "tr", GE: "ka", UA: "uk", RO: "ro", MD: "ro", DE: "de", AT: "de", FR: "fr", IT: "it", RU: "ru", BY: "ru", KZ: "ru", UZ: "ru" };

/** API routes, build assets and public files: no CSP, session redirect or cookies, only HSTS. */
const PASSTHROUGH = /^\/(api\/|_next\/static\/|_next\/image|favicon\.ico$|icons\/|rive\/|brand\/|manifest\.webmanifest$|robots\.txt$|sitemap\.xml$|sw\.js$)/;

function needsSession(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Strict-Transport-Security, read at run time (the image is built once and configured per customer).
 * Subdomains and preload only when the operator opts in (HSTS_INCLUDE_SUBDOMAINS / HSTS_PRELOAD,
 * validated in server/env.ts): they bind every host of the customer's domain for two years.
 */
/**
 * HTTPS-only protections follow the public address: an installation served over plain HTTP (an
 * intranet, a local demo) must not tell browsers to upgrade to an HTTPS port that does not exist.
 */
function servedOverHttps(): boolean {
  return process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");
}

function hsts(): string | null {
  if (!servedOverHttps()) return null;
  const sub = process.env.HSTS_INCLUDE_SUBDOMAINS === "1";
  const preload = sub && process.env.HSTS_PRELOAD === "1";
  return `max-age=63072000${sub ? "; includeSubDomains" : ""}${preload ? "; preload" : ""}`;
}

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' lets the Rive runtime compile its WebAssembly; no JS eval in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are needed for dynamic widths and brand colours; scripts stay locked down.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "media-src 'self' blob:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(servedOverHttps() ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const transport = hsts();

  // Every HTTPS response carries the same HSTS value (scanners flag any response without it, and a
  // different value on assets would undo an opted-in includeSubDomains); nothing else changes here.
  if (PASSTHROUGH.test(pathname) || request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch") {
    const res = NextResponse.next();
    if (transport) res.headers.set("Strict-Transport-Security", transport);
    return res;
  }

  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  if (!hasSession && needsSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    if (transport) res.headers.set("Strict-Transport-Security", transport);
    return res;
  }

  if (pathname === "/" && !hasSession) {
    // Visitors are sent to the public site in their language (signed-in people get their Home).
    // A redirect rather than a rewrite: the answer depends on these request headers, and a cache in
    // front must never serve one visitor's language to the next under the same URL.
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const country = COUNTRY_LOCALE[request.headers.get("cf-ipcountry")?.toUpperCase() ?? ""];
    const locale = isSiteLocale(cookieLocale) ? cookieLocale : negotiate(request.headers.get("accept-language"), SITE_LOCALES, country ?? DEFAULT_LOCALE);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Vary", "Accept-Language, CF-IPCountry, Cookie");
    res.headers.set("Cache-Control", "private, no-store");
    if (transport) res.headers.set("Strict-Transport-Security", transport);
    return res;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  requestHeaders.set("x-pathname", `${pathname}${search}`);
  requestHeaders.delete("x-site-locale");

  const first = pathname.split("/")[1];
  const siteLocale = pathname.split("/").length === 2 && isSiteLocale(first) ? first : null;
  if (siteLocale) requestHeaders.set("x-site-locale", siteLocale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // A language picked on the public site is remembered for the next visit to `/`.
  if (siteLocale && !hasSession && request.cookies.get(LOCALE_COOKIE)?.value !== siteLocale) {
    response.cookies.set(LOCALE_COOKIE, siteLocale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  }

  // Sliding expiry: the session row is renewed on use; the cookie is re-issued once a day so it
  // does not run out 30 days after sign-in regardless of use.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && !request.cookies.get(SESSION_SEEN_COOKIE)) {
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_DAYS * 86_400 });
    response.cookies.set(SESSION_SEEN_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 86_400 });
  }

  response.headers.set("Content-Security-Policy", policy);
  if (transport) response.headers.set("Strict-Transport-Security", transport);
  return response;
}

// Every path, so HSTS reaches API responses, assets and prefetches too (see PASSTHROUGH above).
export const config = {
  matcher: ["/:path*"],
};
