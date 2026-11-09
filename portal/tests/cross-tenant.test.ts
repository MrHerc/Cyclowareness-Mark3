/**
 * Tenant isolation, generated over the whole surface: two organisations A and B, and for every server
 * action and route handler in tests/fixtures/surface.json a row that calls it as A's administrator with
 * B's ids, slugs and tokens (and as A's learner where a permission is named). Each call must be refused,
 * the learner by the permission gate itself where there is one, and no row of B may change. The first two
 * tests keep the table complete: the fixture must match the live inventory (scripts/inventory-surface.ts)
 * and every entry must have a row. The last block covers the one role scoped inside its organisation: a
 * department head reaches only their own departments.
 */
import { and, eq, getTableColumns, inArray, or, type Column, type SQL } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { can, PERMISSION_FEATURE, type Permission } from "../src/server/auth/permissions";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { inventory } from "../scripts/inventory-surface";
import surface from "./fixtures/surface.json";
import { DB_SETUP_TIMEOUT, TEST_SCENES, addDepartment, addModule, addTenant, addUser, assignEveryone, testDb } from "./helpers/db";

const { db, ready } = testDb();
let viewer: Viewer;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { isProd: false, TRUST_PROXY: 0, secret: "0123456789abcdef0123456789abcdef" }, appUrl: () => "http://localhost:3000" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (o: string | { locale: string; namespace: string }) => {
    const { locale, namespace } = typeof o === "string" ? { locale: "en", namespace: o } : o;
    return createTranslator({ ...(await messagesFor(locale)), namespace: namespace as never });
  },
}));
vi.mock("../src/server/request", () => ({
  clientIp: async () => "127.0.0.1",
  clientIpFrom: () => "127.0.0.1",
  ipRateKey: (ip: string) => ip,
  sameOrigin: () => true,
  sameOriginFrom: () => true,
  userAgent: async () => null,
  currentPath: async () => "/",
}));
const allowed = (v: Viewer, p: Permission) => can(v.user.role, p) && (!PERMISSION_FEATURE[p] || v.tenant.features.has(PERMISSION_FEATURE[p]!));
// The real gates over the fixture's viewer (two-step verification is not under test here).
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async (permission?: Permission) => {
    if (permission && !allowed(viewer, permission)) throw new Error("FORBIDDEN");
    return viewer;
  },
  getViewer: async () => viewer,
  getSession: async () => viewer,
  allowed,
  privileged: allowed,
  hasFeature: (v: Viewer, f: string) => v.tenant.features.has(f as never),
  twoFactorGap: () => false,
}));
vi.mock("../src/server/mail", async (importActual) => ({ ...(await importActual<object>()), queueEmail: vi.fn(async () => 1), sendTestEmail: vi.fn() }));

const adminOverview = await import("../src/server/actions/admin-overview");
const aiTraining = await import("../src/server/actions/ai-training");
const campaigns = await import("../src/server/actions/campaigns");
const drill = await import("../src/server/actions/drill");
const engage = await import("../src/server/actions/engage");
const learning = await import("../src/server/actions/learning");
const people = await import("../src/server/actions/people");
const platform = await import("../src/server/actions/platform");
const policies = await import("../src/server/actions/policies");
const reports = await import("../src/server/actions/reports");
const secops = await import("../src/server/actions/secops");
const security = await import("../src/server/actions/security");
const settings = await import("../src/server/actions/settings");
const workspace = await import("../src/server/actions/workspace");
const captions = await import("../src/app/(focus)/learn/[slug]/[lessonId]/actions");
const usbKit = await import("../src/app/api/admin/campaigns/[id]/usb-kit/route");
const drillRoute = await import("../src/app/api/admin/drill/[id]/route");
const scorm = await import("../src/app/api/admin/modules/[id]/scorm/route");
const peopleRoute = await import("../src/app/api/admin/people/[kind]/route");
const signoffs = await import("../src/app/api/admin/policies/[id]/signoffs/route");
const reportsRoute = await import("../src/app/api/admin/reports/[kind]/route");
const stix = await import("../src/app/api/sandbox/[id]/stix/route");
const subtitles = await import("../src/app/api/subtitles/route");
const demoRequests = await import("../src/app/api/super/demo-requests/route");
const seats = await import("../src/app/api/super/seats/route");
const tutor = await import("../src/app/api/tutor/route");

beforeAll(ready, DB_SETUP_TIMEOUT);

/* ───────── fixture: one organisation with a row in every tenant-scoped table ───────── */

type Org = Awaited<ReturnType<typeof org>>;
let seq = 0;
/** The administrators' own password: the step-up before the account-takeover actions is passed, so the tenant predicate is what refuses. */
const PASSWORD = "Correct-Horse-Battery-9";
const passwordHash = await hashPassword(PASSWORD);

function viewerOf(tenant: typeof t.tenants.$inferSelect, user: typeof t.users.$inferSelect): Viewer {
  return { sessionId: `session-${user.id}`, twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } };
}

