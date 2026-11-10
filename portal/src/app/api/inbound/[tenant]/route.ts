import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/server/db";
import { sha256Hex } from "@/server/crypto";
import { rateLimit } from "@/server/rate-limit";
import { recomputeRisk } from "@/server/services/risk";
import { submitThreatReport } from "@/server/services/threats";
import { TENANT_SLUG_RE } from "@/server/services/tenants";
import { featuresFor, withDefaults } from "@/lib/tenant-defaults";

/** The generic JSON shape of a parsed inbound mail (docs/API.md); a provider-specific adapter maps onto it. */
const messageSchema = z.object({
  from: z.string().trim().max(320),
  to: z.string().max(2000).optional(),
  subject: z.string().trim().max(2000).default(""),
  text: z.string().default(""),
  html: z.string().optional(),
});

/** Messages per organisation and minute: a reporting wave after a real attack fits, a mail loop does not (the provider retries a 429). */
const PER_MINUTE = 120;
/**
 * The first tracking link of our own simulations, so the report is matched to that exact recipient (threats.ts).
 * Anchored on the scheme with bounded segments: an unbounded prefix backtracks quadratically on a long base64 image.
 */
const TRACKING_LINK = /https?:\/\/[^\s"'<>/]{1,253}\/(?:[^\s"'<>/]{1,200}\/){0,5}?t\/[a-z2-7]{10,40}/;
const MAX_BODY = 1_000_000;

/** Same answer for a filed report and an ignored sender, so the endpoint never tells who works here. */
const accepted = () => new Response(null, { status: 202 });

function sameHash(stored: string, given: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Inbound report address: the mail provider posts each message forwarded to the organisation's report address. */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const secret = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const [row] =
    secret && TENANT_SLUG_RE.test(slug)
      ? await db().select({ id: t.tenants.id, plan: t.tenants.plan, features: t.tenants.features, settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.slug, slug))
      : [];
  const hash = row ? withDefaults(row.settings).integrations.inboundSecretHash : undefined;
  if (!row || !hash || !secret || !featuresFor(row.plan, row.features).has("integrations") || !sameHash(hash, sha256Hex(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(await rateLimit(`inbound:${row.id}`, PER_MINUTE, 60_000)).ok) return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });

  // Refuse a declared oversize body before buffering it; the length check after reading is the backstop.
  if (Number(request.headers.get("content-length")) > MAX_BODY) return new Response("Payload too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("Payload too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const m = parsed.data;

  // "Name <person@bank.az>" or a bare address.
  const from = (m.from.match(/<([^>]+)>/)?.[1] ?? m.from).trim().toLowerCase();
  const [user] = await db()
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, row.id), eq(t.users.status, "active"), sql`lower(${t.users.email}) = ${from}`));
  // Unknown senders and people over the web form's own limit are dropped without a report or XP.
  if (!user || !(await rateLimit(`threat-report:${user.id}`, 20, 60 * 60_000)).ok) return accepted();

  const url = `${m.text}\n${m.html ?? ""}`.match(TRACKING_LINK)?.[0];
  const res = await submitThreatReport(db(), {
    tenantId: row.id,
    userId: user.id,
    channel: "email",
    subject: m.subject || m.text.trim().slice(0, 120) || "—",
    details: m.text.trim().slice(0, 4000) || null,
    url,
  });
  if (res.simulation) await recomputeRisk(db(), row.id, [user.id]);
  return accepted();
}
