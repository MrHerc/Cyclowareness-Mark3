"use server";

import { z } from "zod";
import { db, t } from "../db";
import { rateLimit } from "../rate-limit";
import { clientIp } from "../request";
import { queueEmail } from "../mail";
import { env } from "../env";
import { COUNTRY_CODES, EMPLOYEE_RANGES } from "../../lib/landing";
import { SITE_LOCALES } from "../../i18n/config";

export type DemoState = { ok?: boolean; error?: "required" | "email" | "rateLimited" | "failed"; field?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  organisation: z.string().trim().min(2).max(200),
  country: z.enum(COUNTRY_CODES as [string, ...string[]]),
  employees: z.enum(EMPLOYEE_RANGES),
  message: z.string().trim().max(2000).optional(),
  locale: z.enum(SITE_LOCALES),
  consentVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Public demo request from the landing page. Honeypot + per-IP limit; stored for the operator console. */
export async function requestDemoAction(_: DemoState, form: FormData): Promise<DemoState> {
  // Bots fill the hidden "website" field; pretend success and store nothing.
  if (String(form.get("website") ?? "").trim()) return { ok: true };
  if (form.get("consent") !== "on") return { error: "required", field: "consent" };
  const raw = {
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    organisation: form.get("organisation"),
    country: form.get("country"),
    employees: form.get("employees"),
    message: String(form.get("message") ?? "").trim() || undefined,
    locale: form.get("locale"),
    consentVersion: form.get("consentVersion"),
  };
  const p = schema.safeParse(raw);
  if (!p.success) {
    const field = String(p.error.issues[0]?.path[0] ?? "");
    return { error: field === "email" && raw.email ? "email" : "required", field };
  }
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`demo:${ip}`, 5, 60 * 60_000).ok) return { error: "rateLimited" };
  try {
    const d = p.data;
    await db().insert(t.demoRequests).values({ name: d.name, email: d.email, organisation: d.organisation, country: d.country, employees: d.employees, message: d.message ?? null, locale: d.locale, consentVersion: d.consentVersion });
    const to = env.SALES_EMAIL;
    if (to) {
      await queueEmail(db(), null, {
        to,
        subject: `Demo request: ${d.organisation}`,
        text: `${d.name} <${d.email}>\n${d.organisation} · ${d.country} · ${d.employees}\n\n${d.message ?? ""}`,
        kind: "demo",
      });
    }
    return { ok: true };
  } catch {
    return { error: "failed" };
  }
}