async function org() {
  const n = ++seq;
  const base = withDefaults({ defaultLocale: "en" });
  // Every plan feature plus the seed-only live drill, so each gate is passed and the tenant predicate itself is what refuses.
  const tenant = await addTenant(db, { plan: "enterprise_hrm", features: { live_drill: true }, settings: { ...base, email: { ...base.email, enabled: true } } });
  const tenantId = tenant.id;
  const adminUser = await addUser(db, tenantId, { role: "tenant_admin", passwordHash });
  const learnerUser = await addUser(db, tenantId);
  const invited = await addUser(db, tenantId, { status: "invited" });
  const department = await addDepartment(db, tenantId, `Finance ${n}`);
  const mod = await addModule(db, { tenantId, origin: "custom", lessons: 2 });
  // A second language on the first lesson, so captions exist for the organisation's own people (loadCaptionsAction).
  await db.insert(t.lessonContents).values({ lessonId: mod.lessons[0].id, locale: "az", scenes: TEST_SCENES });
  const assignment = await assignEveryone(db, tenantId, mod.id);
  const [policy] = await db.insert(t.policies).values({ tenantId, title: "Acceptable use", createdBy: adminUser.id }).returning();
  const [version] = await db.insert(t.policyVersions).values({ policyId: policy.id, version: 1, title: "Acceptable use", bodyMd: "Use the systems responsibly, always.", publishedAt: new Date() }).returning();
  await db.insert(t.policySignoffs).values({ versionId: version.id, userId: learnerUser.id, ip: "10.0.0.1" });
  const [campaign] = await db.insert(t.campaigns).values({ tenantId, name: "USB drop", channel: "usb", templateKey: "usb-parcel", audience: "all", status: "running" }).returning();
  await db.insert(t.campaignRecipients).values({ campaignId: campaign.id, userId: learnerUser.id, token: `token${n}`.padEnd(26, "a"), sentAt: new Date() });
  const [drillRun] = await db
    .insert(t.drillRuns)
    .values({ tenantId, campaignId: campaign.id, templateKey: "usb-parcel", durationMs: 60_000, simMinutes: 60, events: [], baseline: { avgRisk: 50, scores: {} }, startedAt: new Date() })
    .returning();
  const [report] = await db.insert(t.threatReports).values({ tenantId, number: 100, reporterId: learnerUser.id, channel: "link", subject: "Suspicious link", url: "https://evil.example/login" }).returning();
  const [loop] = await db.insert(t.loops).values({ tenantId, title: "Phishing wave", stage: "analysis", sourceType: "report" }).returning();
  const [material] = await db.insert(t.materials).values({ tenantId, title: "Read this", body: "Check the sender before you click.", origin: "analyst", targetUserIds: [learnerUser.id] }).returning();
  const [incident] = await db
    .insert(t.incidents)
    .values({ tenantId, number: 1, title: "Fake invoices", severity: "high", source: "analyst", iocs: [], mitre: [], targetUserIds: [learnerUser.id], trainingModuleId: mod.id })
    .returning();
  const intel = { tenantId, title: "Advisory", summary: "A summary.", sourceName: "Feed", severity: "high" as const, tags: [], publishedAt: new Date() };
  const [intelThreat] = await db.insert(t.intelItems).values({ ...intel, kind: "threat" }).returning();
  const [intelPolicy] = await db.insert(t.intelItems).values({ ...intel, kind: "policy" }).returning();
  const [ticket] = await db
    .insert(t.supportTickets)
    .values({ tenantId, number: 1001, userId: learnerUser.id, category: "technical", priority: "low", subject: "Help", body: "Please help.", slaDueAt: new Date() })
    .returning();
  await db.insert(t.ticketMessages).values({ ticketId: ticket.id, authorId: learnerUser.id, body: "Please help." });
  const [feedbackRow] = await db.insert(t.feedback).values({ tenantId, userId: learnerUser.id, rating: 4, topic: "platform" }).returning();
  const [problem] = await db.insert(t.problemReports).values({ tenantId, userId: learnerUser.id, message: "The video does not play." }).returning();
  const [path] = await db
    .insert(t.learningPaths)
    .values({ tenantId, key: `own-path-${n}`, title: { en: "Path" }, description: { en: "" }, audience: { en: "" }, recurrence: { en: "" }, standards: [], moduleSlugs: [mod.slug] })
    .returning();
  const [session] = await db.insert(t.liveSessions).values({ tenantId, title: "Briefing", startsAt: new Date(Date.now() + 86_400_000), durationMin: 60, location: "Room 1", host: "Host" }).returning();
  await db.insert(t.sessionRegistrations).values({ sessionId: session.id, userId: learnerUser.id });
  const [schedule] = await db.insert(t.reportSchedules).values({ tenantId, kind: "completion", format: "csv", frequency: "weekly", recipients: ["reports@example.com"], createdBy: adminUser.id }).returning();
  const [sandbox] = await db
    .insert(t.sandboxAnalyses)
    .values({ tenantId, number: 500, kind: "url", objectName: "https://evil.example/login", verdict: "malicious", score: 90, findings: [], iocs: [], mitre: [], submittedBy: learnerUser.id })
    .returning();
  const [mail] = await db.insert(t.outbox).values({ tenantId, to: learnerUser.email, subject: "Welcome", html: "<p>Welcome</p>", text: "Welcome", kind: "welcome", status: "failed" }).returning();
  const watermark = `AAAA-${String(n).padStart(4, "0")}`;
  await db.insert(t.watermarkCodes).values({ code: watermark, tenantId, userId: learnerUser.id });
  await db.insert(t.moduleProgress).values({ userId: learnerUser.id, moduleId: mod.id, status: "awaiting_attestation", percent: 100 });
  await db.insert(t.notifications).values({ tenantId, userId: learnerUser.id, kind: "assignment", title: "Module assigned" });
  return {
    tenant,
    admin: viewerOf(tenant, adminUser),
    learner: viewerOf(tenant, learnerUser),
    userIds: [adminUser.id, learnerUser.id, invited.id],
    invited,
    department,
    mod,
    assignment,
    policy,
    version,
    campaign,
    drillRun,
    report,
    loop,
    material,
    incident,
    intelThreat,
    intelPolicy,
    ticket,
    feedback: feedbackRow,
    problem,
    path,
    session,
    schedule,
    sandbox,
    mail,
    watermark,
  };
}

