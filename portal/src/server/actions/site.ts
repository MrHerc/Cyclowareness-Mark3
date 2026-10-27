"use server";

import { z } from "zod";
import { db, t } from "../db";
import { logFailure } from "../db/errors";
import { rateLimit } from "../rate-limit";
import { clientIp, ipRateKey } from "../request";
import { queueEmail } from "../mail";
import { env } from "../env";
import { COUNTRY_CODES, EMPLOYEE_RANGES } from "../../lib/landing";
import { SITE_LOCALES } from "../../i18n/config";

export type DemoField = "name" | "email" | "organisation" | "country" | "employees" | "message" | "consent";
/** What the visitor submitted, echoed back on a refusal so a server-rendered (no-JS) form keeps it. */
export type DemoValues = { name: string; email: string; organisation: string; country: string; employees: string; message: string; consent: boolean };
/**
 * `fields`: every input the server refused and why, so the form marks all of them at once.
 * `values`: the submitted values on any refusal, so the form can re-render them instead of emptying.
 */
export type DemoState =
  | { ok?: boolean; error?: "invalid" | "rateLimited" | "failed"; fields?: Partial<Record<DemoField, "required" | "email" | "consent">>; values?: DemoValues }
  | undefined;

const FIELDS: readonly string[] = ["name", "email", "organisation", "country", "employees", "message", "consent"];

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  organisation: z.string().trim().min(2).max(200),
  country: z.enum(COUNTRY_CODES as [string, ...string[]]),
  employees: z.enum(EMPLOYEE_RANGES),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal("on"),
  locale: z.enum(SITE_LOCALES),
  consentVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Submitted values to echo back, capped to the field limits and to known select options. */
function echoValues(form: FormData): DemoValues {
  const text = (k: string, max: number) => String(form.get(k) ?? "").slice(0, max);
  const country = text("country", 8);
  const employees = text("employees", 32);
  return {
    name: text("name", 120),
    email: text("email", 254),
    organisation: text("organisation", 200),
    country: COUNTRY_CODES.includes(country) ? country : "",
    employees: (EMPLOYEE_RANGES as readonly string[]).includes(employees) ? employees : "",
    message: text("message", 2000),
    consent: form.get("consent") === "on",
  };
}

const HOUR = 60 * 60_000;

/**
 * The per-client limits refuse first: 5 requests an hour per client network (the address, an IPv6 client by its /64, see
 * ipRateKey) when the address is known, and 3 an hour per email in any case, so a client without a known address
 * (TRUST_PROXY=0 behind a proxy, see env.ts) is limited without any visitor being able to block the form for everyone.
 * Every request that passes then goes through the site-wide ceilings, whether its address is known or not: beyond 100 an
 * hour the request is still stored for the operator console but the sales mail is skipped ("quiet"); beyond a further 400
 * (500 an hour in all) it is not stored either ("drop"). A distributed or address-rotating flood therefore degrades to
 * stored-without-mail and then to dropped, and can flood neither the sales inbox nor the demo_requests table and the
 * operator console. It cannot lock the form for real visitors either: the shared ceilings never refuse, so "quiet" and
 * "drop" both still answer the visitor with success.
 */
async function demoGate(email: string): Promise<"accept" | "quiet" | "drop" | "refuse"> {
  const ip = await clientIp();
  if (ip && !(await rateLimit(`demo:${ipRateKey(ip)}`, 5, HOUR)).ok) return "refuse";
  if (!(await rateLimit(`demo:email:${email}`, 3, HOUR)).ok) return "refuse";
  if ((await rateLimit("demo:all", 100, HOUR)).ok) return "accept";
  return (await rateLimit("demo:all:quiet", 400, HOUR)).ok ? "quiet" : "drop";
}

/** Public demo request from the landing page. Honeypot + rate limit (demoGate); stored for the operator console. The sales mail is sent by the job runner. */
export async function requestDemoAction(_: DemoState, form: FormData): Promise<DemoState> {
  // Bots fill the hidden "website" field; pretend success and store nothing.
  if (String(form.get("website") ?? "").trim()) return { ok: true };
  const raw = {
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    organisation: form.get("organisation"),
    country: form.get("country"),
    employees: form.get("employees"),
    message: String(form.get("message") ?? "").trim() || undefined,
    locale: form.get("locale"),
    consentVersion: form.get("consentVersion"),
    consent: form.get("consent"),
  };
  const p = schema.safeParse(raw);
  if (!p.success) {
    const fields: NonNullable<DemoState>["fields"] = {};
    for (const issue of p.error.issues) {
      const field = String(issue.path[0] ?? "");
      // Hidden fields (locale, consent version) have no input to mark; the form then shows a general error.
      if (!FIELDS.includes(field) || fields[field as DemoField]) continue;
      fields[field as DemoField] = field === "consent" ? "consent" : field === "email" && raw.email ? "email" : "required";
    }
    return { error: Object.keys(fields).length ? "invalid" : "failed", fields, values: echoValues(form) };
  }
  // The gate is inside the try too: its rate-limit buckets live in the database, and a failure there must leave the visitor
  // on the form with what they typed rather than replace the page with the error boundary.
  try {
    const gate = await demoGate(p.data.email);
    if (gate === "refuse") return { error: "rateLimited", values: echoValues(form) };
    // Past the site-wide storage ceiling: answer like a stored request (see demoGate), keep nothing.
    if (gate === "drop") return { ok: true };
    const d = p.data;
    await db().insert(t.demoRequests).values({ name: d.name, email: d.email, organisation: d.organisation, country: d.country, employees: d.employees, message: d.message ?? null, locale: d.locale, consentVersion: d.consentVersion });
    const to = env.SALES_EMAIL;
    if (to && gate === "accept") {
      await queueEmail(db(), null, {
        to,
        subject: `Demo request: ${d.organisation}`,
        text: `${d.name} <${d.email}>\n${d.organisation} · ${d.country} · ${d.employees}\n\n${d.message ?? ""}`,
        kind: "demo",
        // Internal mail to the platform's sales inbox, written in English.
        lang: "en",
      }, { defer: true });
    }
    return { ok: true };
  } catch (error) {
    logFailure("[demo] request failed", error);
    return { error: "failed", values: echoValues(form) };
  }
}
