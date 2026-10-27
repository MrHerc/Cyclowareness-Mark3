import "server-only";
import { getTranslations } from "next-intl/server";
import { allowed, getViewer, twoFactorGap, type Viewer } from "./viewer";
import type { Permission } from "./permissions";

/*
 * Access checks for route handlers. Kept apart from viewer.ts: the next-intl request config
 * (i18n/request.ts) reads the session through viewer.ts, so viewer.ts must not import next-intl.
 */

/** For route handlers: the viewer, or the response to send when the checks fail (see deniedResponse). */
export async function apiViewer(permission: Permission, request?: Request): Promise<Viewer | Response> {
  const probe = request && rscProbe(request);
  if (probe) return probe;
  const v = await getViewer();
  if (!v) return deniedResponse(request, 401);
  if (twoFactorGap(v)) return deniedResponse(request, 403, "/profile?section=security&required=1");
  if (!allowed(v, permission)) return deniedResponse(request, 403);
  return v;
}

/**
 * The empty answer to an RSC request (`rsc: 1`) for a route handler, else null. Signing in from a
 * download link ends in a server action's redirect(next), and Next pre-renders that target with this
 * header (createRedirectRenderResult in next/dist/server/app-render/action-handler.js), as the client
 * router does for a <Link>; neither can use a file. An empty 204 makes the browser load the URL itself,
 * so the download (and its audit entry and rate limit) happens once. Called before any other work.
 */
export function rscProbe(request: Request): Response | null {
  return request.headers.get("rsc") === "1" ? new Response(null, { status: 204 }) : null;
}

/** A link opened in the browser (an emailed report, a bookmarked export), as opposed to a fetch from the app. */
function isNavigation(request: Request): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  return mode ? mode === "navigate" : (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * The answer of a route handler that refuses the request. Someone who opened the link in the browser
 * while signed out goes to sign-in (in their own language) and comes back afterwards; one who is signed in
 * but may not see it is sent to `elsewhere` when given (setting up two-step verification), or reads why in
 * their language. Fetches from the app keep the bare status.
 */
export async function deniedResponse(request: Request | undefined, status: 401 | 403, elsewhere?: string): Promise<Response> {
  if (!request || !isNavigation(request)) return new Response(status === 401 ? "Unauthorized" : "Forbidden", { status });
  if (status === 401 || elsewhere) {
    const url = new URL(request.url);
    const location = status === 401 ? `/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}` : elsewhere!;
    return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
  }
  const tr = await getTranslations("common.errors");
  return new Response(tr("forbidden"), { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