/**
 * Every row that touches the organisation, over every table of the schema, as one comparable string. A row
 * counts when any of its key columns points at the organisation, so A's own user writing against B's module
 * or lesson (module_progress, lesson_progress) shows up too.
 */
const TABLES: PgTable[] = Object.values(t).flatMap((x) => (x instanceof PgTable ? [x] : []));
async function snapshot(o: Org): Promise<string> {
  const lessonIds = o.mod.lessons.map((l) => l.id);
  const parts: string[] = [];
  for (const table of TABLES) {
    const c: Record<string, Column | undefined> = getTableColumns(table);
    const keys: (SQL | undefined)[] = [
      table === t.tenants ? eq(t.tenants.id, o.tenant.id) : undefined,
      c.tenantId && eq(c.tenantId, o.tenant.id),
      c.userId && inArray(c.userId, o.userIds),
      c.moduleId && eq(c.moduleId, o.mod.id),
      c.lessonId && inArray(c.lessonId, lessonIds),
      c.policyId && eq(c.policyId, o.policy.id),
      c.versionId && eq(c.versionId, o.version.id),
      c.sessionId && eq(c.sessionId, o.session.id),
      c.ticketId && eq(c.ticketId, o.ticket.id),
      c.materialId && eq(c.materialId, o.material.id),
      c.campaignId && eq(c.campaignId, o.campaign.id),
      c.loopId && eq(c.loopId, o.loop.id),
    ];
    const where = or(...keys.filter((k): k is SQL => !!k));
    if (!where) continue; // platform-wide tables: rate limits, job ticks, demo requests
    const rows = await db.select().from(table).where(where);
    parts.push(getTableConfig(table).name, ...rows.map((r) => JSON.stringify(r)).sort());
  }
  return parts.join("\n");
}

/* ───────── the table ───────── */

type Row =
  /** Called with B's ids as A's administrator (and as A's learner when the guard names a permission); every result must be refused. A row that checks a filtered result itself returns null. */
  | { run: (a: Org, b: Org) => Promise<unknown> }
  /** Takes no other organisation's input: called as A's learner only, who must be refused. */
  | { lower: (a: Org) => Promise<unknown> }
  /** Not tenant-scoped (self-service, the platform operator's own console, or public by design), and why. */
  | { na: string };

const SELF = "self-service on the viewer's own account; takes no id";
const PUBLIC = "public, takes no organisation's id";
const req = (path: string, init?: RequestInit) => new Request(`http://localhost:3000${path}`, { ...init, headers: { origin: "http://localhost:3000", ...init?.headers } });
const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const DAY = 86_400_000;
const SESSION = { title: "Briefing", description: "", startsAt: new Date(Date.now() + DAY).toISOString(), durationMin: 60, location: "Room 1", host: "Host", capacity: null };
const PATH = { sourceId: null, title: "Onboarding", description: "", audience: "", recurrence: "", standards: "", mandatory: false, labIds: [] };
const INCIDENT = { title: "Fake invoices", description: "", severity: "high" as const, source: "analyst" as const, confidential: false, live: false, iocs: "", mitre: "", moduleId: null, minScore: null, dueDate: null, departmentId: null, userIds: [], sandboxId: null, assignNow: false };

