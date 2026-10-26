/**
 * A same-site path for "return to" redirects (`?next=`). Anything that could leave the site
 * becomes the fallback: other origins ("//evil", "/\evil", "/\t/evil" — browsers drop the tab and
 * read "//"), control characters (which also break the Location header), and the sign-in pages
 * themselves (a loop). Only the path, query and hash of the value are kept. The bare root is the
 * public site, so after signing in it also becomes the fallback: the app Home at /app.
 */
export function safePath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const u = URL.parse(value, "http://n");
  if (!u || u.origin !== "http://n" || u.pathname === "/" || u.pathname.startsWith("/sign-in") || u.pathname === "/login" || u.pathname.startsWith("/login/")) return fallback;
  return u.pathname + u.search + u.hash;
}
