import "server-only";
import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";
import { hmac } from "../crypto";

/**
 * Domain proof (Settings → Branding): the organisation publishes a TXT record with a value only
 * this tenant can know; while it resolves, people with that email domain may use single sign-on.
 */
export const DOMAIN_PROOF_PREFIX = "cyclowareness-verify=";
/** Days the record may be missing before the proof ends. */
export const DOMAIN_PROOF_GRACE_DAYS = 7;

/** A top-level domain is letters, or the ASCII form of an internationalised one (xn--p1ai is .рф). */
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
/** Letters of any script, digits, marks, dots and hyphens: an internationalised name as typed. */
const UNICODE_HOST = /^[\p{L}\p{N}\p{M}.-]+$/u;

/**
 * Lower-cased host name such as agency.gov.az, or null for anything that is not a plain domain.
 * Internationalised names (пример.рф, example.გე) are returned in their ASCII form, as DNS and
 * email addresses carry them. Only such names are converted: the converter also drops whatever
 * follows a "/" or "?", which would turn "example.com/path" into a domain.
 */
export function normaliseHost(value: string): string | null {
  const typed = value.trim().toLowerCase().replace(/\.$/, "");
  const host = /[^\x00-\x7f]/.test(typed) && UNICODE_HOST.test(typed) ? domainToASCII(typed) : typed;
  return HOST.test(host) ? host : null;
}

/** The TXT value to publish, derived from the tenant id with the app secret so it cannot be guessed. */
export function domainProofRecord(tenantId: string, secret: string): string {
  return `${DOMAIN_PROOF_PREFIX}${hmac(tenantId, secret).slice(0, 24)}`;
}

/** Looks for the record on the domain itself and on _cyclowareness.<domain>. Errors and timeouts count as missing. */
export async function domainProofFound(host: string, expected: string): Promise<boolean> {
  const resolver = new Resolver({ timeout: 5_000, tries: 1 });
  const has = async (name: string): Promise<boolean> => {
    try {
      const records = await resolver.resolveTxt(name);
      return records.some((chunks) => chunks.join("").trim() === expected);
    } catch {
      return false;
    }
  };
  const [plain, scoped] = await Promise.all([has(host), has(`_cyclowareness.${host}`)]);
  return plain || scoped;
}