const ROWS: Record<string, Row> = {
  "server/actions/admin-overview.hideSetupAction": { lower: () => adminOverview.hideSetupAction(true) },
  "server/actions/admin-overview.remindAwaitingAction": { run: (_, b) => adminOverview.remindAwaitingAction(b.mod.id) },
  "server/actions/admin-overview.skipSetupStepAction": { lower: () => adminOverview.skipSetupStepAction("twofa") },
  "server/actions/ai-training.generateTrainingAction": { lower: () => aiTraining.generateTrainingAction({} as never) },
  "server/actions/ai-training.libraryTrainingAction": { lower: () => aiTraining.libraryTrainingAction({} as never) },
  "server/actions/ai-training.saveTrainingDraftAction": { lower: () => aiTraining.saveTrainingDraftAction({} as never) },
  "server/actions/auth.checkEmailAction": { na: PUBLIC },
  "server/actions/auth.forgotPasswordAction": { na: PUBLIC },
  "server/actions/auth.requestPhoneCodeAction": { na: PUBLIC },
  "server/actions/auth.setLocaleAction": { na: SELF },
  "server/actions/auth.setPasswordAction": { na: PUBLIC },
  "server/actions/auth.signInAction": { na: PUBLIC },
  "server/actions/auth.signOutAction": { na: SELF },
  "server/actions/auth.verifyPhoneCodeAction": { na: PUBLIC },
  "server/actions/auth.verifySecondFactorAction": { na: SELF },
  "server/actions/campaigns.launchCampaignAction": { run: (_, b) => campaigns.launchCampaignAction(b.campaign.id) },
  "server/actions/campaigns.saveCampaignAction": {
    run: async (_, b) => [
      await campaigns.saveCampaignAction({ id: b.campaign.id, name: "Payslip", templateKey: "payslip", audience: "all", departmentId: null, scheduledAt: null }),
      await campaigns.saveCampaignAction({ name: "Payslip", templateKey: "payslip", audience: "department", departmentId: b.department.id, scheduledAt: null }),
    ],
  },
  "server/actions/campaigns.setCampaignStatusAction": { run: (_, b) => campaigns.setCampaignStatusAction(b.campaign.id, "cancelled") },
  "server/actions/campaigns.simulationClickAction": { na: "public simulation token: records the click on that token's own recipient, by design" },
  "server/actions/campaigns.simulationSubmitAction": { na: "public simulation token: records the click on that token's own recipient, by design" },
  "server/actions/drill.skipDrillAction": { run: (_, b) => drill.skipDrillAction(b.drillRun.id) },
  "server/actions/drill.startDrillAction": { run: (_, b) => drill.startDrillAction({ templateKey: "payslip", audience: "department", departmentId: b.department.id, speed: "quick" }) },
  "server/actions/engage.createTicketAction": { na: SELF },
  "server/actions/engage.playLabAction": { na: SELF },
  "server/actions/engage.replyTicketAction": { run: (_, b) => engage.replyTicketAction(b.ticket.id, "Any news?") },
  "server/actions/engage.sendFeedbackAction": { na: SELF },
  "server/actions/engage.toggleSessionAction": { run: (_, b) => engage.toggleSessionAction(b.session.id, true) },
  "server/actions/learning.attestModuleAction": { run: (_, b) => learning.attestModuleAction(b.mod.slug) },
  "server/actions/learning.completeLessonAction": { run: (_, b) => learning.completeLessonAction({ slug: b.mod.slug, lessonKey: "lesson-1", answers: [] }) },
  "server/actions/learning.rateModuleAction": { run: (_, b) => learning.rateModuleAction({ slug: b.mod.slug, rating: 5 }) },
  "server/actions/learning.reachSceneAction": { run: (_, b) => learning.reachSceneAction(b.mod.slug, "lesson-1", 1) },
  "server/actions/learning.reportProblemAction": { na: SELF },
  "server/actions/learning.startLessonAction": { run: (_, b) => learning.startLessonAction(b.mod.slug, "lesson-1") },
  "server/actions/notifications.markNotificationsReadAction": { na: SELF },
  "server/actions/people.addPersonAction": { run: (_, b) => people.addPersonAction(undefined, form({ name: "Taylor Example", email: `taylor${++seq}@example.com`, role: "learner", departmentId: b.department.id, locale: "en" })) },
  "server/actions/people.changeRoleAction": { run: (_, b) => people.changeRoleAction(b.learner.user.id, "analyst") },
  "server/actions/people.createLinkAction": { run: (_, b) => steppedUp(people.createLinkAction(b.learner.user.id, "reset", PASSWORD)) },
  "server/actions/people.decideDeletionAction": { run: (_, b) => people.decideDeletionAction(b.learner.user.id, true) },
  "server/actions/people.deletePersonAction": { run: (_, b) => people.deletePersonAction(b.learner.user.id) },
  "server/actions/people.emailInvitesAction": { run: (_, b) => people.emailInvitesAction([b.invited.id]) },
  "server/actions/people.importPeopleAction": { lower: () => people.importPeopleAction("name,email\n", false) },
  "server/actions/people.moveDepartmentAction": {
    run: async (a, b) => [await people.moveDepartmentAction([a.learner.user.id], b.department.id), await people.moveDepartmentAction([b.learner.user.id], a.department.id)],
  },
  "server/actions/people.remindPeopleAction": { run: (_, b) => people.remindPeopleAction([b.learner.user.id]) },
  "server/actions/people.resetTwoFactorAction": { run: (_, b) => steppedUp(people.resetTwoFactorAction(b.learner.user.id, PASSWORD)) },
  "server/actions/people.setStatusAction": { run: (_, b) => people.setStatusAction([b.learner.user.id], "suspended") },
  "server/actions/people.unlinkSsoAction": { run: (_, b) => people.unlinkSsoAction(b.learner.user.id) },
  "server/actions/people.updatePersonAction": { run: (_, b) => people.updatePersonAction(b.learner.user.id, { name: "Renamed Person", locale: "en" }) },
  "server/actions/platform.adminLinkAction": { run: (_, b) => platform.adminLinkAction(b.tenant.id, b.admin.user.id) },
  "server/actions/platform.createTenantAction": { lower: () => platform.createTenantAction({} as never) },
  "server/actions/platform.deleteDemoAction": { lower: () => platform.deleteDemoAction("00000000-0000-4000-8000-000000000001") },
  "server/actions/platform.renameTenantAction": { run: (_, b) => platform.renameTenantAction(b.tenant.id, "Renamed") },
  "server/actions/platform.setDemoStatusAction": { lower: () => platform.setDemoStatusAction("00000000-0000-4000-8000-000000000001", "won") },
  "server/actions/platform.setTenantFeatureAction": { run: (_, b) => platform.setTenantFeatureAction(b.tenant.id, "studio", "off") },
  "server/actions/platform.setTenantPlanAction": { run: (_, b) => platform.setTenantPlanAction(b.tenant.id, "essentials") },
  "server/actions/platform.verifyTenantDomainAction": { run: (_, b) => platform.verifyTenantDomainAction(b.tenant.id, "example.com", true) },
  "server/actions/policies.signPolicyAction": { run: (_, b) => policies.signPolicyAction(undefined, form({ versionId: b.version.id, agree: "on", password: "pw" })) },
  "server/actions/preferences.setPreferencesAction": { na: SELF },
  "server/actions/profile.cancelDeletionAction": { na: SELF },
  "server/actions/profile.changePasswordAction": { na: SELF },
  "server/actions/profile.confirmTotpAction": { na: SELF },
  "server/actions/profile.disableTotpAction": { na: SELF },
  "server/actions/profile.markTourDoneAction": { na: SELF },
  "server/actions/profile.regenerateBackupCodesAction": { na: SELF },
  "server/actions/profile.requestDeletionAction": { na: SELF },
  "server/actions/profile.resetTourAction": { na: SELF },
  "server/actions/profile.setAvatarAction": { na: SELF },
  "server/actions/profile.signOutOtherDevicesAction": { na: SELF },
  "server/actions/profile.startTotpAction": { na: SELF },
  "server/actions/reports.removeScheduleAction": { run: (_, b) => reports.removeScheduleAction(b.schedule.id) },
  "server/actions/reports.saveScheduleAction": { run: (_, b) => reports.saveScheduleAction({ kind: "completion", format: "csv", frequency: "weekly", day: 1, recipients: "reports@example.com", departmentId: b.department.id }) },
  "server/actions/secops.advanceLoopAction": { run: (_, b) => secops.advanceLoopAction(b.loop.id, "feedback", "") },
  "server/actions/secops.analyzeReportUrlAction": { run: (_, b) => secops.analyzeReportUrlAction(b.report.id) },
  "server/actions/secops.assignIncidentTrainingAction": { run: (_, b) => secops.assignIncidentTrainingAction(b.incident.id) },
  "server/actions/secops.closeLoopAction": { run: (_, b) => secops.closeLoopAction(b.loop.id, "") },
  "server/actions/secops.convertPolicyIntelAction": { run: (_, b) => secops.convertPolicyIntelAction(b.intelPolicy.id) },
  "server/actions/secops.convertReportAction": { run: (_, b) => secops.convertReportAction(b.report.id, { title: "Phishing wave", severity: "high", incident: false }) },
  "server/actions/secops.convertThreatIntelAction": { run: (_, b) => secops.convertThreatIntelAction(b.intelThreat.id, { moduleId: null, departmentId: null }) },
  "server/actions/secops.createIncidentAction": {
    run: async (_, b) => {
      const refusedModule = await secops.createIncidentAction({ ...INCIDENT, moduleId: b.mod.id });
      const refusedSandbox = await secops.createIncidentAction({ ...INCIDENT, sandboxId: b.sandbox.id });
      // B's people and department are filtered out of the audience, so A's incident targets nobody.
      const own = await secops.createIncidentAction({ ...INCIDENT, userIds: [b.learner.user.id], departmentId: b.department.id });
      expect(own.ok).toBe(true);
      const [inc] = await db.select({ targets: t.incidents.targetUserIds }).from(t.incidents).where(eq(t.incidents.id, own.id!));
      expect(inc.targets).toEqual([]);
      return [refusedModule, refusedSandbox, null];
    },
  },
  "server/actions/secops.createMaterialAction": {
    run: async (_, b) => {
      const refusedModule = await secops.createMaterialAction({ title: "Read this", body: "Check the sender first.", moduleId: b.mod.id, departmentId: null, requiresTwo: false });
      const own = await secops.createMaterialAction({ title: "Read this", body: "Check the sender first.", moduleId: null, departmentId: b.department.id, requiresTwo: false });
      expect(own.ok).toBe(true);
      const made = await db.select({ targets: t.materials.targetUserIds }).from(t.materials).where(eq(t.materials.createdBy, viewer.user.id));
      expect(made.length).toBeGreaterThan(0);
      expect(made.every((m) => m.targets.length === 0)).toBe(true);
      return [refusedModule, null];
    },
  },
  "server/actions/secops.decideMaterialAction": { run: (_, b) => secops.decideMaterialAction(b.material.id, "approve") },
  "server/actions/secops.deleteModuleAction": { run: (_, b) => secops.deleteModuleAction(b.mod.id) },
  "server/actions/secops.deletePathAction": { run: (_, b) => secops.deletePathAction(b.path.id) },
  "server/actions/secops.deleteSessionAction": { run: (_, b) => secops.deleteSessionAction(b.session.id) },
  "server/actions/secops.dismissReportAction": { run: (_, b) => secops.dismissReportAction(b.report.id) },
  "server/actions/secops.draftLessonAction": { lower: () => secops.draftLessonAction("Phishing basics", "en") },
  "server/actions/secops.editMaterialAction": { run: (_, b) => secops.editMaterialAction(b.material.id, { title: "Edited", body: "Check the sender first." }) },
  "server/actions/secops.reviewFeedbackAction": { run: (_, b) => secops.reviewFeedbackAction(b.feedback.id) },
  "server/actions/secops.savePathAction": {
    run: async (a, b) => [
      await secops.savePathAction({ ...PATH, id: b.path.id, moduleSlugs: [a.mod.slug] }),
      await secops.savePathAction({ ...PATH, id: null, moduleSlugs: [b.mod.slug] }),
      await secops.savePathAction({ ...PATH, id: null, sourceId: b.path.id, moduleSlugs: [b.mod.slug] }),
    ],
  },
  "server/actions/secops.saveSessionAction": { run: (_, b) => secops.saveSessionAction({ ...SESSION, id: b.session.id }) },
  "server/actions/secops.saveStudioLessonAction": { lower: () => secops.saveStudioLessonAction({} as never) },
  "server/actions/secops.setAttendanceAction": { run: (a, b) => secops.setAttendanceAction(b.session.id, a.learner.user.id, true) },
  "server/actions/secops.setIncidentTrainingAction": { run: (_, b) => secops.setIncidentTrainingAction(b.incident.id, { moduleId: null, minScore: null, dueDate: null, departmentId: null, userIds: [] }) },
  "server/actions/secops.setIntelStatusAction": { run: (_, b) => secops.setIntelStatusAction(b.intelThreat.id, "reviewed") },
  "server/actions/secops.setLoopVerdictAction": { run: (_, b) => secops.setLoopVerdictAction(b.loop.id, "benign") },
  "server/actions/secops.setModuleStatusAction": { run: (_, b) => secops.setModuleStatusAction(b.mod.id, "draft") },
  "server/actions/secops.setTicketStatusAction": { run: (_, b) => secops.setTicketStatusAction(b.ticket.id, "closed") },
  "server/actions/secops.triageReportAction": { run: (_, b) => secops.triageReportAction(b.report.id, "low") },
  "server/actions/secops.updateIncidentAction": { run: (_, b) => secops.updateIncidentAction(b.incident.id, { status: "resolved" }) },
  "server/actions/security.analyzeAction": { na: SELF },
  "server/actions/security.escalateAnalysisAction": { run: (_, b) => security.escalateAnalysisAction(b.sandbox.id) },
  "server/actions/security.reportThreatAction": { na: SELF },
  "server/actions/settings.domainProofRecordAction": { lower: () => settings.domainProofRecordAction() },
  "server/actions/settings.grantSupportAccessAction": { lower: () => settings.grantSupportAccessAction() },
  "server/actions/settings.lookupWatermarkAction": { run: (_, b) => settings.lookupWatermarkAction(b.watermark) },
  "server/actions/settings.resendFailedMailAction": { run: (_, b) => settings.resendFailedMailAction(b.mail.id) },
  "server/actions/settings.revokeSupportAccessAction": { lower: () => settings.revokeSupportAccessAction() },
  "server/actions/settings.rotateWebhookSecretAction": { lower: () => settings.rotateWebhookSecretAction() },
  "server/actions/settings.saveAttestationAction": { lower: () => settings.saveAttestationAction("en", "I confirm that I completed this module.") },
  "server/actions/settings.saveBrandingAction": { lower: () => settings.saveBrandingAction({} as never) },
  "server/actions/settings.saveCertificateAction": { lower: () => settings.saveCertificateAction({} as never) },
  "server/actions/settings.saveEmailAction": { lower: () => settings.saveEmailAction({} as never) },
  "server/actions/settings.saveIdentityAction": { lower: () => settings.saveIdentityAction({} as never) },
  "server/actions/settings.saveIntegrationsAction": { lower: () => settings.saveIntegrationsAction({} as never) },
  "server/actions/settings.saveLanguagesAction": { lower: () => settings.saveLanguagesAction("en", ["en"]) },
  "server/actions/settings.saveLearningAction": { lower: () => settings.saveLearningAction({} as never) },
  "server/actions/settings.saveNotificationsAction": { lower: () => settings.saveNotificationsAction({} as never) },
  "server/actions/settings.saveProtectionAction": { lower: () => settings.saveProtectionAction(true, true) },
  "server/actions/settings.saveRetentionAction": { lower: () => settings.saveRetentionAction({} as never) },
  "server/actions/settings.saveTimeZoneAction": { lower: () => settings.saveTimeZoneAction("Asia/Baku") },
  "server/actions/settings.sendTestEventAction": { lower: () => settings.sendTestEventAction() },
  "server/actions/settings.setLogoAction": { lower: () => settings.setLogoAction(null) },
  "server/actions/settings.testEmailAction": { lower: () => settings.testEmailAction("admin@example.com") },
  "server/actions/settings.verifyDomainAction": { lower: () => settings.verifyDomainAction("example.com") },
  "server/actions/settings.verifySimulationDomainAction": { lower: () => settings.verifySimulationDomainAction("admin@example.com") },
  "server/actions/site.requestDemoAction": { na: PUBLIC },
  "server/actions/workspace.archivePolicyAction": { run: (_, b) => workspace.archivePolicyAction(b.policy.id, true) },
  "server/actions/workspace.createAssignmentAction": {
    run: async (a, b) => {
      const base = { scope: "everyone" as const, departmentId: null, userId: null, dueKind: "none" as const, dueDate: null, dueDays: null, reason: null };
      return [
        await workspace.createAssignmentAction({ ...base, target: "module", targetId: b.mod.id }),
        await workspace.createAssignmentAction({ ...base, target: "path", targetId: b.path.id }),
        await workspace.createAssignmentAction({ ...base, target: "module", targetId: a.mod.id, scope: "department", departmentId: b.department.id }),
        await workspace.createAssignmentAction({ ...base, target: "module", targetId: a.mod.id, scope: "user", userId: b.learner.user.id }),
      ];
    },
  },
  "server/actions/workspace.createPolicyAction": { lower: () => workspace.createPolicyAction("Acceptable use") },
  "server/actions/workspace.deleteDepartmentAction": { run: (_, b) => workspace.deleteDepartmentAction(b.department.id) },
  "server/actions/workspace.mergeDepartmentAction": {
    run: async (a, b) => [await workspace.mergeDepartmentAction(b.department.id, a.department.id), await workspace.mergeDepartmentAction(a.department.id, b.department.id)],
  },
  "server/actions/workspace.publishVersionAction": { run: (_, b) => workspace.publishVersionAction({ policyId: b.policy.id, title: "Acceptable use", bodyMd: "Use the systems responsibly, always." }) },
  "server/actions/workspace.remindPolicyAction": { run: (_, b) => workspace.remindPolicyAction(b.version.id) },
  "server/actions/workspace.removeAssignmentAction": { run: (_, b) => workspace.removeAssignmentAction(b.assignment.id) },
  "server/actions/workspace.saveDepartmentAction": {
    run: async (_, b) => [
      await workspace.saveDepartmentAction({ id: b.department.id, name: "Renamed", parentId: null, headUserId: null }),
      await workspace.saveDepartmentAction({ name: "Child", parentId: b.department.id, headUserId: null }),
      await workspace.saveDepartmentAction({ name: "Headed", parentId: null, headUserId: b.learner.user.id }),
    ],
  },
  "server/actions/workspace.setProblemStatusAction": { run: (_, b) => workspace.setProblemStatusAction(b.problem.id, "resolved") },
  "server/actions/workspace.updateDueAction": { run: (_, b) => workspace.updateDueAction(b.assignment.id, "none", null, null) },
  "api/admin/campaigns/[id]/usb-kit:GET": { run: (_, b) => usbKit.GET(req(`/api/admin/campaigns/${b.campaign.id}/usb-kit`), ctx({ id: b.campaign.id })) },
  "api/admin/drill/[id]:GET": { run: (_, b) => drillRoute.GET(req(`/api/admin/drill/${b.drillRun.id}`), ctx({ id: b.drillRun.id })) },
  "api/admin/drill/[id]:POST": { run: (_, b) => drillRoute.POST(req(`/api/admin/drill/${b.drillRun.id}`, { method: "POST" }), ctx({ id: b.drillRun.id })) },
  "api/admin/modules/[id]/scorm:GET": { run: (_, b) => scorm.GET(req(`/api/admin/modules/${b.mod.id}/scorm?locale=en`), ctx({ id: b.mod.id })) },
  "api/admin/people/[kind]:GET": { lower: () => peopleRoute.GET(req("/api/admin/people/export"), ctx({ kind: "export" })) },
  "api/admin/people/[kind]:POST": { lower: () => peopleRoute.POST(req("/api/admin/people/invite-links", { method: "POST" }), ctx({ kind: "invite-links" })) },
  "api/admin/policies/[id]/signoffs:GET": { run: (_, b) => signoffs.GET(req(`/api/admin/policies/${b.policy.id}/signoffs`), ctx({ id: b.policy.id })) },
  "api/admin/reports/[kind]:GET": {
    // A's report filtered by B's department: an empty report, never B's people.
    run: async (_, b) => {
      const res = await reportsRoute.GET(req(`/api/admin/reports/people?d=${b.department.id}`), ctx({ kind: "people" }));
      if (res.status !== 200) return res;
      const csv = await res.text();
      for (const email of [b.admin.user.email, b.learner.user.email]) expect(csv).not.toContain(email);
      return null;
    },
  },
  "api/assets/[id]:GET": { na: "public by design: logos appear on certificates and in emails" },
  "api/health:GET": { na: PUBLIC },
  "api/me/export:GET": { na: SELF },
  "api/qr/[token]:GET": { na: "public simulation token: the QR image of that token's own recipient, by design" },
  "api/sandbox/[id]/stix:GET": { run: (_, b) => stix.GET(req(`/api/sandbox/${b.sandbox.id}/stix`), ctx({ id: b.sandbox.id })) },
  "api/sandbox/upload:POST": { na: SELF },
  "api/sso/callback/[tenant]:GET": { na: PUBLIC },
  "api/sso/start:GET": { na: PUBLIC },
  "api/subtitles:POST": { run: (_, b) => subtitles.POST(req("/api/subtitles", { method: "POST", body: JSON.stringify({ lessonId: b.mod.lessons[0].id, target: "es" }) })) },
  "api/super/demo-requests:GET": { run: () => demoRequests.GET(req("/api/super/demo-requests")) },
  "api/super/seats:GET": { run: () => seats.GET(req("/api/super/seats")) },
  "api/t/[token]/open:GET": { na: "public simulation token: the open pixel of that token's own recipient, by design" },
  "api/tutor:POST": { run: (_, b) => tutor.POST(req("/api/tutor", { method: "POST", body: JSON.stringify({ slug: b.mod.slug, lessonKey: "lesson-1", question: "Why is this unsafe?", locale: "en" }) })) },
  "app/(focus)/learn/[slug]/[lessonId]/actions.loadCaptionsAction": {
    // B's own administrator gets the captions, so the null A gets is the reach filter, not a missing translation.
    run: async (_, b) => {
      const caller = viewer;
      viewer = b.admin;
      expect(await captions.loadCaptionsAction(b.mod.lessons[0].id, "az")).not.toBeNull();
      viewer = caller;
      return captions.loadCaptionsAction(b.mod.lessons[0].id, "az");
    },
  },
  "server/lab/vm-action.completeVmLabAction": { na: SELF },
};

