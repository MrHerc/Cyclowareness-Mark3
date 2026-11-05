import { ZxcvbnFactory, type ZxcvbnResult } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";

let factory: ZxcvbnFactory | null = null;

/**
 * The words a person's details give away: each value as given, an email's local part and domain
 * name, and every word of three or more letters or digits in them. zxcvbn only recognises a user
 * input as a whole token, so without the split "aysel.mammadova" scores 4 for Aysel Mammadova
 * (aysel.mammadova@company.az) and passes the password rule.
 */
export function personalWords(inputs: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of inputs) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    out.add(value);
    const at = value.lastIndexOf("@");
    const local = at > 0 ? value.slice(0, at) : value;
    if (at > 0) {
      out.add(local);
      // The domain's labels without the top-level one ("company" of company.az).
      for (const label of value.slice(at + 1).split(".").slice(0, -1)) if (label.length >= 3) out.add(label);
    }
    for (const word of local.split(/[^\p{L}\p{N}]+/u)) if (word.length >= 3) out.add(word);
  }
  return [...out];
}

/** zxcvbn estimate (score 0–4). Used on the server for password rules and in the password lesson scene. */
export function checkPassword(password: string, userInputs: string[] = []): ZxcvbnResult {
  factory ??= new ZxcvbnFactory({ dictionary: { ...dictionary }, graphs: adjacencyGraphs });
  return factory.check(password, personalWords(userInputs));
}

export type PassphraseContext = { orgName: string; orgSlug?: string; userName?: string; email?: string };
export const PASSPHRASE_RULES = ["length", "words", "strong", "noCommon"] as const;
export type PassphraseRule = (typeof PASSPHRASE_RULES)[number];

/**
 * The Password Forge lab's rules: one function for the browser checklist and the server verdict,
 * so they never disagree. `score` is the zxcvbn 0-4 rating behind the "strong" rule, for the meter.
 */
export function passphraseRules(passphrase: string, ctx: PassphraseContext): Record<PassphraseRule, boolean> & { score: number } {
  const words = passphrase.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3);
  const banned = [ctx.orgName, ctx.orgSlug, "password", "parol", "пароль", "qwerty", "123456"].filter((x): x is string => !!x).map((x) => x.toLowerCase());
  const inputs = [ctx.userName, ctx.email, ctx.orgName].filter((x): x is string => !!x);
  const lower = passphrase.toLowerCase();
  const score = passphrase ? checkPassword(passphrase, inputs).score : 0;
  return {
    score,
    length: passphrase.length >= 14,
    words: words.length >= 3,
    strong: score >= 4,
    noCommon: !!passphrase && !banned.some((b) => lower.includes(b)),
  };
}
