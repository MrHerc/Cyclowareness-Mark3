import type { Role } from "../db/schema";
import { isPrivileged } from "./permissions";

/**
 * Decides where the sign-in form sends someone after the email step: to the organisation's
 * identity provider or to the password step. Pure, so it can be tested without a database.
 */
export type SsoTenant = {
  id: string;
  slug: string;
  domain: string | null;
  domainVerifiedAt: Date | null;
  /** Settings → Sign-in → "Use single sign-on". */
  ssoEnabled: boolean;
  /** The plan (or an override) includes the "sso" feature. */
  ssoFeature: boolean;
  /** OpenID Connect with an issuer and a client ID saved; SAML is not connected. */
  ssoReady: boolean;
  /** "Create learners on first sign-in". */
  autoCreate: boolean;
};

export type SsoPerson = { tenantId: string; role: Role; status: string };

export type SignInStep = { step: "password" } | { step: "sso"; url: string };

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function ssoStartUrl(slug: string): string {
  return `/api/sso/start?tenant=${encodeURIComponent(slug)}`;
}

/**
 * Single sign-on only for a proven domain with SSO switched on. Administrators and the other
 * privileged roles always use their password and two-step code. Unknown people on such a domain
 * go to the provider only when it may create them; everyone else sees the password step, so the
 * answer does not tell whether an account exists.
 */
export function decideSignInStep(email: string, tenant: SsoTenant | null, person: SsoPerson | null): SignInStep {
  const password: SignInStep = { step: "password" };
  const domain = emailDomain(email);
  if (!domain || !tenant) return password;
  if (!tenant.domain || tenant.domain.toLowerCase() !== domain || !tenant.domainVerifiedAt) return password;
  if (!tenant.ssoEnabled || !tenant.ssoFeature || !tenant.ssoReady) return password;
  if (person) {
    if (person.tenantId !== tenant.id || isPrivileged(person.role)) return password;
    if (person.status !== "active" && person.status !== "invited") return password;
  } else if (!tenant.autoCreate) return password;
  return { step: "sso", url: ssoStartUrl(tenant.slug) };
}