/* ───────── the checks ───────── */

/** Refused: nothing, a 401/403/404, the viewer gate's error, `ok: false`, an `error`, or a count of zero. */
function refused(r: unknown): boolean {
  if (r === undefined || r === null) return true;
  if (r instanceof Response) return r.status === 401 || r.status === 403 || r.status === 404;
  if (r instanceof Error) return r.message === "FORBIDDEN" || r.message === "UNAUTHENTICATED";
  if (typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return o.ok === false || !!o.error || o.count === 0;
}

/** The actor's own password was right, so a refusal of this step-up action has to come from the tenant predicate after it, not from the step-up. */
async function steppedUp<R extends { error?: unknown }>(call: Promise<R>): Promise<R> {
  const r = await call;
  expect(r.error, "the step-up refused the actor's own correct password").toBeUndefined();
  return r;
}

/** The gate's own refusal, which comes before any lookup: actionViewer(<permission>) throws FORBIDDEN, apiViewer(<permission>) answers 403. */
const gateRefused = (r: unknown) => (r instanceof Response ? r.status === 403 : r instanceof Error && r.message === "FORBIDDEN");

const settle = (call: () => Promise<unknown>) => call().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
/** The guard names a permission somewhere (`actionViewer(people.write)`, `getViewer()+allowed(secops.read)`): the learner gets a pass too. */
const PERMISSION = /\(\w/;
/** The gate itself names the permission, so with B's ids the learner must still be refused by the gate and not by the tenant predicate. */
const GATE = /^(actionViewer|apiViewer)\(\w/;
const guards: Record<string, string> = surface;

let A: Org;
let B: Org;
beforeAll(async () => {
  A = await org();
  B = await org();
});

describe("the inventory", () => {
  it("matches the live surface (regenerate with: npx tsx scripts/inventory-surface.ts)", () => {
    expect(inventory()).toEqual(guards);
  });

  it("has a row in this table for every entry, and no row for an entry that no longer exists", () => {
    expect(Object.keys(ROWS).sort()).toEqual(Object.keys(guards).sort());
  });
});

describe("another organisation's ids and a lower role are refused, and nothing of the other organisation changes", () => {
  for (const [key, row] of Object.entries(ROWS)) {
    it(key, async () => {
      if ("na" in row) return;
      const before = await snapshot(B);
      const asAdmin: unknown[] = [];
      const asLearner: unknown[] = [];
      if ("run" in row) {
        viewer = A.admin;
        asAdmin.push(await settle(() => row.run(A, B)));
        if (PERMISSION.test(guards[key])) {
          viewer = A.learner;
          asLearner.push(await settle(() => row.run(A, B)));
        }
      } else {
        viewer = A.learner;
        asLearner.push(await settle(() => row.lower(A)));
      }
      const answered = (r: unknown) => `${key} answered ${r instanceof Response ? r.status : r instanceof Error ? r.message : JSON.stringify(r)}`;
      for (const r of asAdmin.flat()) expect(r, answered(r)).toSatisfy(refused);
      for (const r of asLearner.flat()) expect(r, `as the learner, ${answered(r)}`).toSatisfy(GATE.test(guards[key]) ? gateRefused : refused);
      expect(await snapshot(B), `${key} changed rows of the other organisation`).toBe(before);
    });
  }
});

/* ───────── the one role scoped inside its organisation ───────── */

describe("a department head reaches only their own departments", () => {
  let head: Viewer;
  let sales: typeof t.departments.$inferSelect;
  let financeLearner: typeof t.users.$inferSelect;
  let salesLearner: typeof t.users.$inferSelect;
  const schedule = { kind: "completion", format: "csv", frequency: "weekly", day: 1, recipients: "head@example.com" };

  beforeAll(async () => {
    sales = await addDepartment(db, A.tenant.id, "Sales");
    head = viewerOf(A.tenant, await addUser(db, A.tenant.id, { role: "department_head", departmentId: A.department.id }));
    financeLearner = await addUser(db, A.tenant.id, { departmentId: A.department.id });
    salesLearner = await addUser(db, A.tenant.id, { departmentId: sales.id });
    // Both have the module to confirm (remindAwaitingAction) and, not having completed it, a reminder due (remindPeopleAction).
    await db.insert(t.moduleProgress).values([financeLearner, salesLearner].map((u) => ({ userId: u.id, moduleId: A.mod.id, status: "awaiting_attestation" as const, percent: 100 })));
    viewer = head;
  });

  it("remindPeopleAction reminds the head's own learner and not another department's", async () => {
    expect(await people.remindPeopleAction([salesLearner.id])).toEqual({ count: 0 });
    expect(await people.remindPeopleAction([financeLearner.id])).toEqual({ count: 1 });
  });

  it("remindAwaitingAction notifies only the awaiting people of the head's departments", async () => {
    expect(await adminOverview.remindAwaitingAction(null)).toEqual({ count: 1 });
    const notified = await db
      .select({ userId: t.notifications.userId })
      .from(t.notifications)
      .where(and(eq(t.notifications.tenantId, A.tenant.id), eq(t.notifications.kind, "confirmation_reminder")));
    expect(notified.map((n) => n.userId)).toEqual([financeLearner.id]);
  });

  it("saveScheduleAction accepts the head's own department only, never the whole organisation", async () => {
    expect(await reports.saveScheduleAction({ ...schedule, departmentId: null })).toEqual({ ok: false });
    expect(await reports.saveScheduleAction({ ...schedule, departmentId: sales.id })).toEqual({ ok: false });
    expect(await reports.saveScheduleAction({ ...schedule, departmentId: A.department.id })).toEqual({ ok: true });
  });

  it("removeScheduleAction removes the head's own schedule and not the administrator's", async () => {
    const [own] = await db
      .insert(t.reportSchedules)
      .values({ tenantId: A.tenant.id, kind: "completion", format: "csv", frequency: "weekly", recipients: ["head@example.com"], departmentId: A.department.id, createdBy: head.user.id })
      .returning({ id: t.reportSchedules.id });
    expect(await reports.removeScheduleAction(A.schedule.id)).toEqual({ ok: false });
    expect(await reports.removeScheduleAction(own.id)).toEqual({ ok: true });
  });
});
