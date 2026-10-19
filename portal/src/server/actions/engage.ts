"use server";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { awardXp } from "../services/progress";
import { nextNumber } from "../services/threats";
import { audit } from "../services/audit";
import { rateLimit } from "../rate-limit";
import { GAMES, INBOX, LINKS, MFA, isGame, tx } from "../lab/games";
import { checkPassword } from "../../lib/password-strength";
import { dayKey } from "../../lib/domain/gamification";

export type LabResult = { score: number; max: number; xp: number; items: { id: string; correct: boolean; answer: string; why: string }[] } | { error: string };

/** Scores a practice-lab round on the server. XP once per game per day. */
export async function playLabAction(game: string, answers: Record<string, string>): Promise<LabResult> {
  const v = await actionViewer();
  if (!v.tenant.features.has("lab") || !isGame(game)) return { error: "forbidden" };
  if (!rateLimit(`lab:${v.user.id}`, 60, 10 * 60_000).ok) return { error: "rateLimited" };
  const locale = await getLocale();
  let items: { id: string; correct: boolean; answer: string; why: string }[] = [];
  if (game === "inbox-triage") items = INBOX.map((i) => ({ id: i.id, correct: answers[i.id] === i.verdict, answer: i.verdict, why: tx(i.why, locale) }));
  if (game === "link-detective") items = LINKS.map((i) => ({ id: i.id, correct: answers[i.id] === i.verdict, answer: i.verdict, why: tx(i.why, locale) }));
  if (game === "mfa-fatigue") items = MFA.map((i) => ({ id: i.id, correct: answers[i.id] === i.correct, answer: i.correct, why: tx(i.why, locale) }));
  if (game === "password-forge") {
    const pw = String(answers.passphrase ?? "").slice(0, 200);
    const words = pw.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3);
    const banned = [v.tenant.name, v.tenant.slug, "password", "parol", "пароль", "qwerty", "123456"].map((x) => x.toLowerCase());
    const ok = pw.length >= 14 && words.length >= 3 && checkPassword(pw, [v.user.name, v.user.email, v.tenant.name]).score >= 4 && !banned.some((b) => b && pw.toLowerCase().includes(b));
    items = [{ id: "passphrase", correct: ok, answer: "", why: "" }];
  }
  const score = items.filter((i) => i.correct).length;
  const { max, xp: fullXp } = GAMES[game];
  const today = dayKey(new Date());
  const [{ n }] = await db()
    .select({ n: count() })
    .from(t.labAttempts)
    .where(and(eq(t.labAttempts.userId, v.user.id), eq(t.labAttempts.exercise, game), gte(t.labAttempts.at, new Date(Date.now() - 2 * 86_400_000)), sql`to_char(${t.labAttempts.at} at time zone 'Asia/Baku', 'YYYY-MM-DD') = ${today}`));
  const xp = Number(n) === 0 ? Math.round((fullXp * score) / max) : 0;
  await db().insert(t.labAttempts).values({ tenantId: v.tenant.id, userId: v.user.id, exercise: game, score, max, xp });
  if (xp > 0) await awardXp(db(), { tenantId: v.tenant.id, userId: v.user.id, amount: xp, reason: "lab", ref: game });
  refresh();
  return { score, max, xp, items };
}

export async function toggleSessionAction(sessionId: string, register: boolean): Promise<{ ok: boolean; error?: string }> {
  const v = await actionViewer();
  const [s] = await db().select().from(t.liveSessions).where(and(eq(t.liveSessions.id, sessionId), eq(t.liveSessions.tenantId, v.tenant.id)));
  if (!s || s.startsAt < new Date()) return { ok: false };
  if (register) {
    if (s.capacity) {
      const [{ n }] = await db().select({ n: count() }).from(t.sessionRegistrations).where(eq(t.sessionRegistrations.sessionId, s.id));
      if (Number(n) >= s.capacity) return { ok: false, error: "full" };
    }
    await db().insert(t.sessionRegistrations).values({ sessionId: s.id, userId: v.user.id }).onConflictDoNothing();
  } else {
    await db().delete(t.sessionRegistrations).where(and(eq(t.sessionRegistrations.sessionId, s.id), eq(t.sessionRegistrations.userId, v.user.id)));
  }
  refresh();
  return { ok: true };
}

