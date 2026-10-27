import { describe, expect, it, vi } from "vitest";
import type { DB } from "../src/server/db/client";
import type { Mail } from "../src/server/mail";

const sent: Mail[] = [];
vi.mock("../src/server/mail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/mail")>()),
  queueEmail: vi.fn(async (_db: unknown, _tenantId: unknown, mail: Mail) => {
    sent.push(mail);
    return { id: "1", status: "logged" };
  }),
}));

const { renderEmailHtml } = await import("../src/server/mail");
const { notifyUsers } = await import("../src/server/services/notify");
const { escapeEmailMarkup, parseEmailMarkup, stripEmailMarkup } = await import("../src/lib/email-markup");

describe("email markup escapes", () => {
  it("reads an escaped value as text and gives back its characters", () => {
    const value = "**Bob** _x_ [win](https://evil.test) a\\b: https://evil.test";
    const parsed = parseEmailMarkup(`**Hi** ${escapeEmailMarkup(value)}`);
    expect(parsed).toEqual([
      { kind: "bold", text: "Hi" },
      { kind: "text", text: ` ${value}` },
    ]);
    expect(stripEmailMarkup(escapeEmailMarkup(value))).toBe(value);
  });
});

describe("notification values", () => {
  it("keeps the template's markup and fills names in as text, never as a link or a button", async () => {
    const template = { subject: "For {{name}}", body: "Hi **{{name}}**, [open]({{link}})\n\n{{organisation}}\n\n{{link}}" };
    const tenant = { id: "t1", name: "https://evil.test/org", branding: { primary: "#123456" }, settings: { notifications: { templates: { assignment: { en: template } } } } };
    const person = { id: "u1", name: "[Claim](https://evil.test/prize) Smith", email: "p@acme.test", locale: "en" };
    const results = [[tenant], [person]];
    const db = { select: () => ({ from: () => ({ where: async () => results.shift() }) }) } as unknown as DB;

    await notifyUsers(db, "t1", ["u1"], "assignment", { dueDate: "2026-10-30", link: "/learn/x" });
    const [mail] = sent;
    expect(mail.subject).toBe("For [Claim](https://evil.test/prize)");
    expect(mail.html).toContain("<b>[Claim](https://evil.test/prize)</b>");
    expect(mail.html).not.toContain('href="https://evil.test');
    expect(mail.html).toMatch(/<a href="[^"]*\/learn\/x" style="color:#123456">open<\/a>/);
    // Only the real link became the button; the organisation's name stays a paragraph of text.
    expect(mail.html?.match(/display:inline-block/g)).toHaveLength(1);
    expect(mail.text).toContain("Hi [Claim](https://evil.test/prize), open (");
    expect(mail.text).toContain("\n\nhttps://evil.test/org\n\n");
  });
});

describe("email buttons", () => {
  it("turns only the trusted address into a button when the text has a person's words", () => {
    const text = "Broken page\n\nhttps://evil.test/login\n\nFrom Aysel\n\nhttps://app.test/admin/problems";
    const html = renderEmailHtml(text, { button: "https://app.test/admin/problems", buttonLabel: "Open" });
    expect(html.match(/>Open<\/a>/g)).toHaveLength(1);
    expect(html).toContain('href="https://app.test/admin/problems"');
    expect(html).not.toContain('href="https://evil.test');
    expect(html).toContain("https://evil.test/login");
    // No trusted address at all (the demo request): no button.
    expect(renderEmailHtml(text, { button: null })).not.toContain("<a ");
    // Without `button` (system mail and templates) every address on its own line is a button, as before.
    expect(renderEmailHtml(text).match(/display:inline-block/g)).toHaveLength(2);
  });
});

describe("email direction", () => {
  it("writes Arabic mail right to left, with the alignment Outlook needs", () => {
    const ar = renderEmailHtml("مرحبا", { lang: "ar" });
    expect(ar).toContain('<html lang="ar" dir="rtl">');
    expect(ar).toMatch(/<div dir="rtl" style="[^"]*text-align:right">/);
    const en = renderEmailHtml("Hello", { lang: "en" });
    expect(en).toContain('dir="ltr"');
    expect(en).not.toContain("text-align:right");
  });
});
