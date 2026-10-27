import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "../src/lib/tenant-defaults";

// A plan or an operator override that switches a feature off refuses its server paths before any database work.
const touched = vi.fn();
const dbStub = new Proxy({}, { get: (_, key) => (touched(key), () => { throw new Error(`database used: ${String(key)}`); }) });
let currentDb: unknown = dbStub;
vi.mock("../src/server/db", async () => ({ db: () => currentDb, t: await import("../src/server/db/schema") }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(), getLocale: async () => "en" }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));
const limit = vi.fn(async (key: string, max: number, windowMs: number) => (void [key, max, windowMs], { ok: true, retryAfterMs: 0 }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: (key: string, max: number, windowMs: number) => limit(key, max, windowMs) }));

const ALL: Feature[] = ["reports", "league", "paths", "support", "feedback", "incidents", "sandbox", "campaigns", "sms_voice", "qr_trap", "threat_intake"];
let features = new Set<Feature>(ALL);
let staff = true;
const viewer = () => ({
  user: { id: "00000000-0000-4000-8000-000000000001", role: "tenant_admin" as const },
  tenant: { id: "00000000-0000-4000-8000-0000000000aa", features, settings: { defaultLocale: "en", identity: { requireAdmin2fa: false } } },
});
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => viewer(),
  allowed: () => staff,
  hasFeature: (v: ReturnType<typeof viewer>, f: Feature) => v.tenant.features.has(f),
}));
vi.mock("../src/server/auth/api", () => ({ apiViewer: async () => viewer(), deniedResponse: async (_: Request, status: number) => new Response(null, { status }) }));

const secops = await import("../src/server/actions/secops");
const reports = await import("../src/server/actions/reports");
const campaigns = await import("../src/server/actions/campaigns");
const security = await import("../src/server/actions/security");
const learning = await import("../src/server/actions/learning");
const engage = await import("../src/server/actions/engage");
const workspace = await import("../src/server/actions/workspace");
const profile = await import("../src/server/actions/profile");
const reportRoute = await import("../src/app/api/admin/reports/[kind]/route");

const ID = "00000000-0000-4000-8000-0000000000bb";
const without = (...off: Feature[]) => {
  features = new Set(ALL.filter((f) => !off.includes(f)));
};

beforeEach(() => {
  features = new Set(ALL);
  staff = true;
  currentDb = dbStub;
  touched.mockReset();
  limit.mockReset().mockResolvedValue({ ok: true, retryAfterMs: 0 });
});

describe("feature flags on server paths", () => {
  it("refuses report downloads, new schedules and their removal without the reports feature", async () => {
    without("reports");
    const res = await reportRoute.GET(new Request("http://localhost/api/admin/reports/completion"), { params: Promise.resolve({ kind: "completion" }) } as never);
    expect(res.status).toBe(404);
    expect(await reports.saveScheduleAction({ kind: "completion", format: "csv", frequency: "weekly", day: 1, recipients: "a@b.test", departmentId: null })).toEqual({ ok: false });
    expect(await reports.removeScheduleAction(ID)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses learning-path changes without the paths feature", async () => {
    without("paths");
    const path = { title: "Path", description: "", audience: "", recurrence: "", standards: "", mandatory: false, moduleSlugs: ["phishing"] };
    expect(await secops.savePathAction(path as never)).toEqual({ ok: false });
    expect(await secops.deletePathAction(ID)).toEqual({ ok: false });
    const assignment = { target: "path" as const, targetId: ID, scope: "everyone" as const, departmentId: null, userId: null, dueKind: "none" as const, dueDate: null, dueDays: null, reason: null };
    expect(await workspace.createAssignmentAction(assignment)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses incident changes without the incidents feature", async () => {
    without("incidents");
    expect(await secops.updateIncidentAction(ID, { status: "resolved" })).toEqual({ ok: false });
    expect(await secops.setIncidentTrainingAction(ID, { moduleId: null, minScore: null, dueDate: null, departmentId: null, userIds: [] })).toEqual({ ok: false });
    expect(await secops.assignIncidentTrainingAction(ID)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses support-desk and feedback review without their features", async () => {
    without("support", "feedback");
    expect(await secops.setTicketStatusAction(ID, "closed")).toEqual({ ok: false });
    expect(await secops.reviewFeedbackAction(ID)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses saving a QR-trap campaign without the qr_trap feature", async () => {
    without("qr_trap");
    const draft = { name: "QR test", templateKey: "mfa-qr", audience: "all" as const, departmentId: null, scheduledAt: null };
    expect(await campaigns.saveCampaignAction(draft)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("refuses escalating a sandbox result without the sandbox feature", async () => {
    without("sandbox");
    expect(await security.escalateAnalysisAction(ID)).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });
});

describe("rate limits on learner actions", () => {
  it("limits sandbox escalations per person", async () => {
    limit.mockResolvedValue({ ok: false, retryAfterMs: 1 });
    expect(await security.escalateAnalysisAction(ID)).toEqual({ ok: false });
    expect(limit).toHaveBeenCalledWith("sandbox-escalate:00000000-0000-4000-8000-000000000001", 10, 60 * 60_000);
    expect(touched).not.toHaveBeenCalled();
  });

  it("limits lesson completions per person", async () => {
    limit.mockResolvedValue({ ok: false, retryAfterMs: 1 });
    expect(await learning.completeLessonAction({ slug: "phishing", lessonKey: "l1", seconds: 60, answers: [] })).toEqual({ ok: false, xp: 0 });
    expect(limit).toHaveBeenCalledWith("lesson-complete:00000000-0000-4000-8000-000000000001", 60, 10 * 60_000);
    expect(touched).not.toHaveBeenCalled();
  });

  it("limits deletion requests per person", async () => {
    limit.mockResolvedValue({ ok: false, retryAfterMs: 1 });
    expect(await profile.requestDeletionAction()).toEqual({ ok: false });
    expect(limit).toHaveBeenCalledWith("deletion-request:00000000-0000-4000-8000-000000000001", 5, 60 * 60_000);
    expect(touched).not.toHaveBeenCalled();
  });

  it("limits a requester's ticket replies", async () => {
    // The ticket lookup runs first: it decides whether the caller is the requester or the desk.
    const insert = vi.fn();
    currentDb = { select: () => ({ from: () => ({ where: async () => [{ id: ID, userId: viewer().user.id, status: "open", priority: "low" }] }) }), insert };
    staff = false;
    limit.mockResolvedValue({ ok: false, retryAfterMs: 1 });
    expect(await engage.replyTicketAction(ID, "Still broken")).toEqual({ ok: false });
    expect(limit).toHaveBeenCalledWith("ticket-reply:00000000-0000-4000-8000-000000000001", 30, 60 * 60_000);
    expect(insert).not.toHaveBeenCalled();
  });
});
