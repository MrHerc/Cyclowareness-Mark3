import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, t } from "./db";
import { templateText } from "../lib/campaigns/templates";

/**
 * Mail security gateways open links before people do (Safe Links, sandboxes, previews).
 * Rendering the page therefore never counts as a click: the click is recorded by a JavaScript
 * beacon from the page (simulationClickAction), which this check still refuses for known scanners.
 */
const SCANNERS = /(bot|crawler|spider|preview|scanner|safelinks|microsoft office|msoffice|outlook|proofpoint|mimecast|barracuda|fortinet|symantec|trend ?micro|sophos|zscaler|curl|wget|python-requests|go-http-client|java\/|okhttp|headless)/i;

export async function isLikelyScanner(): Promise<boolean> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  return !ua || SCANNERS.test(ua) || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch") === true;
}

/** What the landing page shows; it records nothing (see above). */
export async function trackingView(token: string) {
  if (!/^[a-z2-7]{10,40}$/.test(token)) return null;
  const data = await peek(token);
  if (!data) return null;
  const scanner = await isLikelyScanner();
  const [tenant] = await db().select({ name: t.tenants.name }).from(t.tenants).where(eq(t.tenants.id, data.tenantId));
  return {
    org: tenant?.name ?? "",
    flags: data.template.redFlags.map((f) => templateText(f, data.locale)),
    moduleSlug: data.template.moduleSlug,
    // A cancelled campaign records nothing, so it goes straight to the teachable moment; a known
    // scanner never sees the brand-named sign-in form (a gateway would classify the portal as phishing).
    harvest: data.template.harvest && !data.cancelled && !scanner,
    submitted: data.submitted,
    brandName: templateText(data.template.sender.name, data.locale),
    // The recipient's profile language (that of the flags and sender above): /t and /q show the teachable moment in it.
    locale: data.locale,
  };
}

async function peek(token: string) {
  const { TEMPLATE_BY_KEY } = await import("../lib/campaigns/templates");
  const [row] = await db()
    .select({ templateKey: t.campaigns.templateKey, tenantId: t.campaigns.tenantId, status: t.campaigns.status, locale: t.users.locale, submittedAt: t.campaignRecipients.submittedAt })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(eq(t.campaignRecipients.token, token));
  const template = row ? TEMPLATE_BY_KEY.get(row.templateKey) : undefined;
  return row && template ? { tenantId: row.tenantId, template, locale: row.locale, submitted: !!row.submittedAt, cancelled: row.status === "cancelled" } : null;
}
