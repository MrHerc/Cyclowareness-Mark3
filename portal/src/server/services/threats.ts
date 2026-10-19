import { and, count, desc, eq, gte, inArray, isNull, max, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { awardXp } from "./progress";
import { audit } from "./audit";
import { emitEvent } from "./events";
import { TEMPLATE_BY_KEY } from "../../lib/campaigns/templates";
import { REPORT_BONUS_DAILY_CAP, REPORT_BONUS_XP, dayKey } from "../../lib/domain/gamification";

export type ThreatChannel = (typeof t.threatReports.$inferInsert)["channel"];

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Next per-tenant number for a numbered table (reports, sandbox, incidents, tickets). */
export async function nextNumber(db: DB, table: typeof t.threatReports | typeof t.sandboxAnalyses | typeof t.incidents | typeof t.supportTickets, tenantId: string, start: number) {
  const [row] = await db.select({ n: max(table.number) }).from(table).where(eq(table.tenantId, tenantId));
  return Math.max(start, Number(row?.n ?? 0) + 1);
}

/**
 * A learner reports something suspicious. Reports of our own simulations are matched to the
 * campaign (by tracking link or subject) and count towards the reporting score.
 */
export async function submitThreatReport(
  db: DB,
  p: { tenantId: string; userId: string; channel: ThreatChannel; subject: string; details?: string | null; url?: string | null; ip?: string | null },
): Promise<{ number: number; simulation: boolean; xp: number }> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const candidates = await db
    .select({ id: t.campaignRecipients.id, token: t.campaignRecipients.token, reportedAt: t.campaignRecipients.reportedAt, templateKey: t.campaigns.templateKey })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .where(and(eq(t.campaignRecipients.userId, p.userId), gte(t.campaignRecipients.sentAt, since), inArray(t.campaigns.status, ["running", "completed"])))
    .orderBy(desc(t.campaignRecipients.sentAt));
  const subject = normalise(p.subject);
  const match = candidates.find((c) => {
    if (p.url && p.url.includes(`/t/${c.token}`)) return true;
    const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
    if (!tpl) return false;
    return Object.values(tpl.subject).some((s) => {
      const n = normalise(s);
      return n.length > 6 && (subject.includes(n) || n.includes(subject)) && subject.length > 6;
    });
  });

  for (let attempt = 0; ; attempt++) {
    const number = await nextNumber(db, t.threatReports, p.tenantId, 100);
    try {
      await db.insert(t.threatReports).values({
        tenantId: p.tenantId,
        number,
        reporterId: p.userId,
        channel: p.channel,
        subject: p.subject.slice(0, 300),
        details: p.details?.slice(0, 4000) ?? null,
        url: p.url?.slice(0, 2000) ?? null,
        status: match ? "triaged" : "new",
        severity: match ? "low" : null,
        campaignRecipientId: match?.id ?? null,
      });
      let xp = 0;
      if (match && !match.reportedAt) {
        await db.update(t.campaignRecipients).set({ reportedAt: new Date() }).where(and(eq(t.campaignRecipients.id, match.id), isNull(t.campaignRecipients.reportedAt)));
      }
      // Report bonus, capped per day so it can't be farmed.
      const today = dayKey(new Date());
      const [{ n }] = await db
        .select({ n: count() })
        .from(t.xpEvents)
        .where(and(eq(t.xpEvents.userId, p.userId), eq(t.xpEvents.reason, "report"), sql`to_char(${t.xpEvents.at} at time zone 'Asia/Baku', 'YYYY-MM-DD') = ${today}`));
      if (Number(n) < REPORT_BONUS_DAILY_CAP) {
        await awardXp(db, { tenantId: p.tenantId, userId: p.userId, amount: REPORT_BONUS_XP, reason: "report", ref: `TR-${number}` });
        xp = REPORT_BONUS_XP;
      }
      await audit(db, { tenantId: p.tenantId, actorId: p.userId, action: "threat.reported", targetType: "threat_report", targetId: String(number), ip: p.ip ?? null, meta: { channel: p.channel, simulation: !!match } });
      await emitEvent(db, p.tenantId, match ? "simulation.reported" : "threat.reported", { number, channel: p.channel, simulation: !!match });
      if (!match) {
        const analysts = await db
          .select({ id: t.users.id })
          .from(t.users)
          .where(and(eq(t.users.tenantId, p.tenantId), eq(t.users.status, "active"), inArray(t.users.role, ["analyst"])));
        if (analysts.length) {
          await db.insert(t.notifications).values(
            analysts.map((a) => ({ tenantId: p.tenantId, userId: a.id, kind: "threat", title: `TR-${number}`, body: p.subject.slice(0, 140), href: "/admin/threats" })),
          );
        }
      }
      return { number, simulation: !!match, xp };
    } catch (error) {
      if (attempt >= 3) throw error;
    }
  }
}
