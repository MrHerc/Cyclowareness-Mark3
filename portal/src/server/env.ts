import "server-only";
import { z } from "zod";

/**
 * Validated server configuration. Every variable is documented in `.env.example`.
 * Missing optional integrations (mail, AI, SMS) degrade to safe local behaviour.
 */
/** Blank lines in .env files mean "not set". */
const blank = (v: unknown) => (v === "" ? undefined : v);
const flag = (fallback: "0" | "1") => z.preprocess(blank, z.enum(["0", "1"]).default(fallback));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.preprocess(blank, z.url().default("http://localhost:3000")),
    /** Production accepts a plain-HTTP or loopback APP_URL only with this set to 1 (intranet or local test stacks). */
    ALLOW_HTTP_APP_URL: flag("0"),
    /** 32+ random bytes, used for encrypting stored secrets and signing tokens. */
    APP_SECRET: z.preprocess(blank, z.string().min(32).optional()),
    DATABASE_URL: z.preprocess(blank, z.string().optional()),
    /** node-postgres pool size. The job runner holds one connection for its lock while the tick uses others, so at least 2. */
    DATABASE_POOL_MAX: z.preprocess(blank, z.coerce.number().int().min(2).max(100).default(10)),
    /** Production refuses the embedded PGlite database unless this is 1 (single-process demos only). */
    ALLOW_EMBEDDED_DB: flag("0"),
    ANTHROPIC_API_KEY: z.preprocess(blank, z.string().optional()),
    /** AI course generation in the studio. */
    ANTHROPIC_MODEL: z.preprocess(blank, z.string().default("claude-opus-5-5")),
    /** AI tutor only: a small model keeps per-question cost within the price plans. */
    ANTHROPIC_TUTOR_MODEL: z.preprocess(blank, z.string().default("claude-haiku-5-5")),
    JOBS_ENABLED: flag("1"),
    /** Development only: show one-time codes on screen instead of sending an SMS. */
    DEV_SHOW_OTP: flag("0"),
    /**
     * Number of reverse proxies in front of the server that append to X-Forwarded-For (0 = none,
     * proxy headers ignored). The client address is the entry that many places from the right.
     */
    TRUST_PROXY: z.preprocess(blank, z.coerce.number().int().min(0).max(5).default(0)),
    /** Header carrying the client address behind the trusted proxies; x-real-ip only when the proxy overwrites it. */
    CLIENT_IP_HEADER: z.preprocess(blank, z.enum(["x-forwarded-for", "x-real-ip"]).default("x-forwarded-for")),
    /** Where demo requests from the public site are emailed (they are always stored for the operator console). */
    SALES_EMAIL: z.preprocess(blank, z.email().optional()),
    /** Mail server for platform mail that belongs to no organisation (demo requests to SALES_EMAIL). */
    PLATFORM_SMTP_HOST: z.preprocess(blank, z.string().optional()),
    PLATFORM_SMTP_PORT: z.preprocess(blank, z.coerce.number().int().min(1).max(65_535).default(587)),
    /** 1 = implicit TLS (usually port 465); otherwise STARTTLS is required. */
    PLATFORM_SMTP_SECURE: flag("0"),
    PLATFORM_SMTP_USER: z.preprocess(blank, z.string().optional()),
    PLATFORM_SMTP_PASSWORD: z.preprocess(blank, z.string().optional()),
    PLATFORM_MAIL_FROM: z.preprocess(blank, z.email().optional()),
    /** Text messages: "webhook" posts {to, text} to SMS_WEBHOOK_URL. */
    SMS_PROVIDER: z.preprocess(blank, z.enum(["webhook"]).optional()),
    SMS_WEBHOOK_URL: z.preprocess(blank, z.url().optional()),
    SMS_WEBHOOK_TOKEN: z.preprocess(blank, z.string().optional()),
    /** Voice-call simulations need a provider; without one, voice campaigns cannot launch in production. */
    VOICE_PROVIDER: z.preprocess(blank, z.string().optional()),
    /** First start of an empty installation: creates the platform operator (invited) and prints a one-time invitation link. */
    BOOTSTRAP_OPERATOR_EMAIL: z.preprocess(blank, z.email().optional()),
    /** Strict-Transport-Security extras; only for organisations that want every subdomain on HTTPS (and preload listing). */
    HSTS_INCLUDE_SUBDOMAINS: flag("0"),
    HSTS_PRELOAD: flag("0"),
  })
  .superRefine((v, ctx) => {
    if (v.SMS_PROVIDER === "webhook" && !v.SMS_WEBHOOK_URL) ctx.addIssue({ code: "custom", path: ["SMS_WEBHOOK_URL"], message: "required when SMS_PROVIDER=webhook" });
    if (v.PLATFORM_SMTP_HOST && !v.PLATFORM_MAIL_FROM) ctx.addIssue({ code: "custom", path: ["PLATFORM_MAIL_FROM"], message: "required when PLATFORM_SMTP_HOST is set" });
    if (v.HSTS_PRELOAD === "1" && v.HSTS_INCLUDE_SUBDOMAINS !== "1") ctx.addIssue({ code: "custom", path: ["HSTS_PRELOAD"], message: "preload requires HSTS_INCLUDE_SUBDOMAINS=1" });
  });

