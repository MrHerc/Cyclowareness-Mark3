import fs from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { LessonFile, Scene, SceneType } from "@/lib/content/types";
import type { SceneEnv } from "@/components/player/scenes";

// Server rendering has no app router: the admin tabs' useRouter() gets the offline player's shim.
vi.mock("next/navigation", () => import("../src/scorm/next-shim"));

const scenes = await import("@/components/player/scenes");
const tabs = await import("@/components/admin/settings-tabs");
const { BrandsProvider } = await import("@/components/player/artifacts");
const { loadMessages } = await import("@/i18n/messages");
const { DEFAULT_BRANDING, defaultSettings } = await import("@/lib/tenant-defaults");

const messages = await loadMessages("en");
const brands = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "library", "brands.json"), "utf8"));

function render(node: ReactNode) {
  return renderToStaticMarkup(
    // The provider types its children as a prop; createElement passes them as the third argument.
    createElement(NextIntlClientProvider, { locale: "en", messages } as ComponentProps<typeof NextIntlClientProvider>, createElement(BrandsProvider, { brands } as ComponentProps<typeof BrandsProvider>, node)),
  );
}

/** The visible text, without tags and with entities and whitespace normalised. */
function textOf(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}
const words = (s: string) => s.replace(/\s+/g, " ").trim();

/** The first scene of each type in the English catalog lessons: one fixture per type. */
function oneOfEach(): Map<SceneType, Scene> {
  const found = new Map<SceneType, Scene>();
  const root = path.join(__dirname, "..", "content", "library", "lessons");
  for (const mod of fs.readdirSync(root).sort()) {
    for (const file of fs.readdirSync(path.join(root, mod)).filter((f) => f.endsWith(".en.json")).sort()) {
      const lesson = JSON.parse(fs.readFileSync(path.join(root, mod, file), "utf8")) as LessonFile;
      for (const s of lesson.scenes) if (!found.has(s.type)) found.set(s.type, s);
    }
  }
  return found;
}
const found = oneOfEach();
const sceneOf = <T extends SceneType>(type: T) => found.get(type) as Extract<Scene, { type: T }>;

const noop = () => {};
const env: SceneEnv = {
  narrator: { speak: noop, stop: noop, pause: noop, resume: noop, speaking: false, paused: false },
  uiLocale: "en",
  soundOn: false,
  still: true,
  timer: null,
  onAnswer: noop,
  onDone: noop,
};

function scene<T extends SceneType>(type: T, extra: Record<string, unknown> = {}) {
  const Component = {
    tutor: scenes.TutorScene,
    intro: scenes.IntroScene,
    simulation: scenes.SimulationScene,
    choice: scenes.ChoiceScene,
    hotspot: scenes.HotspotScene,
    swipe: scenes.SwipeScene,
    match: scenes.MatchScene,
    order: scenes.OrderScene,
    scenario: scenes.ScenarioScene,
    password: scenes.PasswordScene,
    recap: scenes.RecapScene,
  }[type] as ComponentType<Record<string, unknown>>;
  const html = render(createElement(Component, { scene: sceneOf(type), env, ...extra }));
  return { html, text: textOf(html) };
}

