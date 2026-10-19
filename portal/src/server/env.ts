import "server-only";
import { z } from "zod";

/**
 * Validated server configuration. Every variable is documented in `.env.example`.
 * Missing optional integrations (mail, AI, SMS) degrade to safe local behaviour.
 */
/** Blank lines in .env files mean "not set". */
const blank = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.preprocess(blank, z.url().default("http://localhost:3000")),
  /** 32+ random bytes, used for encrypting stored secrets and signing tokens. */
  APP_SECRET: z.preprocess(blank, z.string().min(32).optional()),
  DATABASE_URL: z.preprocess(blank, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(blank, z.string().optional()),
  ANTHROPIC_MODEL: z.preprocess(blank, z.string().default("claude-opus-5-5")),
  JOBS_ENABLED: z.preprocess(blank, z.enum(["0", "1"]).default("1")),
  /** Development only: show one-time codes on screen instead of sending an SMS. */
  DEV_SHOW_OTP: z.preprocess(blank, z.enum(["0", "1"]).default("0")),
  TRUST_PROXY: z.preprocess(blank, z.enum(["0", "1"]).default("0")),
  /** Where demo requests from the public site are emailed (they are always stored for the operator console). */
  SALES_EMAIL: z.preprocess(blank, z.email().optional()),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
}

const data = parsed.data;
if (data.NODE_ENV === "production" && !data.APP_SECRET) {
  throw new Error("APP_SECRET must be set in production (32+ characters).");
}

export const env = {
  ...data,
  isProd: data.NODE_ENV === "production",
  /** Fixed development secret so local data stays readable between restarts. Never used in production. */
  secret: data.APP_SECRET ?? "dev-only-secret-change-me-dev-only-secret-change-me",
  showOtp: data.NODE_ENV !== "production" && data.DEV_SHOW_OTP === "1",
};
