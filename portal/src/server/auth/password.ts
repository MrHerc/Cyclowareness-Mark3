import { hash, verify } from "@node-rs/argon2";
import { checkPassword } from "../../lib/password-strength";

/** Argon2id with the OWASP-recommended baseline (19 MiB, 2 iterations, 1 lane). */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) return false;
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MIN_SCORE = 3;

export function passwordProblem(password: string, userInputs: string[] = []): "short" | "long" | "weak" | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "short";
  if (password.length > 256) return "long";
  if (checkPassword(password, userInputs).score < PASSWORD_MIN_SCORE) return "weak";
  return null;
}