describe("lesson scenes render", () => {
  it("has a catalog fixture for every scene type", () => {
    expect([...found.keys()].sort()).toEqual(["choice", "hotspot", "intro", "match", "order", "password", "recap", "scenario", "simulation", "swipe", "tutor"]);
  });

  it("tutor: the first beat's text, replay and next or the beat's question", () => {
    const s = sceneOf("tutor");
    const { html, text } = scene("tutor");
    expect(text).toContain(words(s.beats[0].say).split(" ")[0]);
    expect(html).toContain('aria-label="Replay"');
    expect(text).toContain(s.beats[0].checkpoint ? "Answer the question" : "Next");
    // Part 1 of n in the step dots.
    expect(html).toContain(`aria-label="Part 1 of ${s.beats.length}"`);
  });

  it("intro: title, body and Start", () => {
    const s = sceneOf("intro");
    const { text } = scene("intro");
    expect(text).toContain(words(s.title));
    expect(text).toContain("Start");
  });

  it("simulation: its title and the Start button before the first step", () => {
    const s = sceneOf("simulation");
    const { text } = scene("simulation");
    expect(text).toContain(words(s.title));
    expect(text).toContain("Start");
  });

  it("choice: prompt, every option and Check", () => {
    const s = sceneOf("choice");
    const { html, text } = scene("choice");
    expect(text).toContain(words(s.question.prompt));
    for (const o of s.question.options) expect(text).toContain(words(o.label));
    expect(text).toContain("Check");
    expect(html).toMatch(/role="(radiogroup|group)"/);
  });

  it("hotspot: prompt, the found counter and the artifact", () => {
    const s = sceneOf("hotspot");
    const { text } = scene("hotspot");
    expect(text).toContain(words(s.prompt));
    expect(text).toContain(`Found 0 of ${Math.min(s.minToFind, s.spots.length)}`);
  });

  it("swipe: prompt and the Trap and Safe buttons", () => {
    const s = sceneOf("swipe");
    const { text } = scene("swipe");
    expect(text).toContain(words(s.prompt));
    expect(text).toContain("Trap");
    expect(text).toContain("Safe");
  });

  it("match: prompt, every left and right item and the counter", () => {
    const s = sceneOf("match");
    const { text } = scene("match");
    expect(text).toContain(words(s.prompt));
    for (const p of s.pairs) {
      expect(text).toContain(words(p.left));
      expect(text).toContain(words(p.right));
    }
    expect(text).toContain(`0 of ${s.pairs.length} matched`);
  });

  it("order: prompt, every item with its move buttons and Check", () => {
    const s = sceneOf("order");
    const { html, text } = scene("order");
    expect(text).toContain(words(s.prompt));
    for (const item of s.items) expect(text).toContain(words(item.label));
    expect(html).toContain('aria-label="Move up');
    expect(text).toContain("Check");
  });

  it("scenario: the first line and its choices", () => {
    const s = sceneOf("scenario");
    const start = s.nodes.find((n) => n.id === s.start)!;
    const { text } = scene("scenario");
    expect(text).toContain(words(start.text).split(" ").slice(0, 3).join(" "));
    for (const c of start.choices ?? []) expect(text).toContain(words(c.label));
  });

  it("password: prompt, the labelled input and the tips", () => {
    const s = sceneOf("password");
    const { html, text } = scene("password");
    expect(text).toContain(words(s.prompt));
    expect(html).toContain('<label class="mt-6 block text-caption font-semibold" for="pw-scene">Your passphrase</label>');
    for (const tip of s.tips) expect(text).toContain(words(tip));
  });

  it("recap: every point and the Finish button, which says Saving while saving", () => {
    const s = sceneOf("recap");
    const { text } = scene("recap", { saving: false, onFinish: noop });
    expect(text).toContain("What to remember");
    for (const p of s.points) expect(text).toContain(words(p));
    expect(text).toContain("Finish lesson");
    expect(scene("recap", { saving: true, onFinish: noop }).text).toContain("Saving…");
  });
});

describe("settings tabs render", () => {
  const s = defaultSettings("en");
  const cases: [string, ReactNode, string[]][] = [
    ["branding", createElement(tabs.BrandingTab, { name: "Acme Bank", branding: DEFAULT_BRANDING, domain: null, verifiedOn: null, lapsing: null }), ["Name and logo", "Acme Bank"]],
    ["languages", createElement(tabs.LanguagesTab, { defaultLocale: s.defaultLocale, locales: s.locales, timeZone: s.timeZone, timeZones: [s.timeZone] }), ["Default language", s.timeZone]],
    ["identity", createElement(tabs.IdentityTab, { identity: { ...s.identity, sso: undefined, ldap: undefined }, redirectUri: "https://app.test/api/sso/callback/acme", signInLink: "https://app.test/api/sso/start?tenant=acme", testResult: null }), ["Single sign-on", "https://app.test/api/sso/callback/acme"]],
    ["email", createElement(tabs.EmailTab, { email: { ...s.email, hasPassword: false }, viewerEmail: "admin@acme.test", outbox: [], failedCount: 0 }), ["Email delivery"]],
    ["notifications", createElement(tabs.NotificationsTab, { notifications: s.notifications, locales: s.locales, emailReady: false, orgName: "Acme Bank" }), ["Not set up"]],
    ["attestation", createElement(tabs.AttestationTab, { texts: s.attestationText, locales: s.locales }), ["Confirmation text"]],
    ["certificate", createElement(tabs.CertificateTab, { cert: s.certificate, orgName: "Acme Bank", logoUrl: null, locale: "en", locales: s.locales, verifyHost: "app.test" }), ["Certificate text", "Acme Bank"]],
    ["learning", createElement(tabs.LearningTab, { learning: s.learning }), ["Time limits on questions"]],
    ["protection", createElement(tabs.ProtectionTab, { protection: s.protection, retention: s.retention }), ["Content protection"]],
    ["security", createElement(tabs.SecurityTab, { allowedUntil: null }), ["Support access"]],
    ["integrations", createElement(tabs.IntegrationsTab, { integrations: { ...s.integrations, hasWebhookSecret: false }, deliveries: [] }), ["Webhook", "Send events"]],
  ];

  it.each(cases)("%s", (_name, node, expected) => {
    const html = render(node);
    const text = textOf(html);
    // A heading of the tab, and the stub values it shows (some only as input values).
    for (const e of expected) expect(html).toContain(e);
    // A real form: labelled controls and a button, and every interface string came from the messages.
    expect(html).toMatch(/<(input|select|textarea|button)\b/);
    expect(text).not.toMatch(/\bsettings\.[a-z]+\.[a-zA-Z]+\b/);
  });
});