/**
 * Why a production APP_URL is unusable, or null. `url` is undefined when the variable was not set
 * (the schema default is for development only). Plain HTTP and loopback hosts need `allowHttp`.
 */
export function appUrlProblem(url: string | undefined, allowHttp: boolean): string | null {
  if (url === undefined) return "must be set in production to the public https:// address";
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") return `must be an http(s) address (got ${u.protocol})`;
  if (allowHttp) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host === "0.0.0.0" || /^127\./.test(host)) {
    return `points to the local machine (${u.host}); set it to the public https:// address, or ALLOW_HTTP_APP_URL=1 for a local test stack`;
  }
  if (u.protocol !== "https:") return `must use https:// in production (got ${u.protocol}//${u.host}); set ALLOW_HTTP_APP_URL=1 only for a plain-HTTP intranet or test stack`;
  return null;
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
}

const data = parsed.data;
/** `next build` runs with NODE_ENV=production but must not need secrets; the server refuses to start without one. */
const building = process.env.NEXT_PHASE === "phase-production-build";
if (data.NODE_ENV === "production" && !data.APP_SECRET && !building) {
  throw new Error("APP_SECRET must be set in production (32+ characters).");
}
if (data.NODE_ENV === "production" && !building) {
  const problem = appUrlProblem(blank(process.env.APP_URL) === undefined ? undefined : data.APP_URL, data.ALLOW_HTTP_APP_URL === "1");
  if (problem) throw new Error(`APP_URL ${problem}. It is the public address in every email, SMS, certificate, simulation and sign-in redirect.`);
  if (data.TRUST_PROXY === 0) {
    console.warn(
      "[env] TRUST_PROXY=0: behind a reverse proxy client addresses are unknown, so the per-address sign-in lockout and audit IPs are off and the public demo form falls back to a per-email limit with a site-wide ceiling on the sales mail. Set TRUST_PROXY to the number of proxies in front.",
    );
  }
  if (data.SALES_EMAIL && !data.PLATFORM_SMTP_HOST) {
    console.warn("[env] SALES_EMAIL is set but PLATFORM_SMTP_HOST is not: demo requests are stored for the operator console but not emailed.");
  }
}

export const env = {
  ...data,
  isProd: data.NODE_ENV === "production",
  /** Fixed development secret so local data stays readable between restarts. Never used in production. */
  secret: data.APP_SECRET ?? "dev-only-secret-change-me-dev-only-secret-change-me",
  showOtp: data.NODE_ENV !== "production" && data.DEV_SHOW_OTP === "1",
};

/** Public base URL without a trailing slash, for links in emails, SMS, simulations and reports. */
export function appUrl(): string {
  return env.APP_URL.replace(/\/+$/, "");
}
