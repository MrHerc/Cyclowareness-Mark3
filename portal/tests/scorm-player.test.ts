import fs from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LessonFile, Scene, SceneType } from "@/lib/content/types";

// The bundle aliases next/link and next/navigation to the shim (scripts/build-scorm-player.ts); so does this test.
vi.mock("next/navigation", () => import("../src/scorm/next-shim"));
vi.mock("next/link", () => import("../src/scorm/next-shim"));

const scenes = await import("@/components/player/scenes");
const { ScormApp, ScormProviders } = await import("@/scorm/app");
const { connect } = await import("@/scorm/scorm-api");
const { loadMessages } = await import("@/i18n/messages");

/** The first scene of each type in the English library lessons. */
function oneOfEach(): Map<SceneType, Scene> {
  const found = new Map<SceneType, Scene>();
  const root = path.join(__dirname, "..", "content", "library", "lessons");
  for (const mod of fs.readdirSync(root)) {
    for (const file of fs.readdirSync(path.join(root, mod)).filter((f) => f.endsWith(".en.json"))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(root, mod, file), "utf8")) as LessonFile;
      for (const s of lesson.scenes) if (!found.has(s.type)) found.set(s.type, s);
    }
  }
  return found;
}

const SCENES: Record<SceneType, ComponentType<{ scene: never; env: never; saving?: boolean; onFinish?: () => void }>> = {
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
} as never;

async function packageData(locale: "en" | "ar", lessonScenes: Scene[]) {
  const { common, player, learner } = await loadMessages(locale);
  return {
    locale,
    module: { slug: "demo", title: "Demo module", topic: "email" },
    lessons: [{ id: "l1", key: "one", title: "First lesson", minutes: 3, contentLocale: "en", scenes: lessonScenes }],
    brands: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "library", "brands.json"), "utf8")),
    messages: { common, player, learner: { profile: learner.profile, attest: learner.attest, problem: learner.problem } },
  };
}

const narrator = { speak: () => {}, stop: () => {}, pause: () => {}, resume: () => {}, speaking: false, paused: false };
const env = { narrator, uiLocale: "en", soundOn: false, still: true, timer: null, onAnswer: () => {}, onDone: () => {} };

describe("offline SCORM player", () => {
  const found = oneOfEach();

  it("finds every scene type in the library", () => {
    expect([...found.keys()].sort()).toEqual(Object.keys(SCENES).sort());
  });

  it.each(Object.keys(SCENES) as SceneType[])("renders a %s scene without a server", async (type) => {
    const scene = found.get(type)!;
    const data = await packageData("en", [scene]);
    const html = renderToStaticMarkup(
      createElement(ScormProviders, { data }, createElement(SCENES[type], { scene: scene as never, env: env as never, saving: false, onFinish: () => {} })),
    );
    expect(html.length).toBeGreaterThan(200);
    // Every interface string came from the bundled messages: none is left as its key.
    expect(html).not.toMatch(/\bplayer\.[a-z]+\.[a-zA-Z]+\b/);
  });

  it("opens the module's first unfinished lesson, in the package's language and direction", async () => {
    const data = await packageData("ar", [...found.values()]);
    const html = renderToStaticMarkup(createElement(ScormApp, { data, session: connect(null, data.lessons) }));
    expect(html).toContain("First lesson");
    expect(html).toContain("Demo module");
    // The leave link stays inside the package, as a hash the app routes on.
    expect(html).toContain('href="#/learn/demo"');
    expect(html).not.toMatch(/href="\//);
  });
});
