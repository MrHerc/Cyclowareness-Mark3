import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "../db";
import { avatarSrc } from "../avatar";
import type { Role, TenantBranding, TenantSettings } from "../db/schema";
import { can, PERMISSION_FEATURE, twoFactorRequired, type Permission } from "./permissions";
import { invalidateSession, readSessionToken, renewedExpiry, sessionIdFromToken, shouldRenew } from "./session";
import { sha256Hex } from "../crypto";
import { cookies } from "next/headers";
import { currentPath } from "../request";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSiteLocale } from "../../i18n/config";
import { featuresFor, withDefaults, type Feature } from "../../lib/tenant-defaults";

/** Data access layer: the only way pages and actions learn who is asking. */
export type Viewer = {
  sessionId: string;
  twoFactorVerified: boolean;
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
    jobTitle: string | null;
    departmentId: string | null;
    locale: string;
    /** The photo's address (`/api/avatar/…`, see server/avatar.ts), not the photo. */
    avatarUrl: string | null;
    xp: number;
    streakCurrent: number;
    streakLongest: number;
    streakLastDay: string | null;
    streakFreezes: number;
    riskScore: number;
    soundOn: boolean;
    motion: "full" | "calm" | "still";
    timerPref: "standard" | "more" | "off";
    tourDone: boolean;
    totpEnabled: boolean;
    deletionRequestedAt: Date | null;
    createdAt: Date;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: "essentials" | "professional" | "enterprise_hrm";
    branding: TenantBranding;
    settings: TenantSettings;
    features: Set<Feature>;
  };
  /** Set when the caller is a reporting-API token (apiTokenViewer): allowed() is then limited to its permissions. */
  apiToken?: { id: string; permissions: readonly Permission[] };
};

const SEEN_THROTTLE_MS = 5 * 60_000;

// Listed rather than the whole row: every request looks the session up, and the photo can weigh 300 KB.
const USER_COLUMNS = {
  id: t.users.id,
  tenantId: t.users.tenantId,
  name: t.users.name,
  email: t.users.email,
  phone: t.users.phone,
  role: t.users.role,
  status: t.users.status,
  jobTitle: t.users.jobTitle,
  departmentId: t.users.departmentId,
  locale: t.users.locale,
  avatarUrl: avatarSrc,
  xp: t.users.xp,
  streakCurrent: t.users.streakCurrent,
  streakLongest: t.users.streakLongest,
  streakLastDay: t.users.streakLastDay,
  streakFreezes: t.users.streakFreezes,
  riskScore: t.users.riskScore,
  soundOn: t.users.soundOn,
  motion: t.users.motion,
  timerPref: t.users.timerPref,
  tourDone: t.users.tourDone,
  totpEnabled: t.users.totpEnabled,
  deletionRequestedAt: t.users.deletionRequestedAt,
  createdAt: t.users.createdAt,
};

export const getSession = cache(async (): Promise<Viewer | null> => {
  const token = await readSessionToken();
  if (!token || token.length > 100) return null;
  const id = sessionIdFromToken(token);
  const [row] = await db()
    .select({ session: t.sessions, user: USER_COLUMNS, tenant: t.tenants })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .innerJoin(t.tenants, eq(t.tenants.id, t.sessions.tenantId))
    .where(eq(t.sessions.id, id));
  if (!row) return null;
  const { session, user, tenant } = row;
  if (session.expiresAt.getTime() < Date.now()) {
    await invalidateSession(id);
    return null;
  }
  if (user.status !== "active") return null;

  const now = new Date();
  const renew = shouldRenew(session.expiresAt, session.createdAt);
  if (now.getTime() - session.lastSeenAt.getTime() > SEEN_THROTTLE_MS || renew) {
    await db()
      .update(t.sessions)
      .set({ lastSeenAt: now, ...(renew ? { expiresAt: renewedExpiry(session.createdAt) } : {}) })
      .where(eq(t.sessions.id, id));
    await db().update(t.users).set({ lastActiveAt: now }).where(eq(t.users.id, user.id));
  }

  return toViewer(user, tenant, { sessionId: id, twoFactorVerified: session.twoFactorVerified });
});

/** A user as the viewer queries read it (USER_COLUMNS): the photo's address, not the photo. */
type ViewerUser = Pick<typeof t.users.$inferSelect, Exclude<keyof typeof USER_COLUMNS, "avatarUrl">> & { avatarUrl: string | null };

function toViewer(user: ViewerUser, tenant: typeof t.tenants.$inferSelect, who: Pick<Viewer, "sessionId" | "twoFactorVerified" | "apiToken">): Viewer {
  return {
    ...who,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      jobTitle: user.jobTitle,
      departmentId: user.departmentId,
      locale: user.locale,
      avatarUrl: user.avatarUrl,
      xp: user.xp,
      streakCurrent: user.streakCurrent,
      streakLongest: user.streakLongest,
      streakLastDay: user.streakLastDay,
      streakFreezes: user.streakFreezes,
      riskScore: user.riskScore,
      soundOn: user.soundOn,
      motion: user.motion,
      timerPref: user.timerPref,
      tourDone: user.tourDone,
      totpEnabled: user.totpEnabled,
      deletionRequestedAt: user.deletionRequestedAt,
      createdAt: user.createdAt,
    },
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      branding: tenant.branding,
      settings: withDefaults(tenant.settings),
      features: featuresFor(tenant.plan, tenant.features),
    },
  };
}

