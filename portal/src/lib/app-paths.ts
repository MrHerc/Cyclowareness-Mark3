/**
 * The signed-in app (route groups (learner), (focus), (admin), (print)). Only these send an anonymous
 * visitor to sign-in (src/proxy.ts); every other unknown path reaches the app and gets a real 404.
 */
const APP_PREFIXES = ["/app", "/admin", "/super", "/learn", "/paths", "/league", "/progress", "/profile", "/lab", "/security", "/sessions", "/help", "/policies", "/print"];

export function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
