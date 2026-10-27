import { and, eq, ne } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db, t } from "@/server/db";
import { allowed, getViewer, twoFactorGap } from "@/server/auth/viewer";
import { apiViewer, deniedResponse, rscProbe } from "@/server/auth/api";
import { issueAccountLink } from "@/server/auth/links";
import { listPeople } from "@/server/queries/admin";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { sameOrigin } from "@/server/request";
import { toCsv } from "@/lib/csv";
import { todayInBaku } from "@/lib/time";
import { isLocale, type Locale } from "@/i18n/config";

const TEMPLATE_SAMPLE: Record<Locale, string[]> = {
  az: ["Aysel Məmmədova", "aysel@example.az", "Maliyyə", "Mühasib", "learner", "", "+994501234567", "az"],
  en: ["Aysel Mammadova", "aysel@example.com", "Finance", "Accountant", "learner", "", "+994501234567", "en"],
  ru: ["Айсель Мамедова", "aysel@example.com", "Финансы", "Бухгалтер", "learner", "", "+994501234567", "ru"],
  tr: ["Aysel Memmedova", "aysel@example.com", "Finans", "Muhasebeci", "learner", "", "+994501234567", "tr"],
  ro: ["Aysel Mammadova", "aysel@example.com", "Financiar", "Contabil", "learner", "", "+994501234567", "ro"],
  ka: ["აისელ მამედოვა", "aysel@example.com", "ფინანსები", "ბუღალტერი", "learner", "", "+994501234567", "ka"],
  uk: ["Айсель Мамедова", "aysel@example.com", "Фінанси", "Бухгалтер", "learner", "", "+994501234567", "uk"],
  de: ["Aysel Mammadova", "aysel@example.com", "Finanzen", "Buchhalterin", "learner", "", "+994501234567", "de"],
  fr: ["Aysel Mammadova", "aysel@example.com", "Finance", "Comptable", "learner", "", "+994501234567", "fr"],
  ar: ["آيسل محمدوفا", "aysel@example.com", "المالية", "محاسبة", "learner", "", "+994501234567", "ar"],
};

/** People list export and bulk invite links, as CSV. */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/people/[kind]">) {
  const probe = rscProbe(request);
  if (probe) return probe;
  const { kind } = await params;
  const v = await getViewer();
  if (!v) return deniedResponse(request, 401);
  if (twoFactorGap(v)) return deniedResponse(request, 403, "/profile?section=security&required=1");
  const date = todayInBaku();

  if (kind === "export") {
    if (!allowed(v, "people.read")) return deniedResponse(request, 403);
    if (!(await rateLimit(`people-export:${v.user.id}`, 20, 60 * 60_000)).ok) return new Response("Too many requests", { status: 429 });
    const tc = await getTranslations("common");
    const people = await listPeople(v);
    const csv = toCsv(
      ["name", "email", "department", "job_title", "role", "status", "risk_score", "xp", "last_active", "joined"],
      people.map((p) => [p.name, p.email, p.departmentName ?? "", p.jobTitle ?? "", tc(`roles.${p.role}`), tc(`userStatus.${p.status}`), p.riskScore, p.xp, p.lastActiveAt ?? null, p.createdAt]),
    );
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.exported", meta: { count: people.length } });
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="people-${date}.csv"`, "cache-control": "no-store" } });
  }

  // Generating invite links creates tokens, so it is a POST (see below), never a GET a link could trigger.
  if (kind === "invite-links") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });

  if (kind === "template") {
    // The column names are what the import reads; the sample row is in the admin's language.
    const locale = await getLocale();
    const sample = isLocale(locale) ? TEMPLATE_SAMPLE[locale] : TEMPLATE_SAMPLE.en;
    return new Response(toCsv(["name", "email", "department", "job_title", "role", "manager_email", "phone", "language"], [sample]), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="people-template.csv"` },
    });
  }
  return new Response("Not found", { status: 404 });
}

/** Bulk invite links: fresh 14-day tokens for everyone still invited, as CSV. Same-origin POST only. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/people/[kind]">) {
  const { kind } = await params;
  if (kind !== "invite-links") return new Response("Not found", { status: 404 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const v = await apiViewer("people.write", request);
  if (v instanceof Response) return v;
  if (!(await rateLimit(`people-export:${v.user.id}`, 20, 60 * 60_000)).ok) return new Response("Too many requests", { status: 429 });
  const invited = await db()
    .select({ id: t.users.id, name: t.users.name, email: t.users.email })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "invited"), ne(t.users.role, "super_admin")));
  const rows: string[][] = [];
  for (const u of invited) rows.push([u.name, u.email, await issueAccountLink(u.id, "invite")]);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.invite_links_bulk", meta: { count: rows.length } });
  const date = todayInBaku();
  return new Response(toCsv(["name", "email", "invite_link"], rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="invite-links-${date}.csv"`, "cache-control": "no-store" },
  });
}
