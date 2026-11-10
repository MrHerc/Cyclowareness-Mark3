import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// Server rendering has no app router: the wizard's useRouter() gets the offline player's shim.
vi.mock("next/navigation", () => import("../src/scorm/next-shim"));

const { wizardTemplates } = await import("@/app/(admin)/admin/campaigns/new/wizard-page");
const { CampaignWizard } = await import("@/app/(admin)/admin/campaigns/new/wizard");
const { TEMPLATE_BY_KEY, templateText } = await import("@/lib/campaigns/templates");
const { loadMessages } = await import("@/i18n/messages");
const messages = await loadMessages("en");

const qr = TEMPLATE_BY_KEY.get("mfa-qr")!;

describe("campaign wizard templates (wizard-page.tsx)", () => {
  it("offers no voice template, and QR templates only with qr_trap", () => {
    const without = wizardTemplates(false, undefined, "en");
    expect(without.offered.some((x) => x.channel === "voice")).toBe(false);
    expect(without.offered.map((x) => x.key)).not.toContain("mfa-qr");
    expect(Object.keys(without.previews).sort()).toEqual(without.offered.map((x) => x.key).sort());
    expect(without.template).toBeNull();
    expect(wizardTemplates(true, undefined, "en").offered.map((x) => x.key)).toContain("mfa-qr");
  });

  it("a QR draft reopened on a plan without qr_trap still renders its full preview on the review step", () => {
    const { offered, previews, template } = wizardTemplates(false, qr, "en");
    expect(offered.map((x) => x.key)).not.toContain("mfa-qr");
    expect(template).toEqual({ key: "mfa-qr", name: templateText(qr.name, "en"), channel: "email", difficulty: "Medium" });
    const initial = { id: "c1", name: "", templateKey: "mfa-qr", template, channel: "email" as const, audience: "all" as const, departmentId: null, scheduledAt: null };
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "Asia/Baku" } as ComponentProps<typeof NextIntlClientProvider>,
        createElement(CampaignWizard, { departments: [], smsVoice: false, templates: offered, previews, initial }),
      ),
    );
    expect(html).toContain(renderToStaticMarkup(previews["mfa-qr"].full));
    expect(html).toContain(`placeholder="${templateText(qr.name, "en")}"`);
  });
});
