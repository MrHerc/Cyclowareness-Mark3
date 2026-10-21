import { beforeEach, describe, expect, it, vi } from "vitest";

// Impossible days must be refused before any query: a date column would throw on them (22008).
const touched = vi.fn();
const dbProxy = new Proxy({}, { get: () => (touched(), () => dbProxy) });
vi.mock("../src/server/db", () => ({ db: () => dbProxy, t: new Proxy({}, { get: () => ({}) }) }));
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({ user: { id: "00000000-0000-4000-8000-000000000001", role: "tenant_admin" }, tenant: { id: "00000000-0000-4000-8000-000000000002", features: new Set(["incidents"]), settings: {} } }),
  allowed: () => true,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/services/notify", () => ({ notifyUsers: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/services/secops", () => ({}));
vi.mock("../src/server/services/threats", () => ({}));
vi.mock("../src/server/services/events", () => ({}));
vi.mock("../src/server/sandbox/analyze", () => ({}));
vi.mock("../src/server/ai", async () => ({ lessonDraftSchema: (await import("zod")).z.object({}) }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));

const { createAssignmentAction, updateDueAction } = await import("../src/server/actions/workspace");
const { setIncidentTrainingAction } = await import("../src/server/actions/secops");

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("due dates in server actions", () => {
  beforeEach(() => touched.mockReset());

  it.each(["2026-02-31", "2026-13-01", "2026-00-10"])("refuses %s for a fixed assignment due date", async (day) => {
    expect(await updateDueAction(ID, "fixed", day, null)).toEqual({ ok: false });
    expect(
      await createAssignmentAction({ target: "module", targetId: ID, scope: "everyone", departmentId: null, userId: null, dueKind: "fixed", dueDate: day, dueDays: null, reason: null }),
    ).toEqual({ ok: false });
    expect(await setIncidentTrainingAction(ID, { moduleId: null, minScore: null, dueDate: day, departmentId: null, userIds: [] })).toEqual({ ok: false });
    expect(touched).not.toHaveBeenCalled();
  });
});
