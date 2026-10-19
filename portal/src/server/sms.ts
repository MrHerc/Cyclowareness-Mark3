/**
 * Text messages (sign-in codes, SMS simulations). The provider is chosen by SMS_PROVIDER;
 * without one, development logs the message and production reports it as unavailable.
 * Provider adapters (e.g. Twilio, Vonage, a local operator gateway) plug in here.
 */
export type SmsResult = { ok: true; simulated: boolean } | { ok: false; error: "unavailable" | "failed" };

export function smsAvailable(): boolean {
  return !!process.env.SMS_PROVIDER || process.env.NODE_ENV !== "production";
}

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;
  if (!provider) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "unavailable" };
    console.info(`[sms:simulated] to=${to.replace(/\d(?=\d{4})/g, "•")} text="${text}"`);
    return { ok: true, simulated: true };
  }
  if (provider === "webhook" && process.env.SMS_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN ?? ""}` },
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { ok: true, simulated: false } : { ok: false, error: "failed" };
    } catch {
      return { ok: false, error: "failed" };
    }
  }
  return { ok: false, error: "unavailable" };
}
