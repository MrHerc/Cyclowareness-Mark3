import "server-only";
import { Resolver } from "node:dns/promises";
import { hmac } from "../crypto";

/**
 * Domain proof (Settings → Branding): the organisation publishes a TXT record with a value only
 * this tenant can know; while it resolves, people with that email domain may use single sign-on.
 */
export const DOMAIN_PROOF_PREFIX = "cyclowareness-verify=";
/** Days the record may be missing before the proof ends. */
export const DOMAIN_PROOF_GRACE_DAYS = 7;

const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Lower-cased host name such as agency.gov.az, or null for anything that is not a plain domain. */
export function normaliseHost(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
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
