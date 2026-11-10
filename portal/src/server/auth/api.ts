import "server-only";
import { getTranslations } from "next-intl/server";
import { db } from "../db";
import { audit } from "../services/audit";
import { rateLimit } from "../rate-limit";
import { allowed, apiTokenViewer, getViewer, hasFeature, twoFactorGap, type Viewer } from "./viewer";
import type { Permission } from "./permissions";

/*
 * Access checks for route handlers. Kept apart from viewer.ts: the next-intl request config
 * (i18n/request.ts) reads the session through viewer.ts, so viewer.ts must not import next-intl.
 */

/** Requests per token per minute over the reporting API (docs/API.md "Reporting API"). */
export const API_TOKEN_RATE_LIMIT = 60;

/** For route handlers: the viewer, or the response to send when the checks fail (see deniedResponse). */
export async function apiViewer(permission: Permission, request?: Request): Promise<Viewer | Response> {
  const v = await apiCaller(request);
  if (v instanceof Response) return v;
  if (allowed(v, permission)) return v;
  if (!v.apiToken) return deniedResponse(request, 403);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "api_token.refused", targetType: "api_token", targetId: v.apiToken.id, meta: { reason: "forbidden", permission } });
  return new Response("Forbidden", { status: 403 });
}

/**
 * Who calls a route handler, before any permission check: the signed-in person, or the reporting-API
 * token in `Authorization: Bearer <token>` (apiTokenViewer); else the response that refuses the request.
 * A token gets bare statuses (its clients are programs), is rate-limited per token, and its refusal is
 * audited when the token is known; an unknown token names no organisation to write the entry to. The
 * limiter runs before the refusal is audited, so a leaked-then-revoked token cannot flood the audit log.
 * A token is refused while its organisation lacks the `integrations` feature that minting needs.
 */
export async function apiCaller(request?: Request): Promise<Viewer | Response> {
  const probe = request && rscProbe(request);
  if (probe) return probe;
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) {
    const found = await apiTokenViewer(bearer);
    if (!found.ok && found.reason === "unknown") return new Response("Unauthorized", { status: 401 });
    const id = found.ok ? found.viewer.apiToken!.id : found.id;
    const limit = await rateLimit(`api-token:${id}`, API_TOKEN_RATE_LIMIT, 60_000);
    if (!limit.ok) return new Response("Too many requests", { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } });
    if (!found.ok) {
      await audit(db(), { tenantId: found.tenantId, actorId: null, action: "api_token.refused", targetType: "api_token", targetId: id, meta: { reason: found.reason } });
      return new Response("Unauthorized", { status: 401 });
    }
    if (!hasFeature(found.viewer, "integrations")) {
      await audit(db(), { tenantId: found.viewer.tenant.id, actorId: found.viewer.user.id, action: "api_token.refused", targetType: "api_token", targetId: id, meta: { reason: "plan" } });
      return new Response("Forbidden", { status: 403 });
    }
    return found.viewer;
  }
  const v = await getViewer();
  if (!v) return deniedResponse(request, 401);
  if (twoFactorGap(v)) return deniedResponse(request, 403, "/profile?section=security&required=1");
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
