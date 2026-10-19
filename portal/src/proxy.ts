import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SITE_LOCALES, isSiteLocale, negotiate, type SiteLocale } from "./i18n/config";

/**
 * Runs before every page: strict CSP with a per-request nonce, the public-site language,
 * and an optimistic sign-in check (the real check happens in the data access layer).
 */
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cy_session" : "cy_session";
const PUBLIC_PREFIXES = ["/sign-in", "/account/", "/legal/", "/c/", "/t/", "/q/", "/start", "/offline", "/og/"];
/** Language of `/` by visitor country (Cloudflare's CF-IPCountry) when the browser languages do not match. */
const COUNTRY_LOCALE: Record<string, SiteLocale> = { AZ: "az", TR: "tr", GE: "ka", UA: "uk", RO: "ro", MD: "ro", DE: "de", AT: "de", FR: "fr", IT: "it", RU: "ru", BY: "ru", KZ: "ru", UZ: "ru" };

function isPublic(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`) || pathname === p.replace(/\/$/, ""))) return true;
  const first = pathname.split("/")[1];
  return pathname.split("/").length === 2 && isSiteLocale(first);
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
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  if (!hasSession && !isPublic(pathname) && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  requestHeaders.set("x-pathname", `${pathname}${search}`);
  requestHeaders.delete("x-site-locale");

  let response: NextResponse;
  const first = pathname.split("/")[1];
  if (pathname === "/" && !hasSession) {
    // Visitors get the public site in their language; signed-in people get their Home.
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const country = COUNTRY_LOCALE[request.headers.get("cf-ipcountry")?.toUpperCase() ?? ""];
    const locale = isSiteLocale(cookieLocale) ? cookieLocale : negotiate(request.headers.get("accept-language"), SITE_LOCALES, country ?? DEFAULT_LOCALE);
    requestHeaders.set("x-site-locale", locale);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.headers.set("Vary", "Accept-Language, CF-IPCountry");
  } else {
    const siteLocale = pathname.split("/").length === 2 && isSiteLocale(first) ? first : null;
    if (siteLocale) requestHeaders.set("x-site-locale", siteLocale);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    // A language picked on the public site is remembered for the next visit to `/`.
    if (siteLocale && !hasSession && request.cookies.get(LOCALE_COOKIE)?.value !== siteLocale) {
      response.cookies.set(LOCALE_COOKIE, siteLocale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
    }
  }

  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico|icons/|rive/|brand/|manifest.webmanifest|robots.txt|sitemap.xml|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