const ticketSchema = z.object({
  category: z.enum(["training", "technical", "account", "security", "other"]),
  priority: z.enum(["low", "medium", "high"]),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
});
const SLA_HOURS = { high: 4, medium: 24, low: 72 } as const;

export type TicketState = { ok?: boolean; number?: number; error?: string } | undefined;

export async function createTicketAction(_: TicketState, form: FormData): Promise<TicketState> {
  const v = await actionViewer();
  const p = ticketSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  if (!rateLimit(`ticket:${v.user.id}`, 10, 60 * 60_000).ok) return { error: "rateLimited" };
  for (let attempt = 0; ; attempt++) {
    const number = await nextNumber(db(), t.supportTickets, v.tenant.id, 1001);
    try {
      const [row] = await db()
        .insert(t.supportTickets)
        .values({ tenantId: v.tenant.id, number, userId: v.user.id, ...p.data, slaDueAt: new Date(Date.now() + SLA_HOURS[p.data.priority] * 3_600_000) })
        .returning({ id: t.supportTickets.id });
      await db().insert(t.ticketMessages).values({ ticketId: row.id, authorId: v.user.id, body: p.data.body });
      await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "ticket.created", targetType: "ticket", targetId: row.id, meta: { number } });
      refresh();
      return { ok: true, number };
    } catch (error) {
      if (attempt >= 3) throw error;
    }
  }
}

export async function replyTicketAction(ticketId: string, body: string): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  const text = body.trim().slice(0, 5000);
  if (text.length < 1) return { ok: false };
  const [ticket] = await db().select().from(t.supportTickets).where(and(eq(t.supportTickets.id, ticketId), eq(t.supportTickets.tenantId, v.tenant.id)));
  const staff = v.user.role === "tenant_admin" || v.user.role === "analyst" || v.user.role === "super_admin";
  if (!ticket || (ticket.userId !== v.user.id && !staff)) return { ok: false };
  await db().insert(t.ticketMessages).values({ ticketId, authorId: v.user.id, body: text });
  const reopened = ticket.userId === v.user.id && (ticket.status === "answered" || ticket.status === "closed");
  const status = ticket.userId === v.user.id ? (reopened ? "open" : ticket.status) : "answered";
  // A reopened ticket gets a fresh response window instead of being overdue at once.
  await db()
    .update(t.supportTickets)
    .set({ status, updatedAt: new Date(), ...(reopened ? { slaDueAt: new Date(Date.now() + SLA_HOURS[ticket.priority] * 3_600_000) } : {}) })
    .where(eq(t.supportTickets.id, ticketId));
  if (staff && ticket.userId !== v.user.id) {
    await db().insert(t.notifications).values({ tenantId: v.tenant.id, userId: ticket.userId, kind: "ticket", title: `#${ticket.number}`, body: text.slice(0, 140), href: `/help/tickets/${ticket.id}` });
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "ticket.replied", targetType: "ticket", targetId: ticket.id });
  }
  refresh();
  return { ok: true };
}

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  topic: z.enum(["module", "platform", "idea"]),
  comment: z.string().trim().max(3000).optional(),
});

export type FeedbackState = { ok?: boolean; error?: string } | undefined;

export async function sendFeedbackAction(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  const v = await actionViewer();
  const p = feedbackSchema.safeParse({ rating: form.get("rating"), topic: form.get("topic"), comment: form.get("comment") || undefined });
  if (!p.success) return { error: "invalid" };
  if (!rateLimit(`feedback:${v.user.id}`, 10, 60 * 60_000).ok) return { error: "rateLimited" };
  const anonymous = form.get("anonymous") === "on";
  await db().insert(t.feedback).values({ tenantId: v.tenant.id, userId: anonymous ? null : v.user.id, rating: p.data.rating, topic: p.data.topic, comment: p.data.comment ?? null });
  return { ok: true };
}
