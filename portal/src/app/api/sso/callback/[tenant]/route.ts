import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { getSession } from "@/server/auth/viewer";
import { isPrivileged } from "@/server/auth/permissions";
import { emailDomain } from "@/server/auth/sso-routing";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { SSO_STATE_COOKIE, discover, exchangeCode, openState, verifyIdToken } from "@/server/auth/oidc";
import { decryptSecret } from "@/server/crypto";
import { audit } from "@/server/services/audit";
import { clientIp, ipRateKey, userAgent } from "@/server/request";
import { rateLimit } from "@/server/rate-limit";
import { featuresFor, withDefaults } from "@/lib/tenant-defaults";
import { TENANT_SLUG_RE } from "@/server/services/tenants";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";

const emailSchema = z.email().max(254);

/** Display name from the usual OpenID claims, else the part of the email before "@". */
function nameFrom(claims: Record<string, unknown>, email: string): string {
  const full = typeof claims.name === "string" ? claims.name.trim() : "";
  const parts = [claims.given_name, claims.family_name].filter((p): p is string => typeof p === "string" && !!p.trim()).join(" ");
  const name = full || parts || email.split("@")[0];
  return (name.length >= 2 ? name : email).slice(0, 120);
}

/** Return leg of single sign-on (OpenID Connect): checks the answer, then signs the person in. */
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const url = new URL(request.url);
  const jar = await cookies();
  const state = openState(jar.get(SSO_STATE_COOKIE)?.value);
  // One attempt per cookie. Deleting a __Host- cookie needs the same Secure and Path attributes.
  jar.delete({ name: SSO_STATE_COOKIE, path: "/", secure: env.isProd, httpOnly: true, sameSite: "lax" });
  const failed = state?.test ? "/admin/settings?tab=identity&ssoTest=failed" : "/sign-in?error=sso";
  // The slug is checked before it reaches the database (a NUL byte or an over-long value would make the query throw).
  if (!state || state.tenant !== slug || !TENANT_SLUG_RE.test(slug) || url.searchParams.get("state") !== state.state) redirect(failed);
  // Each return asks the provider for the token and its keys: limited per client and per organisation, like the start.
  const ip = await clientIp();
  if ((ip && !(await rateLimit(`sso-callback:${ipRateKey(ip)}`, 60, 60_000)).ok) || !(await rateLimit(`sso-callback:t:${slug}`, 600, 60_000)).ok) {
    return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
  }

  const [row] = await db()
    .select({ id: t.tenants.id, slug: t.tenants.slug, domain: t.tenants.domain, domainVerifiedAt: t.tenants.domainVerifiedAt, plan: t.tenants.plan, features: t.tenants.features, settings: t.tenants.settings })
    .from(t.tenants)
    .where(eq(t.tenants.slug, slug));
  const tenant = row ? { ...row, settings: withDefaults(row.settings) } : undefined;
  const sso = tenant?.settings.identity.sso;
  if (!tenant || !sso || sso.protocol !== "oidc" || !sso.issuer || !sso.clientId) redirect(failed);

  let email: string | null = null;
  let name = "";
  /** The provider's account, "<issuer> <sub>": the person's identity, bound to the account at the first sign-in. */
  let subject = "";
  let reason = "";
  /** The provider's `locale` claim ("ru", "en-GB"), as a language code. */
  let claimedLocale = "";
  try {
    const code = url.searchParams.get("code");
    if (!code) {
      const providerError = url.searchParams.get("error") ?? "";
      throw new Error(/^[a-z_]{1,40}$/.test(providerError) ? `provider_${providerError}` : "no_code");
    }
    const provider = await discover(sso.issuer);
    const idToken = await exchangeCode(provider, {
      code,
      redirectUri: `${appUrl()}/api/sso/callback/${tenant.slug}`,
      clientId: sso.clientId,
      clientSecret: decryptSecret(sso.clientSecretEnc),
      verifier: state.verifier,
    });
    const claims = await verifyIdToken(provider, idToken, { clientId: sso.clientId, nonce: state.nonce });
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new Error("no_subject");
    subject = `${sso.issuer} ${claims.sub}`;
    const claimName = sso.emailClaim?.trim() || "email";
    // The standard claim counts only when the provider vouches for it (email_verified). Naming another claim in Settings
    // is the organisation's explicit trust in it and skips that check; the subject binding below still ties the account
    // to one provider identity, so a reassigned address alone no longer opens someone else's account.
    if (claimName === "email" && claims.email_verified !== true) throw new Error("email_not_verified");
    const value = claims[claimName];
    const parsed = emailSchema.safeParse(typeof value === "string" ? value.trim().toLowerCase() : "");
    if (!parsed.success) throw new Error("no_email_claim");
    email = parsed.data;
    name = nameFrom(claims, email);
    claimedLocale = typeof claims.locale === "string" ? claims.locale.slice(0, 2).toLowerCase() : "";
  } catch (error) {
    reason = error instanceof Error ? error.message.slice(0, 60) : "error";
  }

  if (state.test) {
    const v = await getSession();
    if (v && v.tenant.id === tenant.id) await audit(db(), { tenantId: tenant.id, actorId: v.user.id, action: "sso.tested", ip, meta: email ? { ok: true, email } : { ok: false, reason } });
    redirect(`/admin/settings?tab=identity&ssoTest=${email ? "ok" : "failed"}`);
  }

  const refuse = async (why: string, actorId: string | null = null): Promise<never> => {
    await audit(db(), { tenantId: tenant.id, actorId, action: "sso.sign_in_refused", ip, meta: { reason: why } });
    redirect("/sign-in?error=sso");
  };
  if (!email) return refuse(reason);
  if (!tenant.settings.identity.ssoEnabled || !featuresFor(tenant.plan, tenant.features).has("sso")) return refuse("sso_off");
  // The provider vouches for the organisation's addresses only while the organisation holds the domain proof (the
  // sign-in page already sends people of an unproven domain to the password step); no account is looked up before it.
  if (!tenant.domainVerifiedAt) return refuse("domain_unproven");

  let [user] = await db().select().from(t.users).where(eq(t.users.email, email));
  // Accounts of another organisation are never touched; administrators always use their password.
  if (user && user.tenantId !== tenant.id) return refuse("other_organisation");
  if (user && isPrivileged(user.role)) return refuse("administrator", user.id);
  if (user && user.status !== "active" && user.status !== "invited") return refuse(user.status, user.id);
  // The address alone does not identify the person: once bound, only the same provider account signs in to it, until an
  // administrator unlinks it (Person → Unlink single sign-on).
  if (user && user.ssoSubject && user.ssoSubject !== subject) return refuse("subject_changed", user.id);
  if (!user) {
    if (!sso.autoCreate) return refuse("unknown_person");
    // The provider vouches only for the organisation's own proven domain.
    if (emailDomain(email) !== tenant.domain?.toLowerCase()) return refuse("foreign_domain");
    // The language the provider knows the person by, else the one they were using here, if the organisation has it on.
    const enabled = (l: string | undefined): l is Locale => isLocale(l) && tenant.settings.locales.includes(l);
    const locale = [claimedLocale, jar.get(LOCALE_COOKIE)?.value].find(enabled) ?? (isLocale(tenant.settings.defaultLocale) ? tenant.settings.defaultLocale : DEFAULT_LOCALE);
    // Created active, so this is also its activation (setStatusAction tells never-activated accounts apart by it).
    [user] = await db().insert(t.users).values({ tenantId: tenant.id, email, name, role: "learner", status: "active", locale, ssoSubject: subject, activatedAt: new Date() }).returning();
    await audit(db(), { tenantId: tenant.id, actorId: user.id, action: "sso.person_created", targetType: "user", targetId: user.id, ip });
  } else if (user.status === "invited") {
    // The organisation's identity provider vouches for the person, so the invitation is complete.
    await db().update(t.users).set({ status: "active", activatedAt: new Date(), ssoSubject: subject }).where(eq(t.users.id, user.id));
  } else if (!user.ssoSubject) {
    // First single sign-on of an existing account: bound to this provider identity from now on.
    await db().update(t.users).set({ ssoSubject: subject }).where(eq(t.users.id, user.id));
  }

  const { token, expiresAt } = await createSession({
    userId: user.id,
    tenantId: tenant.id,
    twoFactorVerified: !user.totpEnabled,
    ip,
    userAgent: await userAgent(),
    maxDevices: tenant.settings.identity.maxDevices ?? null,
  });
  await setSessionCookie(token, expiresAt);
  if (isLocale(user.locale)) jar.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  await audit(db(), { tenantId: tenant.id, actorId: user.id, action: "auth.sign_in", ip, meta: { method: "sso" } });
  redirect(user.totpEnabled ? "/sign-in/verify" : "/app");
}
