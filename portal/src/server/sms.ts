import { env } from "./env";

/**
 * Text messages (sign-in codes, SMS simulations). The provider is chosen by SMS_PROVIDER
 * (validated in env.ts: "webhook" needs SMS_WEBHOOK_URL); without one, development logs the
 * message and production reports it as unavailable.
 * Provider adapters (e.g. Twilio, Vonage, a local operator gateway) plug in here.
 */
/**
 * `down`: the gateway gave no answer (DNS, refused, timeout) or refused service as a whole (5xx,
 * sign-in, rate limit), so other messages would fail the same way; `failed`: it refused this message.
 */
export type SmsResult = { ok: true; simulated: boolean } | { ok: false; error: "unavailable" | "failed" | "down" };

export function smsAvailable(): boolean {
  return !!env.SMS_PROVIDER || !env.isProd;
}

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = env.SMS_PROVIDER;
  if (!provider) {
    if (env.isProd) return { ok: false, error: "unavailable" };
    console.info(`[sms:simulated] to=${to.replace(/\d(?=\d{4})/g, "•")} text="${text}"`);
    return { ok: true, simulated: true };
  }
  if (provider === "webhook" && env.SMS_WEBHOOK_URL) {
    try {
      const res = await fetch(env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...(env.SMS_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}) },
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { ok: true, simulated: false };
      return { ok: false, error: res.status >= 500 || [401, 403, 429].includes(res.status) ? "down" : "failed" };
    } catch {
      // fetch rejects only when no answer came back: unreachable, refused or the timeout.
      return { ok: false, error: "down" };
    }
  }
  return { ok: false, error: "unavailable" };
}
