import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { getViewer } from "@/server/auth/viewer";
import { deniedResponse } from "@/server/auth/api";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { todayInBaku } from "@/lib/time";
import { riskTitles } from "@/lib/risk-title";

/** "Download my data" (GDPR-style access): profile and learning history as one JSON file. */
export async function GET(request: Request) {
  const v = await getViewer();
  if (!v) return deniedResponse(request, 401);
  if (!(await rateLimit(`export:${v.user.id}`, 5, 60 * 60_000)).ok) return new Response("Too many requests", { status: 429 });
  const uid = v.user.id;
  const [profile] = await db()
    .select({
      name: t.users.name,
      email: t.users.email,
      phone: t.users.phone,
      jobTitle: t.users.jobTitle,
      role: t.users.role,
      locale: t.users.locale,
      xp: t.users.xp,
      streakLongest: t.users.streakLongest,
      riskScore: t.users.riskScore,
      createdAt: t.users.createdAt,
      lastActiveAt: t.users.lastActiveAt,
    })
    .from(t.users)
    .where(eq(t.users.id, uid));
  const [modules, lessons, answers, xp, attestations, certificates, signoffs, reports, risks, labs, tickets] = await Promise.all([
    db().select().from(t.moduleProgress).where(eq(t.moduleProgress.userId, uid)),
    db().select().from(t.lessonProgress).where(eq(t.lessonProgress.userId, uid)),
    db().select({ lessonId: t.answers.lessonId, sceneId: t.answers.sceneId, correct: t.answers.correct, firstTry: t.answers.firstTry, outcome: t.answers.outcome, at: t.answers.at }).from(t.answers).where(eq(t.answers.userId, uid)),
    db().select({ amount: t.xpEvents.amount, reason: t.xpEvents.reason, at: t.xpEvents.at }).from(t.xpEvents).where(eq(t.xpEvents.userId, uid)),
    db().select({ moduleId: t.attestations.moduleId, text: t.attestations.text, locale: t.attestations.locale, at: t.attestations.at }).from(t.attestations).where(eq(t.attestations.userId, uid)),
    db().select({ serial: t.certificates.serial, issuedAt: t.certificates.issuedAt }).from(t.certificates).where(eq(t.certificates.userId, uid)),
    db().select({ versionId: t.policySignoffs.versionId, signedAt: t.policySignoffs.signedAt }).from(t.policySignoffs).where(eq(t.policySignoffs.userId, uid)),
    db().select({ number: t.threatReports.number, channel: t.threatReports.channel, subject: t.threatReports.subject, status: t.threatReports.status, createdAt: t.threatReports.createdAt }).from(t.threatReports).where(eq(t.threatReports.reporterId, uid)),
    db().select({ kind: t.behaviorRisks.kind, title: t.behaviorRisks.title, status: t.behaviorRisks.status, createdAt: t.behaviorRisks.createdAt }).from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, uid)),
    db().select({ exercise: t.labAttempts.exercise, score: t.labAttempts.score, max: t.labAttempts.max, at: t.labAttempts.at }).from(t.labAttempts).where(eq(t.labAttempts.userId, uid)),
    db().select({ number: t.supportTickets.number, subject: t.supportTickets.subject, status: t.supportTickets.status, createdAt: t.supportTickets.createdAt }).from(t.supportTickets).where(eq(t.supportTickets.userId, uid)),
  ]);
  await audit(db(), { tenantId: v.tenant.id, actorId: uid, action: "person.data_downloaded", targetType: "user", targetId: uid });
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), organisation: v.tenant.name, profile, modules, lessons, answers, xp, attestations, certificates, policySignoffs: signoffs, reports, risks: risks.map((r) => ({ ...r, title: riskTitles(r.title) ?? r.title })), lab: labs, supportTickets: tickets },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-data-${todayInBaku()}.json"`,
      "cache-control": "no-store",
    },
  });
}
