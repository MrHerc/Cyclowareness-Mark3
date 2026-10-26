import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { allowed, getSession } from "@/server/auth/viewer";
import { SSO_STATE_COOKIE, codeChallenge, discover, randomValue, sealState } from "@/server/auth/oidc";
import { TENANT_SLUG_RE } from "@/server/services/tenants";
import { featuresFor, withDefaults } from "@/lib/tenant-defaults";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale, negotiate } from "@/i18n/config";

/**
 * Starts single sign-on for an organisation: /api/sso/start?tenant={slug}.
 * With &test=1 an administrator checks the saved settings and returns to Settings with the result.
 * Only OpenID Connect is connected; SAML needs the provider metadata, which is not stored yet.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("tenant") ?? "";
  const test = url.searchParams.get("test") === "1";
  const failed = test ? "/admin/settings?tab=identity&ssoTest=failed" : "/sign-in?error=sso";

  // Anything that is not a slug (empty, too long, a NUL byte the database rejects) is no organisation.
  const [row] = TENANT_SLUG_RE.test(slug)
    ? await db().select({ slug: t.tenants.slug, plan: t.tenants.plan, features: t.tenants.features, settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.slug, slug))
    : [];
  const tenant = row ? { ...row, settings: withDefaults(row.settings) } : undefined;
  if (test) {
    const v = await getSession();
    if (!v || !tenant || v.tenant.slug !== tenant.slug || !allowed(v, "settings.write")) redirect("/sign-in");
  }
  const sso = tenant?.settings.identity.sso;
  if (!tenant || !sso || sso.protocol !== "oidc" || !sso.issuer || !sso.clientId) redirect(failed);
  if (!featuresFor(tenant.plan, tenant.features).has("sso") || (!test && !tenant.settings.identity.ssoEnabled)) redirect(failed);

  const state = randomValue();
  const nonce = randomValue();
  const verifier = randomValue();
  let target: string | null = null;
  try {
    const provider = await discover(sso.issuer);
    const auth = new URL(provider.authorizationEndpoint);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("client_id", sso.clientId);
    auth.searchParams.set("redirect_uri", `${appUrl()}/api/sso/callback/${tenant.slug}`);
    auth.searchParams.set("scope", "openid email profile");
    // The provider's sign-in page in the language the person uses here (OIDC Core 3.1.2.1; Entra ID, Okta and Keycloak honour it).
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    const fallback = isLocale(tenant.settings.defaultLocale) ? tenant.settings.defaultLocale : DEFAULT_LOCALE;
    auth.searchParams.set("ui_locales", isLocale(cookieLocale) ? cookieLocale : negotiate(request.headers.get("accept-language"), LOCALES, fallback));
    auth.searchParams.set("state", state);
    auth.searchParams.set("nonce", nonce);
    auth.searchParams.set("code_challenge", codeChallenge(verifier));
    auth.searchParams.set("code_challenge_method", "S256");
    target = auth.toString();
  } catch {
    target = null;
  }
  if (!target) redirect(failed);

  (await cookies()).set(SSO_STATE_COOKIE, sealState({ state, nonce, verifier, tenant: tenant.slug, test, at: Date.now() }), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  redirect(target);
}
