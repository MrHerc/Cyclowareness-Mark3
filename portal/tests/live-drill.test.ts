import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { DrillView } from "@/server/services/drill";
import admin from "../messages/en/admin.json";
import common from "../messages/en/common.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/server/actions/drill", () => ({ skipDrillAction: async () => null }));

const { LiveDrill } = await import("@/components/admin/drill/live-drill");

const view: DrillView = {
  id: "d1",
  campaignId: "c1",
  status: "running",
  cancelled: false,
  elapsedMs: 0,
  durationMs: 90_000,
  simMinutes: 120,
  simNow: 0,
  template: { key: "payslip", name: "Payslip", channel: "email", difficulty: "Medium", harvest: true, senderName: "Payroll", senderAddress: "payroll@example.test", subject: "Your payslip", moduleTitle: "Phishing email", moduleSlug: "phishing-email" },
  totals: { audience: 1, delivered: 0, opened: 0, clicked: 0, submitted: 0, reported: 0, trained: 0 },
  firstClick: null,
  firstReport: null,
  risk: { before: 40, peak: 40, now: 40, trail: [{ sim: 0, risk: 40 }] },
  benchmark: 0.3,
  people: [{ id: "r1", name: "Person One", initials: "PO", department: null, outcome: "pending", reported: false, trained: false }],
  feed: [],
};

describe("live drill dashboard", () => {
  it("has its reconnecting notice's status region in place before polling fails, so the notice is announced", () => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale: "en", messages: { admin, common } } as ComponentProps<typeof NextIntlClientProvider>, createElement(LiveDrill, { initial: view, canLeadership: false })),
    );
    // Empty while the dashboard is connected: a region inserted together with its text is often not read out.
    expect(html).toMatch(/<span role="status" class="[^"]*text-warn-700[^"]*"><\/span>/);
    expect(html).not.toContain(admin.drill.reconnecting);
  });
});
