/**
 * A stored password or client secret belongs to the server it was entered for (SMTP host and
 * port, SSO issuer, LDAP URL). It must never be sent to a different server: whoever changes the
 * server without typing the secret again could otherwise point the integration at a host they
 * control and receive the stored credential on the next test or send.
 */

/** Comparable form of a server address: trimmed, lower-case, parts joined. */
export function endpointKey(...parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => String(p ?? "").trim().toLowerCase()).join("|");
}

/**
 * What happens to a stored secret when the form is saved without a new one:
 * - "keep": same server (or nothing stored);
 * - "drop": the server changed and the new configuration does not use a secret;
 * - "required": the server changed and the new configuration needs one, so the save is refused.
 */
export function storedSecretOutcome(o: { stored: boolean; before: string; after: string; needed: boolean }): "keep" | "drop" | "required" {
  if (!o.stored || o.before === o.after) return "keep";
  return o.needed ? "required" : "drop";
}
