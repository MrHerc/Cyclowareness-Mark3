import { ZxcvbnFactory, type ZxcvbnResult } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";

let factory: ZxcvbnFactory | null = null;

/** zxcvbn estimate (score 0–4). Used on the server for password rules and in the password lesson scene. */
export function checkPassword(password: string, userInputs: string[] = []): ZxcvbnResult {
  factory ??= new ZxcvbnFactory({ dictionary: { ...dictionary }, graphs: adjacencyGraphs });
  return factory.check(password, userInputs);
}
