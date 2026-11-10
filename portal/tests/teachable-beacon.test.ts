import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// The simulation landing page while its click beacon is on the way (a credential-harvest template, first render).
vi.mock("@/server/actions/campaigns", () => ({ simulationClickAction: vi.fn(), simulationSubmitAction: vi.fn() }));
const { TeachableMoment } = await import("@/components/site/teachable");
const { loadMessages } = await import("@/i18n/messages");

describe("simulation landing page, beacon stage", () => {
  it("tells a screen reader that the page is loading, outside the busy block", async () => {
    const messages = await loadMessages("en");
    const page = createElement(TeachableMoment, { token: "abcdefghij", org: "Acme", flags: [], moduleSlug: "phishing-email", harvest: true, alreadySubmitted: false, brandName: "Microsoft", qr: false });
    // createElement's typing wants children among the props; they are passed as the third argument instead.
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "en", messages } as never, page));
    expect(html).toContain(`<p role="status" class="sr-only">${(messages.common as { loading: string }).loading}</p><div aria-busy="true">`);
  });
});
