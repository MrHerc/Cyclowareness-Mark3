import { ZxcvbnFactory, type ZxcvbnResult } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";

let factory: ZxcvbnFactory | null = null;

/** zxcvbn estimate (score 0–4). Used on the server for password rules and in the password lesson scene. */
export function checkPassword(password: string, userInputs: string[] = []): ZxcvbnResult {
  factory ??= new ZxcvbnFactory({ dictionary: { ...dictionary }, graphs: adjacencyGraphs });
  return factory.check(password, userInputs);
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