export type ApiTokenLookup = { ok: true; viewer: Viewer } | { ok: false; reason: "unknown" } | { ok: false; reason: "revoked" | "expired" | "creator_inactive"; id: string; tenantId: string };

/**
 * The viewer a reporting-API bearer token stands for: its creator, limited to the token's permissions
 * (allowed) and never a session. A refusal names the token when it exists, so the caller can audit it.
 */
export async function apiTokenViewer(token: string): Promise<ApiTokenLookup> {
  if (token.length > 100) return { ok: false, reason: "unknown" };
  const id = sha256Hex(token);
  const [row] = await db()
    .select({ token: t.apiTokens, user: USER_COLUMNS, tenant: t.tenants })
    .from(t.apiTokens)
    .innerJoin(t.users, eq(t.users.id, t.apiTokens.createdBy))
    .innerJoin(t.tenants, eq(t.tenants.id, t.apiTokens.tenantId))
    .where(eq(t.apiTokens.id, id));
  if (!row) return { ok: false, reason: "unknown" };
  const { token: apiToken, user, tenant } = row;
  if (apiToken.revokedAt) return { ok: false, reason: "revoked", id, tenantId: tenant.id };
  const now = new Date();
  if (apiToken.expiresAt <= now) return { ok: false, reason: "expired", id, tenantId: tenant.id };
  if (user.status !== "active") return { ok: false, reason: "creator_inactive", id, tenantId: tenant.id };
  // Stamped before the rate limit and plan checks on purpose: "last used" also shows a revoked-plan or throttled client still calling.
  if (!apiToken.lastUsedAt || now.getTime() - apiToken.lastUsedAt.getTime() > SEEN_THROTTLE_MS) {
    await db().update(t.apiTokens).set({ lastUsedAt: now }).where(eq(t.apiTokens.id, id));
  }
  return { ok: true, viewer: toViewer(user, tenant, { sessionId: "", twoFactorVerified: true, apiToken: { id, permissions: apiToken.permissions } }) };
}

/** Signed in and past two-step verification, or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const v = await getSession();
  if (!v) return null;
  if (v.user.totpEnabled && !v.twoFactorVerified) return null;
  return v;
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getSession();
  if (!v) {
    const path = await currentPath();
    // "/" with an expired or revoked session cookie is a visitor arriving at the site: show the public
    // site (as for visitors without a cookie) instead of the sign-in form.
    if (path === "/") {
      const locale = (await cookies()).get(LOCALE_COOKIE)?.value;
      redirect(`/${isSiteLocale(locale) ? locale : DEFAULT_LOCALE}`);
    }
    redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  }
  if (v.user.totpEnabled && !v.twoFactorVerified) redirect(`/sign-in/verify?next=${encodeURIComponent(await currentPath())}`);
  return v;
}

export function hasFeature(v: Viewer, feature: Feature): boolean {
  return v.tenant.features.has(feature);
}

export function allowed(v: Viewer, permission: Permission): boolean {
  if (v.apiToken && !v.apiToken.permissions.includes(permission)) return false;
  const feature = PERMISSION_FEATURE[permission];
  return can(v.user.role, permission) && (!feature || v.tenant.features.has(feature));
}

/** Two-step verification is mandatory for this user (twoFactorRequired), who has not set it up yet. A machine client has no second step. */
export function twoFactorGap(v: Viewer): boolean {
  return !v.apiToken && twoFactorRequired(v.user.role, v.tenant.settings.identity.requireAdmin2fa) && !v.user.totpEnabled;
}

/** A console permission exercised inside a self-service action: the permission plus the tenant's "admins use 2FA" rule, as actionViewer(permission) applies. */
export function privileged(v: Viewer, permission: Permission): boolean {
  return allowed(v, permission) && !twoFactorGap(v);
}

/** For admin pages: permission + plan feature + the tenant's "admins use 2FA" rule. */
export async function requirePermission(permission: Permission): Promise<Viewer> {
  const v = await requireViewer();
  if (!allowed(v, permission)) notFound();
  if (twoFactorGap(v)) redirect("/profile?section=security&required=1");
  return v;
}

export async function requireFeature(feature: Feature): Promise<Viewer> {
  const v = await requireViewer();
  if (!hasFeature(v, feature)) notFound();
  return v;
}

/**
 * For server actions: same checks, but throws instead of redirecting. Self-service actions
 * (no permission) stay open so a privileged user can still set up 2FA when the tenant requires it.
 */
export async function actionViewer(permission?: Permission): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("UNAUTHENTICATED");
  if (permission && !allowed(v, permission)) throw new Error("FORBIDDEN");
  if (permission && twoFactorGap(v)) throw new Error("TWO_FACTOR_REQUIRED");
  return v;
}
