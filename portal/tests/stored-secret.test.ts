import { describe, expect, it } from "vitest";
import { endpointKey, storedSecretOutcome } from "../src/lib/stored-secret";

describe("endpointKey", () => {
  it("ignores case and surrounding spaces, but not the port", () => {
    expect(endpointKey(" SMTP.Example.az ", 587)).toBe(endpointKey("smtp.example.az", 587));
    expect(endpointKey("smtp.example.az", 587)).not.toBe(endpointKey("smtp.example.az", 465));
    expect(endpointKey(undefined)).toBe(endpointKey(""));
  });
});

describe("storedSecretOutcome", () => {
  const smtp = endpointKey("smtp.example.az", 587);

  it("keeps the secret for the same server, or when nothing is stored", () => {
    expect(storedSecretOutcome({ stored: true, before: smtp, after: endpointKey("SMTP.example.az", 587), needed: true })).toBe("keep");
    expect(storedSecretOutcome({ stored: false, before: smtp, after: endpointKey("mail.attacker.example", 587), needed: true })).toBe("keep");
  });

  it("never keeps it for a different host or port", () => {
    expect(storedSecretOutcome({ stored: true, before: smtp, after: endpointKey("mail.attacker.example", 587), needed: true })).toBe("required");
    expect(storedSecretOutcome({ stored: true, before: smtp, after: endpointKey("smtp.example.az", 2525), needed: true })).toBe("required");
    // The new configuration does not sign in (no user, server removed, SAML): the secret is dropped instead.
    expect(storedSecretOutcome({ stored: true, before: smtp, after: endpointKey("mail.example.az", 587), needed: false })).toBe("drop");
    expect(storedSecretOutcome({ stored: true, before: smtp, after: endpointKey(""), needed: false })).toBe("drop");
  });
});
